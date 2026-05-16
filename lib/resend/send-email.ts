import { resend, FROM_EMAIL, FROM_NAME } from './client';
import type { ReactNode } from 'react';

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactNode;
  attachments?: Array<{ filename: string; content: Buffer | string }>;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const { to, subject, react, attachments } = params;

  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      react,
      ...(attachments && { attachments }),
    });

    if (error) {
      console.error('[Email] Resend API error:', { error, to, subject });
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Email] Unexpected error:', { err, to, subject });
    return false;
  }
}