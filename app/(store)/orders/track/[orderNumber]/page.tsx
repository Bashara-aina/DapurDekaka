'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Truck, MapPin } from 'lucide-react';
import { formatWIB } from '@/lib/utils/format-date';
import Link from 'next/link';

interface TrackData {
  orderNumber: string;
  status: string;
  dispatchStatus?: string | null;
  customerStatusLabel?: { id: string; en: string };
  shippingTier: string | null;
  deliveryMethod: string;
  courierName: string | null;
  trackingNumber: string | null;
  liveTrackUrl: string | null;
  driverName: string | null;
  driverPhone: string | null;
  estimatedDays: string | null;
  pickupCode: string | null;
  timeline: Array<{
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }>;
}

export default function OrderTrackPage() {
  const t = useTranslations('trackingPage');
  const params = useParams();
  const orderNumber = params.orderNumber as string;

  const [email, setEmail] = useState('');
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/orders/track/${orderNumber}?email=${encodeURIComponent(email)}`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? t('notFound'));
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-8">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        <Link href="/" className="text-sm text-brand-red hover:underline mb-4 inline-block">
          ← {t('backHome')}
        </Link>

        <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
          {t('title')}
        </h1>
        <p className="text-text-secondary text-sm mb-6">
          {t('orderLabel')}: <span className="font-mono font-semibold">{orderNumber}</span>
        </p>

        {!data && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleTrack} className="space-y-4">
                <div>
                  <Label htmlFor="email">{t('emailLabel')}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="mt-1"
                  />
                </div>
                {error && <p className="text-sm text-brand-red">{error}</p>}
                <Button
                  type="submit"
                  className="w-full bg-brand-red hover:bg-brand-red-dark"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('loading')}
                    </>
                  ) : (
                    t('trackButton')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-brand-red" />
                  {t('statusLabel')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge className="bg-brand-red">
                  {data.customerStatusLabel?.id ?? data.status.toUpperCase()}
                </Badge>
                {data.shippingTier && (
                  <p className="text-sm text-text-secondary">
                    {t('tier')}: {data.shippingTier}
                  </p>
                )}
                {data.deliveryMethod === 'pickup' && data.pickupCode && (
                  <p className="text-sm">
                    {t('pickupCode')}: <span className="font-bold text-brand-red">{data.pickupCode}</span>
                  </p>
                )}
                {data.courierName && (
                  <p className="text-sm flex items-center gap-1">
                    <Truck className="w-4 h-4" /> {data.courierName}
                  </p>
                )}
                {data.trackingNumber && (
                  <p className="text-sm font-mono">{t('awb')}: {data.trackingNumber}</p>
                )}
                {data.liveTrackUrl && (
                  <a
                    href={data.liveTrackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand-red underline"
                  >
                    <MapPin className="w-4 h-4" /> {t('liveTrack')}
                  </a>
                )}
                {data.driverName && (
                  <p className="text-sm text-text-secondary">
                    {t('driver')}: {data.driverName} {data.driverPhone ? `(${data.driverPhone})` : ''}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t('timeline')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {data.timeline.map((entry, idx) => (
                    <li key={idx} className="border-l-2 border-brand-cream-dark pl-4">
                      <p className="text-sm font-medium">{entry.toStatus}</p>
                      {entry.note && (
                        <p className="text-xs text-text-muted">{entry.note}</p>
                      )}
                      <p className="text-xs text-text-muted">
                        {formatWIB(new Date(entry.createdAt))}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Button variant="outline" className="w-full" onClick={() => setData(null)}>
              {t('trackAnother')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
