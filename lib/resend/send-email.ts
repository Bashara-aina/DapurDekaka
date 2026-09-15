import { resend, FROM_EMAIL, FROM_NAME } from './client';
import type { ReactNode } from 'react';
import { logger } from '@/lib/utils/logger';

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
      logger.error('[email] Resend API error', { to, subject, error });
      return false;
    }

    return true;
  } catch (err) {
    logger.error('[email] unexpected error', { to, subject, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}