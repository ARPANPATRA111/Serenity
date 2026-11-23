import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/verifyAuth';
import { FieldValue } from 'firebase-admin/firestore';
import { getTodayDateString } from '@/lib/utils';
import { createLogger, getErrorDetails } from '@/lib/logger';
import { buildVerificationUrl } from '@/lib/verification/url';
import { isSafeCertificateMediaUrl } from '@/lib/security/mediaUrl';
import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { certificateFileStem, imageExtension } from '@/lib/certificates/fileName';
import { randomUUID } from 'node:crypto';
import {
  certificateEmailFields,
  classifyProviderError,
  completeDelivery,
  dailyLimits,
  reserveDelivery,
} from '@/lib/email/delivery';

const logger = createLogger('Email.Send');
const MAX_ATTACHMENT_BASE64_LENGTH = 8_000_000;

/** Escape user-controlled values before interpolating into email HTML. */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface BrevoAttachment {
  name: string;
  content: string; // base64 encoded
}

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string; name?: string }[];
  replyTo?: { email: string; name?: string };
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachment?: BrevoAttachment[];
  /** X-Mailin-custom carries the delivery ID back in provider events. */
  headers?: Record<string, string>;
}

const PROVIDER_TIMEOUT_MS = 15_000;

/** A provider answer that was not an acceptance; `status` is its HTTP status. */
class ProviderRejection extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number | null) {
    super(message);
  }
}

/** Hides most of an address in server logs. */
function maskEmail(email: string): string {
  const [local, domain] = String(email).split('@');
  return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
}

async function sendEmailWithBrevo(payload: BrevoEmailPayload): Promise<{ messageId: string }> {
  const apiKey = process.env.SEND_IN_BLUE_API_KEY?.trim();
  
  if (!apiKey) {
    throw new Error('SEND_IN_BLUE_API_KEY environment variable is not set');
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    // No answer in time leaves the outcome unknown (see classifyProviderError).
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = (await response.text()).slice(0, 300);
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ProviderRejection(
      `Brevo API error: ${response.status} - ${errorBody}`,
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
    );
  }

  const result = await response.json();
  return { messageId: result.messageId || `brevo_${Date.now()}` };
}

const LOCAL_TRANSPORTS = new Set(['mailpit', 'json']);

async function sendEmail(payload: BrevoEmailPayload): Promise<{ messageId: string }> {
  const transportName = process.env.EMAIL_TRANSPORT || '';
  const emulatorMode = process.env.USE_FIREBASE_EMULATORS === 'true';

  // `.env.local` carries the production Brevo key and Next.js loads it even
  // in emulator mode, so emulator mode must never fall through to Brevo.
  if (emulatorMode && !LOCAL_TRANSPORTS.has(transportName)) {
    throw new Error('Emulator mode only supports the local mailpit or json email transports');
  }
  if (!LOCAL_TRANSPORTS.has(transportName)) return sendEmailWithBrevo(payload);

  if (!emulatorMode) {
    throw new Error('Local email transports are restricted to the isolated emulator environment');
  }

  const transport = transportName === 'json'
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: process.env.MAILPIT_HOST || '127.0.0.1',
        port: Number(process.env.MAILPIT_PORT || 1025),
        secure: false,
      });
  const result = await transport.sendMail({
    from: { name: payload.sender.name, address: payload.sender.email },
    to: payload.to.map((recipient) => ({ name: recipient.name || '', address: recipient.email })),
    subject: payload.subject,
    html: payload.htmlContent,
    text: payload.textContent,
    replyTo: payload.replyTo ? { name: payload.replyTo.name || '', address: payload.replyTo.email } : undefined,
    headers: payload.headers,
    attachments: payload.attachment?.map((attachment) => ({
      filename: attachment.name,
      content: Buffer.from(attachment.content, 'base64'),
    })),
  });

  if (transportName === 'json') {
    // Emulator-only outbox so automated tests can inspect what would be sent.
    const outbox = path.join(process.cwd(), '.local-object-store', 'outbox');
    await mkdir(outbox, { recursive: true });
    const fileName = `${Date.now()}-${String(result.messageId).replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
    await writeFile(path.join(outbox, fileName), JSON.stringify({
      messageId: result.messageId,
      from: payload.sender,
      replyTo: payload.replyTo ?? null,
      headers: payload.headers ?? {},
      to: payload.to,
      subject: payload.subject,
      html: payload.htmlContent,
      text: payload.textContent ?? null,
      attachments: (payload.attachment || []).map((attachment) => ({
        filename: attachment.name,
        bytes: Buffer.byteLength(attachment.content, 'base64'),
      })),
    }, null, 2));
  }

  return { messageId: result.messageId };
}

const DAILY_EMAIL_LIMIT = dailyLimits().perAccount;

interface SendEmailRequest {
  to: string;
  recipientName: string;
  certificateId: string;
  certificateTitle: string;
  issuerName: string;
  verifyUrl: string;
  hasAttachment?: boolean;
}

/** Plain-text alternative of the certificate email, with the same facts. */
function generateEmailText(data: SendEmailRequest): string {
  return [
    `Congratulations, ${data.recipientName}!`,
    '',
    `${data.issuerName} has issued you a certificate: ${data.certificateTitle}.`,
    data.hasAttachment ? 'Your certificate is attached to this email.' : 'Open the link below to view your certificate.',
    '',
    `Verify it at any time: ${data.verifyUrl}`,
    `Certificate ID: ${data.certificateId}`,
    '',
    'Sent with Serenity.',
  ].join('\n');
}

function generateEmailHTML(data: SendEmailRequest): string {
  const appUrl = new URL(data.verifyUrl).origin;

  // Escape all user-controlled values to prevent HTML/phishing injection.
  const recipientName = escapeHtml(data.recipientName);
  const issuerName = escapeHtml(data.issuerName);
  const certificateTitle = escapeHtml(data.certificateTitle);
  const certificateId = escapeHtml(data.certificateId);
  const verifyUrl = escapeHtml(data.verifyUrl);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Certificate is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #b45309 0%, #f59e0b 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🎉 Congratulations!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 18px; line-height: 1.6;">
                Dear <strong>${recipientName}</strong>,
              </p>
              
              <p style="margin: 0 0 30px; color: #64748b; font-size: 16px; line-height: 1.6;">
                You have been awarded a certificate from <strong>${issuerName}</strong>:
              </p>
              
              <!-- Certificate Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <h2 style="margin: 0; color: #78350f; font-size: 24px; font-weight: 700;">
                      ${certificateTitle}
                    </h2>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 30px; color: #64748b; font-size: 16px; line-height: 1.6;">
                Your certificate includes a unique verification link. Anyone can use it to confirm the authenticity of your achievement.
                <br><br>
                ${data.hasAttachment === false
                  ? '<strong style="color: #1e293b;">Open your certificate with the button below.</strong> You can view, share, and download it from its verification page.'
                  : '<strong style="color: #1e293b;">📎 Your certificate is attached to this email</strong> for easy download and sharing.'}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #b45309 0%, #f59e0b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Your Certificate
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #94a3b8; font-size: 14px; text-align: center;">
                Certificate ID: <code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${certificateId}</code>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">
                Powered by <a href="${appUrl}" style="color: #b45309; text-decoration: none; font-weight: 600;">Serenity</a>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                Professional Certificate Generator
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    // Require a verified Firebase ID token. Identity is derived from the token,
    // never from a client-supplied userId. Closes the unauthenticated email
    // relay / spam-abuse vector on this endpoint.
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!authUser.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Email verification required' },
        { status: 403 }
      );
    }
    const userId = authUser.uid;

    const body = await request.json();
    const { to, recipientName, certificateId, certificateTitle, issuerName, certificatePdfBase64, certificateImageUrl, idempotencyKey } = body;

    logger.debug('Processing email send request', { requestId, to: maskEmail(String(to || '')), certificateId, userId });

    // Current clients send a key per send intent (a batch's first send, or one
    // Resend), so duplicate clicks and retries never send twice. Requests
    // without one behave as before: every request is a new attempt.
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !idempotencyKey || idempotencyKey.length > 120)) {
      return NextResponse.json({ success: false, error: 'Invalid idempotency key' }, { status: 400 });
    }
    const sendIntent: string = idempotencyKey || `request:${randomUUID()}`;

    if (!to || !recipientName || !certificateId) {
      logger.warn('Missing required fields', { requestId, to: !!to, recipientName: !!recipientName, certificateId: !!certificateId });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, recipientName, and certificateId are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      logger.warn('Invalid email format', { requestId, to: maskEmail(to) });
      return NextResponse.json(
        { success: false, error: 'Invalid email address format' },
        { status: 400 }
      );
    }

    if (certificatePdfBase64 !== undefined && typeof certificatePdfBase64 !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid certificate attachment' },
        { status: 400 }
      );
    }

    if (certificatePdfBase64 && certificatePdfBase64.length > MAX_ATTACHMENT_BASE64_LENGTH) {
      return NextResponse.json(
        { success: false, error: 'Certificate attachment is too large' },
        { status: 413 }
      );
    }

    if (
      typeof certificateImageUrl === 'string' &&
      certificateImageUrl.startsWith('data:') &&
      certificateImageUrl.length > MAX_ATTACHMENT_BASE64_LENGTH
    ) {
      return NextResponse.json(
        { success: false, error: 'Certificate image attachment is too large' },
        { status: 413 }
      );
    }

    if (
      certificateImageUrl &&
      !certificateImageUrl.startsWith('data:') &&
      !isSafeCertificateMediaUrl(certificateImageUrl)
    ) {
      return NextResponse.json(
        { success: false, error: 'Certificate image URL is not from an approved media host' },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();
    const certificateRef = db.collection('certificates').doc(certificateId);
    const certificateDoc = await certificateRef.get();

    if (!certificateDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Certificate not found' },
        { status: 404 }
      );
    }

    const certificateData = certificateDoc.data();
    if (certificateData?.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (certificateData?.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Certificate has been revoked' },
        { status: 410 }
      );
    }

    // A verified sender must be configured; there is no personal fallback.
    const senderName = process.env.EMAIL_SENDER_NAME || 'Serenity Certificates';
    const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
    const replyToEmail = process.env.EMAIL_REPLY_TO?.trim();
    if (!senderEmail) {
      logger.error('No sender address configured (BREVO_SENDER_EMAIL)', { requestId });
      return NextResponse.json(
        { success: false, error: 'Email sending is not configured. Certificates are saved; send them later from History.', code: 'EMAIL_SENDER_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const today = getTodayDateString();
    const reservation = await reserveDelivery(db, { userId, certificateId, to, idempotencyKey: sendIntent, day: today });
    switch (reservation.outcome) {
      case 'duplicate':
        // Already accepted for this send: report it again, send nothing.
        return NextResponse.json({ success: true, duplicate: true, messageId: reservation.messageId, deliveryId: reservation.deliveryId });
      case 'in_progress':
        return NextResponse.json(
          { success: false, error: 'This email is already being sent.', code: 'DELIVERY_IN_PROGRESS', deliveryId: reservation.deliveryId },
          { status: 409 },
        );
      case 'unknown':
        return NextResponse.json(
          {
            success: false,
            error: 'An earlier attempt got no answer from the email service and may have been delivered. Check with the recipient, then use Resend.',
            code: 'DELIVERY_OUTCOME_UNKNOWN',
            deliveryId: reservation.deliveryId,
          },
          { status: 409 },
        );
      case 'suppressed':
        try {
          await certificateRef.update({ emailStatus: 'failed', deliveryStatus: 'suppressed', emailError: 'Not sent: this address bounced or reported earlier messages.' });
        } catch (updateError) {
          logger.warn('Failed to record suppressed recipient', { requestId, certificateId }, updateError as Error);
        }
        return NextResponse.json(
          { success: false, error: 'Not sent: this address bounced or reported earlier messages. Use a different address.', code: 'RECIPIENT_SUPPRESSED' },
          { status: 422 },
        );
      case 'account_limit':
        logger.info('Rate limit exceeded', { requestId, userId, limit: reservation.limit });
        return NextResponse.json(
          {
            success: false,
            error: `Daily email limit (${reservation.limit}) reached. Please try again tomorrow.`,
            code: 'RATE_LIMIT_EXCEEDED',
          },
          { status: 429 }
        );
      case 'provider_limit':
        logger.warn('Provider daily budget reached', { requestId, limit: reservation.limit });
        return NextResponse.json(
          {
            success: false,
            error: 'The email service has reached today’s sending limit. Your certificates are saved; send the rest from History tomorrow.',
            code: 'PROVIDER_DAILY_LIMIT',
          },
          { status: 429 }
        );
      default:
        break;
    }
    const { deliveryId } = reservation;
    const rateLimit = { remaining: reservation.remaining };

    const verifyUrl = buildVerificationUrl(certificateId);

    const emailData: SendEmailRequest = {
      to,
      recipientName,
      certificateId,
      certificateTitle: certificateTitle || 'Certificate of Completion',
      issuerName: issuerName || 'Serenity',
      verifyUrl,
    };

    try {
      const sanitizedName = certificateFileStem(recipientName);
      let imageType = 'image/png';
      
      const brevoPayload: BrevoEmailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, name: recipientName }],
        ...(replyToEmail ? { replyTo: { email: replyToEmail, name: senderName } } : {}),
        subject: `🎉 ${emailData.certificateTitle}`,
        htmlContent: generateEmailHTML(emailData),
        headers: { 'X-Mailin-custom': `serenity-delivery:${deliveryId}` },
      };

      if (certificatePdfBase64) {
        brevoPayload.attachment = [
          {
            name: `certificate_${sanitizedName}.pdf`,
            content: certificatePdfBase64,
          },
        ];
      } else if (certificateImageUrl) {
        if (
          certificateImageUrl !== certificateData?.certificateImage &&
          !certificateImageUrl.startsWith('data:')
        ) {
          return NextResponse.json(
            { success: false, error: 'Certificate image does not match the saved certificate' },
            { status: 400 }
          );
        }

        // If no PDF but image URL is provided, fetch and attach the image
        try {
          let base64Content: string;
          
          if (certificateImageUrl.startsWith('data:')) {
            // Handle data URL (base64)
            imageType = certificateImageUrl.slice('data:'.length, certificateImageUrl.indexOf(';')) || imageType;
            base64Content = certificateImageUrl.split(',')[1];
          } else {
            // Fetch image from URL and convert to base64
            const imageResponse = await fetch(certificateImageUrl);
            if (imageResponse.ok) {
              const contentType = imageResponse.headers.get('content-type') || '';
              if (!['image/png', 'image/jpeg', 'image/webp'].some(type => contentType.startsWith(type))) {
                throw new Error('Certificate image response has an unsupported content type');
              }
              imageType = contentType;
              const arrayBuffer = await imageResponse.arrayBuffer();
              if (arrayBuffer.byteLength > 6_000_000) {
                throw new Error('Certificate image response is too large');
              }
              base64Content = Buffer.from(arrayBuffer).toString('base64');
            } else {
              logger.warn('Failed to fetch certificate image', { requestId, imageUrl: certificateImageUrl.substring(0, 50) });
              base64Content = '';
            }
          }
          
          if (base64Content) {
            brevoPayload.attachment = [
              {
                name: `certificate_${sanitizedName}.${imageExtension(imageType)}`,
                content: base64Content,
              },
            ];
          }
        } catch (imageError) {
          logger.warn('Error attaching certificate image', { requestId }, imageError as Error);
          // Continue without attachment
        }
      }

      // Build the body last so it only promises an attachment that is present.
      const bodyData = { ...emailData, hasAttachment: !!brevoPayload.attachment?.length };
      brevoPayload.htmlContent = generateEmailHTML(bodyData);
      brevoPayload.textContent = generateEmailText(bodyData);

      // One retry for a provider that answered "slow down" or with a server
      // error. Nothing was accepted in those cases, so retrying is safe.
      let info: { messageId: string };
      try {
        info = await sendEmail(brevoPayload);
      } catch (firstError) {
        const failure = classifyProviderError(firstError);
        if (failure.kind !== 'rejected' || !failure.retryable) throw firstError;
        const wait = Math.min((firstError as ProviderRejection).retryAfterMs ?? 1000, 5000);
        await new Promise((resolve) => setTimeout(resolve, wait));
        info = await sendEmail(brevoPayload);
      }
      const hadAttachment = !!(brevoPayload.attachment && brevoPayload.attachment.length > 0);

      // The provider has accepted the message. Bookkeeping failures below are
      // logged but never reported as a failed send, which would invite a
      // duplicate resend.
      try {
        await completeDelivery(db, { deliveryId, day: today, status: 'accepted', messageId: info.messageId });
      } catch (recordError) {
        logger.warn('Failed to record accepted delivery', { requestId, deliveryId }, recordError as Error);
      }
      try {
        await db.collection('emailLogs').add({
          to,
          certificateId,
          messageId: info.messageId,
          deliveryId,
          sentAt: FieldValue.serverTimestamp(),
          userId,
          hasAttachment: hadAttachment,
        });
      } catch (logError) {
        logger.warn('Failed to write email log', { requestId, deliveryId }, logError as Error);
      }
      try {
        await certificateRef.update({
          emailStatus: 'sent',
          deliveryStatus: 'accepted',
          deliveryId,
          emailSentAt: FieldValue.serverTimestamp(),
          recipientEmail: to,
          emailError: null,
          emailMessageId: info.messageId,
          emailHadAttachment: hadAttachment,
        });
      } catch (updateError) {
        logger.warn('Failed to update certificate email status', { requestId, certificateId }, updateError as Error);
      }

      logger.info('Email accepted by provider', { requestId, to: maskEmail(to), certificateId, deliveryId, remaining: rateLimit.remaining });

      return NextResponse.json({
        success: true,
        messageId: info.messageId,
        deliveryId,
        remaining: rateLimit.remaining,
      });
    } catch (emailError) {
      const errorDetails = getErrorDetails(emailError);
      const failure = classifyProviderError(emailError);
      logger.error('Failed to send email', { requestId, to: maskEmail(to), certificateId, deliveryId, outcome: failure.kind, error: errorDetails });

      try {
        await completeDelivery(db, failure.kind === 'unknown'
          ? { deliveryId, day: today, status: 'unknown', reason: failure.message }
          : { deliveryId, day: today, status: 'failed', retryable: failure.retryable, reason: failure.message });
      } catch (recordError) {
        logger.warn('Failed to record failed delivery', { requestId, deliveryId }, recordError as Error);
      }

      try {
        await certificateRef.update(failure.kind === 'unknown'
          ? {
            emailStatus: 'failed',
            ...certificateEmailFields('unknown'),
            emailError: 'No answer from the email service: it may have been delivered. Check before resending.',
          }
          : { emailStatus: 'failed', deliveryStatus: 'failed', emailError: errorDetails.message.slice(0, 300) });
      } catch (updateError) {
        logger.warn('Failed to update certificate failed status', { requestId, certificateId }, updateError as Error);
      }

      return NextResponse.json(
        failure.kind === 'unknown'
          ? {
            success: false,
            error: 'The email service did not answer. The email may have been delivered; check before resending.',
            code: 'DELIVERY_OUTCOME_UNKNOWN',
            deliveryId,
          }
          : {
            success: false,
            error: 'Failed to send email. Please check your email configuration and try again.',
            code: failure.retryable ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED',
            retryable: failure.retryable,
            deliveryId,
          },
        { status: failure.kind === 'unknown' ? 504 : 500 }
      );
    }

  } catch (error) {
    const errorDetails = getErrorDetails(error);
    logger.error('Email API unexpected error', { error: errorDetails });
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred while sending the email' },
      { status: 500 }
    );
  }
}
