'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Gift, AlertTriangle, TrendingUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { PointsHistoryCard } from '@/components/store/account/PointsHistoryCard';
import type { PointsHistory } from '@/lib/db/schema';
import { formatIDR } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

interface PointsData {
  balance: number;
  history: PointsHistory[];
  expiringCount: number;
  expiringPoints: number;
  total: number;
}

export default function AccountPointsPage() {
  const t = useTranslations('account');
  const [data, setData] = useState<PointsData | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchPoints = useCallback(async (pageNum: number) => {
    try {
      const res = await fetch(`/api/account/points?page=${pageNum}&limit=20`);
      const response = await res.json();
      if (response.success) {
        setData(prev => pageNum === 1
          ? response.data
          : {
            ...response.data,
            history: [...(prev?.history || []), ...response.data.history]
          }
        );
        setHasMore(response.data.history.length === 20);
      }
    } catch {
      toast.error(t('loadPointsError') || 'Gagal memuat poin');
    } finally {
      if (pageNum === 1) {
        setIsInitialLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [t]);

  useEffect(() => {
    fetchPoints(page);
  }, [page, fetchPoints]);

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">{t('myPoints')}</h1>
        <p className="text-text-secondary text-sm mt-1">{t('pointsBalance')}</p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-brand-red to-brand-red-dark rounded-card p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{t('pointsBalance')}</p>
            <p className="text-4xl font-bold mt-1">{data?.balance || 0}</p>
            <p className="text-sm opacity-70 mt-1">
              ~{formatIDR((data?.balance || 0) * 10)} {t('canRedeem')}
            </p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Gift className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Redemption Info */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-2">{t('howToRedeem')}</h2>
        <p className="text-sm text-text-secondary mb-4">
          {t('howToRedeemDesc')}
        </p>
        <Link
          href="/products"
          className="block w-full h-11 bg-brand-red text-white rounded-button text-center leading-[44px] font-bold hover:bg-brand-red-dark transition-colors"
        >
          {t('shopNow')}
        </Link>
      </div>

      {/* Expiring Alert */}
      {data?.expiringPoints && data.expiringPoints > 0 && (
        <div className="bg-warning-light border border-warning/30 rounded-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-text-primary">{t('pointsWarningExpiring')}</p>
              <p className="text-sm text-text-secondary mt-1">
                {t('pointsExpiringMessage', { points: data.expiringPoints.toLocaleString('id-ID') })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How to Earn */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
          {t('howToEarn')}
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-success-light rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-text-primary">{t('pointsPerThousand')}</p>
              <p className="text-sm text-text-secondary mt-1">
                {t('pointsPerThousandDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-text-primary">{t('registrationBonus')}</p>
              <p className="text-sm text-text-secondary mt-1">
                {t('registrationBonusDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-text-primary">{t('b2bBonus')}</p>
              <p className="text-sm text-text-secondary mt-1">
                {t('b2bBonusDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Points History */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
          {t('pointsHistory')}
        </h2>

        {data?.history && data.history.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-text-disabled" />
            </div>
            <p className="text-text-secondary">{t('noPointsHistory')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.history.map(transaction => (
              <PointsHistoryCard
                key={transaction.id}
                transaction={transaction}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => {
                  setIsLoadingMore(true);
                  setPage(p => p + 1);
                }}
                disabled={isLoadingMore}
                className="flex items-center justify-center gap-2 w-full h-11 border border-brand-cream-dark rounded-lg text-sm font-medium text-text-secondary hover:bg-brand-cream transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? t('loading') : t('showMore')}
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}