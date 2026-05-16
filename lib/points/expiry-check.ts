import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { eq, and, lte, gt, sql } from 'drizzle-orm';
import { sendEmail } from '@/lib/resend/send-email';
import { PointsExpiringEmail } from '@/lib/resend/templates/PointsExpiring';
import { POINTS_VALUE_IDR } from '@/lib/constants/points';
import { formatWIB } from '@/lib/utils/format-date';

const EXPIRY_DAYS = 30;

interface ExpiringPointsItem {
  pointsAmount: number;
  expiresAt: string;
  description: string;
}

interface UserExpiringPoints {
  userId: string;
  customerEmail: string;
  customerName: string;
  totalPoints: number;
  totalValue: number;
  items: ExpiringPointsItem[];
}

export async function checkExpiringPoints(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  try {
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const expiringPoints = await db.query.pointsHistory.findMany({
      where: and(
        eq(pointsHistory.isExpired, false),
        gt(pointsHistory.expiresAt, now),
        lte(pointsHistory.expiresAt, expiryThreshold),
        eq(pointsHistory.type, 'earn')
      ),
      with: {
        user: true,
      },
    });

    if (expiringPoints.length === 0) {
      return { processed: 0, errors: [] };
    }

    const groupedByUser = new Map<string, UserExpiringPoints>();

    for (const record of expiringPoints) {
      if (!record.user || !record.user.email) continue;

      const userId = record.userId;
      if (!groupedByUser.has(userId)) {
        groupedByUser.set(userId, {
          userId,
          customerEmail: record.user.email,
          customerName: record.user.name,
          totalPoints: 0,
          totalValue: 0,
          items: [],
        });
      }

      const userGroup = groupedByUser.get(userId)!;
      userGroup.totalPoints += record.pointsAmount;
      userGroup.totalValue += record.pointsAmount * POINTS_VALUE_IDR;
      userGroup.items.push({
        pointsAmount: record.pointsAmount,
        expiresAt: formatWIB(record.expiresAt!),
        description: record.descriptionId || record.descriptionEn || 'Poin dari pembelian',
      });
    }

    for (const [, userData] of groupedByUser) {
      try {
        const emailHtml = PointsExpiringEmail({
          customerName: userData.customerName,
          customerEmail: userData.customerEmail,
          totalExpiringPoints: userData.totalPoints,
          totalExpiringValue: userData.totalValue,
          expiringPointsList: userData.items,
        });

        await sendEmail({
          to: userData.customerEmail,
          subject: `${userData.totalPoints.toLocaleString('id-ID')} poin kamu akan hangus dalam 30 hari!`,
          react: emailHtml,
        });

        processed++;
      } catch (emailError) {
        const message = emailError instanceof Error ? emailError.message : String(emailError);
        errors.push(`Failed to send to ${userData.customerEmail}: ${message}`);
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(`Database query failed: ${message}`);
  }

  return { processed, errors };
}