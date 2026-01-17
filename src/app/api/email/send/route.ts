import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getTodayDateString } from '@/lib/utils';

let resend: Resend | null = null;
function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

const DAILY_EMAIL_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || '100', 10);

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://serenity.app';
  
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
                Dear <strong>${data.recipientName}</strong>,
              </p>
              
              <p style="margin: 0 0 30px; color: #64748b; font-size: 16px; line-height: 1.6;">
                You have been awarded a certificate from <strong>${data.issuerName}</strong>:
              </p>
              
              <!-- Certificate Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                      Certificate of
                    </p>
                    <h2 style="margin: 0; color: #78350f; font-size: 24px; font-weight: 700;">
                      ${data.certificateTitle}
                    </h2>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 30px; color: #64748b; font-size: 16px; line-height: 1.6;">
                Your certificate includes a unique QR code for verification. Anyone can scan it to confirm the authenticity of your achievement.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #b45309 0%, #f59e0b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Your Certificate
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #94a3b8; font-size: 14px; text-align: center;">
                Certificate ID: <code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${data.certificateId}</code>
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
  try {
    const body = await request.json();
    const { to, recipientName, certificateId, certificateTitle, issuerName, userId } = body;

    if (!to || !recipientName || !certificateId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const rateLimit = await checkRateLimit(userId || 'anonymous');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Daily email limit reached. Upgrade to Pro for unlimited emails.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://serenity.app';
    const verifyUrl = `${appUrl}/verify/${certificateId}`;

    const emailData: SendEmailRequest = {
      to,
      recipientName,
      certificateId,
      certificateTitle: certificateTitle || 'Certificate of Completion',
      issuerName: issuerName || 'Serenity',
      verifyUrl,
    };

    const { data, error } = await getResend().emails.send({
      from: 'Serenity <certificates@serenity.app>',
      to: [to],
      subject: `🎉 Your Certificate: ${emailData.certificateTitle}`,
      html: generateEmailHTML(emailData),
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send email' },
        { status: 500 }
      );
    }

    const db = getAdminFirestore();
    await db.collection('emailLogs').add({
      to,
      certificateId,
      messageId: data?.id,
      sentAt: FieldValue.serverTimestamp(),
      userId: userId || 'anonymous',
    });

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      remaining: rateLimit.remaining,
    });

  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
