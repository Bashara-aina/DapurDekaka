'use client';

import { Gift, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import type { PointsHistory } from '@/lib/db/schema';

interface PointsHistoryCardProps {
  transaction: PointsHistory;
}

export function PointsHistoryCard({ transaction }: PointsHistoryCardProps) {
  const isEarn = transaction.type === 'earn';
  const isRedeem = transaction.type === 'redeem';
  const isExpire = transaction.type === 'expire';

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-card border border-brand-cream-dark">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
        ${isEarn ? 'bg-success-light' : ''}
        ${isRedeem ? 'bg-info-light' : ''}
        ${isExpire ? 'bg-warning-light' : ''}
        ${transaction.type === 'adjust' ? 'bg-purple-100' : ''}
      `}>
        {isEarn && <TrendingUp className="w-6 h-6 text-success" />}
        {isRedeem && <TrendingDown className="w-6 h-6 text-info" />}
        {isExpire && <Clock className="w-6 h-6 text-warning" />}
        {transaction.type === 'adjust' && <Gift className="w-6 h-6 text-purple-600" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-text-primary text-sm">
          {transaction.descriptionId}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {formatDate(transaction.createdAt)}
          {transaction.expiresAt && !transaction.isExpired && (
            <span className="text-warning">
              {' '}· Kedaluwarsa {formatDate(transaction.expiresAt)}
            </span>
          )}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={`font-bold text-lg
          ${isEarn ? 'text-success' : ''}
          ${isRedeem ? 'text-info' : ''}
          ${isExpire ? 'text-warning' : ''}
          ${transaction.type === 'adjust' ? 'text-purple-600' : ''}
        `}>
          {isEarn ? '+' : isRedeem || isExpire ? '-' : ''}{transaction.pointsAmount} poin
        </p>
        <p className="text-xs text-text-secondary">
          Sisa: {transaction.pointsBalanceAfter}
        </p>
      </div>
    </div>
  );
}