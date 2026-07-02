import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/verifyAuth';
import { FieldValue } from 'firebase-admin/firestore';
import { getTodayDateString } from '@/lib/utils';
import { createLogger, getErrorDetails } from '@/lib/logger';

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
  subject: string;
  htmlContent: string;
  attachment?: BrevoAttachment[];
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
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error: ${response.status} - ${errorBody}`);
  }

  const result = await response.json();
  return { messageId: result.messageId || `brevo_${Date.now()}` };
}

const DAILY_EMAIL_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || '300', 10);

interface SendEmailRequest {
  to: string;
  recipientName: string;
  certificateId: string;
  certificateTitle: string;
  issuerName: string;
  verifyUrl: string;
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const db = getAdminFirestore();
  const today = getTodayDateString();
  const rateLimitRef = db.collection('rateLimits').doc(`email_${userId}_${today}`);
  
  const rateLimitDoc = await rateLimitRef.get();
  
  if (!rateLimitDoc.exists) {
    await rateLimitRef.set({
      count: 1,
      date: today,
      userId,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { allowed: true, remaining: DAILY_EMAIL_LIMIT - 1 };
  }
  
  const currentCount = rateLimitDoc.data()?.count || 0;
  
  if (currentCount >= DAILY_EMAIL_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  await rateLimitRef.update({
    count: FieldValue.increment(1),
    lastEmailAt: FieldValue.serverTimestamp(),
  });
  
  return { allowed: true, remaining: DAILY_EMAIL_LIMIT - currentCount - 1 };
}

function generateEmailHTML(data: SendEmailRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity.app';

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
                <strong style="color: #1e293b;">📎 Your certificate PDF is attached to this email</strong> for easy download and sharing.
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
    const { to, recipientName, certificateId, certificateTitle, issuerName, certificatePdfBase64, certificateImageUrl } = body;

    logger.debug('Processing email send request', { requestId, to, certificateId, userId });

    if (!to || !recipientName || !certificateId) {
      logger.warn('Missing required fields', { requestId, to: !!to, recipientName: !!recipientName, certificateId: !!certificateId });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, recipientName, and certificateId are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      logger.warn('Invalid email format', { requestId, to });
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

    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      logger.info('Rate limit exceeded', { requestId, userId, limit: DAILY_EMAIL_LIMIT });
      return NextResponse.json(
        { 
          success: false, 
          error: `Daily email limit (${DAILY_EMAIL_LIMIT}) reached. Please try again tomorrow.`,
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://serenity.app';
    const verifyUrl = `${appUrl}/verify/${certificateId}`;

    const emailData: SendEmailRequest = {
      to,
      recipientName,
      certificateId,
      certificateTitle: certificateTitle || 'Certificate of Completion',
      issuerName: issuerName || 'Serenity',
      verifyUrl,
    };

    const senderName = process.env.EMAIL_SENDER_NAME || 'Serenity Certificates';
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'thispc119@gmail.com';

    try {
      const sanitizedName = recipientName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      
      const brevoPayload: BrevoEmailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to, name: recipientName }],
        subject: `🎉 ${emailData.certificateTitle}`,
        htmlContent: generateEmailHTML(emailData),
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
            base64Content = certificateImageUrl.split(',')[1];
          } else {
            // Fetch image from URL and convert to base64
            const imageResponse = await fetch(certificateImageUrl);
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              base64Content = Buffer.from(arrayBuffer).toString('base64');
            } else {
              logger.warn('Failed to fetch certificate image', { requestId, imageUrl: certificateImageUrl.substring(0, 50) });
              base64Content = '';
            }
          }
          
          if (base64Content) {
            brevoPayload.attachment = [
              {
                name: `certificate_${sanitizedName}.png`,
                content: base64Content,
              },
            ];
          }
        } catch (imageError) {
          logger.warn('Error attaching certificate image', { requestId }, imageError as Error);
          // Continue without attachment
        }
      }

      const info = await sendEmailWithBrevo(brevoPayload);

      await db.collection('emailLogs').add({
        to,
        certificateId,
        messageId: info.messageId,
        sentAt: FieldValue.serverTimestamp(),
        userId,
        hasAttachment: !!(brevoPayload.attachment && brevoPayload.attachment.length > 0),
      });

      // Update certificate with email status
      if (certificateId) {
        try {
          await certificateRef.update({
            emailStatus: 'sent',
            emailSentAt: FieldValue.serverTimestamp(),
            recipientEmail: to,
            emailError: null,
          });
        } catch (updateError) {
          logger.warn('Failed to update certificate email status', { requestId, certificateId }, updateError as Error);
        }
      }

      logger.info('Email sent successfully', { requestId, to, certificateId, messageId: info.messageId, remaining: rateLimit.remaining });

      return NextResponse.json({
        success: true,
        messageId: info.messageId,
        remaining: rateLimit.remaining,
      });
    } catch (emailError) {
      const errorDetails = getErrorDetails(emailError);
      logger.error('Failed to send email', { requestId, to, certificateId, error: errorDetails });
      
      // Update certificate with failed status
      if (certificateId) {
        try {
          await certificateRef.update({
            emailStatus: 'failed',
            emailError: errorDetails.message,
          });
        } catch (updateError) {
          logger.warn('Failed to update certificate failed status', { requestId, certificateId }, updateError as Error);
        }
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to send email. Please check your email configuration and try again.' },
        { status: 500 }
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
