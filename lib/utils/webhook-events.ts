import { db } from '@/lib/db';
import { webhookEvents } from '@/lib/db/schema';
import { logger } from '@/lib/utils/logger';

export interface WebhookEventInput {
  readonly source: 'midtrans' | 'biteship';
  readonly eventType: string;
  readonly externalId?: string | null;
  readonly payload?: unknown;
  readonly errorMessage?: string | null;
}

/**
 * Persist a webhook event so the daily ops card's `webhookErrorCount24h`
 * counter reflects reality (P3 backlog #6). Fire-and-forget: never let audit
 * logging break the webhook's 200 response.
 */
export async function recordWebhookEvent(input: WebhookEventInput): Promise<void> {
  try {
    await db.insert(webhookEvents).values({
      source: input.source,
      eventType: input.eventType,
      externalId: input.externalId ?? null,
      payload: (input.payload ?? null) as never,
      processedAt: input.errorMessage ? null : new Date(),
      errorMessage: input.errorMessage ?? null,
    });
  } catch (error) {
    logger.error('[webhook-events] failed to record event', {
      source: input.source,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
