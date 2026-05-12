'use client';

import { useState, useEffect } from 'react';
import { Gift, AlertTriangle, TrendingUp } from 'lucide-react';
import { PointsHistoryCard } from '@/components/store/account/PointsHistoryCard';
import type { PointsHistory } from '@/lib/db/schema';

interface PointsData {
  balance: number;
  history: PointsHistory[];
  expiringCount: number;
}

export default function AccountPointsPage() {
  const [data, setData] = useState<PointsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPoints();
  }, []);

  const fetchPoints = async () => {
    try {
      const res = await fetch('/api/account/points');
      const response = await res.json();
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch points:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatIDR = (points: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(points);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Poin Saya</h1>
        <p className="text-text-secondary text-sm mt-1">Kelola poin loyalty kamu</p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-brand-red to-brand-red-dark rounded-card p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Saldo Poin</p>
            <p className="text-4xl font-bold mt-1">{data?.balance || 0}</p>
            <p className="text-sm opacity-70 mt-1">
              ~{formatIDR(data?.balance || 0)} bisa ditukarkan
            </p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Gift className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Expiring Alert */}
      {data?.expiringCount && data.expiringCount > 0 && (
        <div className="bg-warning-light border border-warning/30 rounded-card p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-text-primary">Poin Segera Kedaluwarsa</p>
              <p className="text-sm text-text-secondary mt-1">
                {data.expiringCount} poin kamu akan kedaluwarsa dalam 30 hari ke depan.
                Tukarkan sebelum habis!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How to Earn */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
          Cara Mendapatkan Poin
        </h2>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-success-light rounded-full flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-text-primary">1 poin per Rp 1.000</p>
            <p className="text-sm text-text-secondary mt-1">
              Setiap pembelian akan mendapatkan poin loyalty sesuai total belanja
              (tidak termasuk ongkir dan diskon).
            </p>
          </div>
        </div>
      </div>

      {/* Points History */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
          Riwayat Poin
        </h2>

        {data?.history && data.history.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-text-disabled" />
            </div>
            <p className="text-text-secondary">Belum ada riwayat poin</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.history.map(transaction => (
              <PointsHistoryCard
                key={transaction.id}
                transaction={transaction}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}