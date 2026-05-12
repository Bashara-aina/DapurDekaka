import { resend, FROM_EMAIL, FROM_NAME } from './client';
import type { ReactNode } from 'react';

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactNode;
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, subject, react, attachments } = params;

  try {
    await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      react,
      ...(attachments && { attachments }),
    });
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    // Never throw — email failures are non-critical
  }
}