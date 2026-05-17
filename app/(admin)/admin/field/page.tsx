'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, Truck, Warehouse, CheckCircle, RefreshCw, Plus,
  ClipboardList, AlertTriangle, ShoppingBag
} from 'lucide-react';
import { formatWIB } from '@/lib/utils/format-date';
import { cn } from '@/lib/utils/cn';

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  productNameId: string;
  variantNameId: string;
  quantity: number;
  weightGram: number;
  sku?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  paidAt: Date | null;
  recipientName: string;
  items: OrderItem[];
  courierCode: string | null;
  courierService: string | null;
  district: string | null;
  customerNote: string | null;
  deliveryMethod: string;
  pickupCode?: string | null;
}

interface InventoryItem {
  id: string;
  productNameId: string;
  variantNameId: string;
  sku: string;
  stock: number;
  stockLevel: 'out' | 'low' | 'healthy';
  weightGram: number;
  isActive: boolean;
}

interface TodaySummary {
  packedCount: number;
  trackingCount: number;
  pickupCount: number;
  inventoryUpdateCount: number;
  date: string;
}

interface WorkerActivity {
  orderActivity: Array<{
    id: string;
    orderId: string;
    orderNumber?: string;
    fromStatus: string | null;
    toStatus: string;
    changedByUserId: string | null;
    changedByType: string;
    note: string | null;
    createdAt: Date;
  }>;
  inventoryActivity: Array<{
    id: string;
    variantId: string;
    variantName?: string;
    changedByUserId: string | null;
    changeType: string;
    quantityBefore: number;
    quantityAfter: number;
    quantityDelta: number;
    note: string | null;
    createdAt: Date;
  }>;
  date: string;
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchPackingQueue(): Promise<Order[]> {
  const res = await fetch('/api/admin/field/packing-queue');
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchTrackingQueue(): Promise<Order[]> {
  const res = await fetch('/api/admin/field/tracking-queue');
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchPickupQueue(): Promise<Order[]> {
  const res = await fetch('/api/admin/field/pickup-queue');
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchTodaySummary(): Promise<TodaySummary> {
  const res = await fetch('/api/admin/field/today-summary');
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchWorkerActivity(): Promise<WorkerActivity> {
  const res = await fetch('/api/admin/field/worker-activity');
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchInventory(): Promise<InventoryItem[]> {
  const res = await fetch('/api/admin/field/inventory');
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function packOrder(orderId: string, data: { status: string; note?: string; coldChainCondition?: string }) {
  const res = await fetch(`/api/admin/field/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function addTracking(orderId: string, data: { trackingNumber: string; courierCode?: string }) {
  const res = await fetch(`/api/admin/field/orders/${orderId}/tracking`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function deliverPickup(orderId: string) {
  const res = await fetch(`/api/admin/field/orders/${orderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'delivered' }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function restockInventory(data: { variantId: string; quantityAdded: number; note?: string }) {
  const res = await fetch('/api/admin/field/inventory/restock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function adjustInventory(data: { variantId: string; newQuantity: number; reason: string }) {
  const res = await fetch('/api/admin/field/inventory/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTimeSince(dateStr: string | Date | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  return `${h} jam ${m % 60} menit lalu`;
}

function totalWeight(items: OrderItem[]) {
  return items.reduce((s, i) => s + i.weightGram * i.quantity, 0);
}

// ── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAction,
  actionLabel,
  actionIcon: ActionIcon,
  actionVariant = 'default',
}: {
  order: Order;
  onAction?: (order: Order) => void;
  actionLabel?: string;
  actionIcon?: React.ComponentType<{ className?: string }>;
  actionVariant?: 'default' | 'destructive' | 'outline';
}) {
  const isPickup = order.deliveryMethod === 'pickup';
  const paidAt = order.paidAt ? new Date(order.paidAt) : null;
  const ageMs = paidAt ? Date.now() - paidAt.getTime() : 0;
  const ageHours = ageMs / 3600000;

  return (
    <Card className={cn(
      'border',
      ageHours > 8 ? 'border-red-200' : ageHours > 4 ? 'border-amber-200' : 'border-gray-200'
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-bold text-[#1A1A1A]">{order.orderNumber}</p>
            {paidAt && (
              <p className={cn(
                'text-xs mt-0.5',
                ageHours > 8 ? 'text-red-500 font-medium' : ageHours > 4 ? 'text-amber-500' : 'text-gray-400'
              )}>
                {ageHours > 4 && '⚠ '}Bayar {getTimeSince(order.paidAt as Date)}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {isPickup ? '🏠 Ambil Sendiri' : '🚚 Delivery'}
          </Badge>
        </div>

        {/* Item list */}
        <div className="space-y-1 border-y border-gray-100 py-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.productNameId} <span className="text-gray-400">({item.variantNameId})</span>
              </span>
              <span className="font-semibold text-[#1A1A1A]">×{item.quantity}</span>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-1">Total berat: ~{totalWeight(order.items).toLocaleString()}g</p>
        </div>

        {/* Delivery info */}
        {!isPickup && (
          <div className="text-xs space-y-0.5">
            {(order.courierCode || order.courierService) && (
              <p className="text-gray-600 font-medium">🚚 {[order.courierCode, order.courierService].filter(Boolean).join(' ')}</p>
            )}
            {order.district && <p className="text-gray-500">📍 {order.district}</p>}
          </div>
        )}
        {isPickup && order.pickupCode && (
          <p className="text-xs text-blue-600 font-medium">🏷 Kode Ambil: <span className="font-mono">{order.pickupCode}</span></p>
        )}

        {/* Customer note */}
        {order.customerNote && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-xs text-yellow-800">📝 {order.customerNote}</p>
          </div>
        )}

        {/* Action */}
        {onAction && actionLabel && (
          <Button
            variant={actionVariant}
            className="w-full min-h-[48px] font-semibold"
            onClick={() => onAction(order)}
          >
            {ActionIcon && <ActionIcon className="w-4 h-4 mr-2" />}
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Bottom Sheet / Dialog (custom minimal) ────────────────────────────────────

function BottomSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl lg:rounded-2xl p-5 max-w-md w-full mx-auto shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1A1A1A]">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Packing Tab ───────────────────────────────────────────────────────────────

function PackingTab() {
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['field', 'packing-queue'],
    queryFn: fetchPackingQueue,
    refetchInterval: 30000,
  });

  const { mutateAsync: packMutate, isPending: isPacking } = useMutation({
    mutationFn: ({ orderId, note, coldChain }: { orderId: string; note?: string; coldChain?: string }) =>
      packOrder(orderId, { status: 'packed', note, coldChainCondition: coldChain }),
    onSuccess: () => refetch(),
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [note, setNote] = useState('');
  const [coldChain, setColdChain] = useState('baik');
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  const openModal = (order: Order) => {
    setSelectedOrder(order);
    setNote('');
    setColdChain('baik');
    setCheckedItems(new Set());
  };

  const allChecked = selectedOrder ? checkedItems.size === selectedOrder.items.length : false;

  const handlePack = async () => {
    if (!selectedOrder) return;
    await packMutate({ orderId: selectedOrder.id, note, coldChain });
    setSelectedOrder(null);
  };

  const toggleItem = (idx: number) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Antrian Packing
          <span className="ml-2 text-sm font-normal text-gray-500">({orders?.length ?? 0} pesanan)</span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="font-medium text-gray-600">Semua pesanan sudah dikemas!</p>
            <p className="text-sm text-gray-400 mt-1">Kamu bisa cek inventori atau istirahat dulu ☕</p>
          </CardContent>
        </Card>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            actionLabel="✅ Tandai Selesai Dikemas"
            actionIcon={CheckCircle}
            onAction={openModal}
          />
        ))
      )}

      <BottomSheet
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Kemas ${selectedOrder?.orderNumber}`}
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Checklist Item</p>
            <div className="space-y-2">
              {selectedOrder?.items.map((item, idx) => (
                <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(idx)}
                    onChange={() => toggleItem(idx)}
                    className="w-5 h-5 accent-green-500"
                  />
                  <span className={cn('text-sm', checkedItems.has(idx) && 'line-through text-gray-400')}>
                    {item.productNameId} ({item.variantNameId}) ×{item.quantity}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="coldChain" className="text-xs font-semibold text-gray-500 uppercase">Kondisi Cold Chain</Label>
            <select
              id="coldChain"
              value={coldChain}
              onChange={e => setColdChain(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="baik">Baik</option>
              <option value="perlu_tambah_es">Perlu Tambah Es</option>
              <option value="rusak">Rusak (laporkan ke admin)</option>
            </select>
          </div>

          <div>
            <Label htmlFor="note" className="text-xs font-semibold text-gray-500 uppercase">Catatan (opsional)</Label>
            <Input
              id="note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Kondisi kemasan, catatan khusus..."
              className="mt-1"
            />
          </div>

          {!allChecked && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠ Centang semua item sebelum konfirmasi
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedOrder(null)}>
              Batal
            </Button>
            <Button
              className="flex-1 min-h-[48px] font-semibold"
              onClick={handlePack}
              disabled={isPacking || !allChecked}
            >
              {isPacking ? 'Menyimpan…' : '✅ Konfirmasi Kemas'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ── Tracking Tab ──────────────────────────────────────────────────────────────

function TrackingTab() {
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['field', 'tracking-queue'],
    queryFn: fetchTrackingQueue,
    refetchInterval: 30000,
  });

  const { mutateAsync: trackingMutate, isPending: isTracking } = useMutation({
    mutationFn: ({ orderId, trackingNumber, courierCode }: { orderId: string; trackingNumber: string; courierCode?: string }) =>
      addTracking(orderId, { trackingNumber, courierCode }),
    onSuccess: () => refetch(),
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierCode, setCourierCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const trimmed = trackingNumber.trim().toUpperCase();
    if (trimmed.length < 8) {
      setError('Nomor resi minimal 8 karakter');
      return;
    }
    if (!selectedOrder) return;
    await trackingMutate({
      orderId: selectedOrder.id,
      trackingNumber: trimmed,
      courierCode: courierCode || undefined,
    });
    setSelectedOrder(null);
    setTrackingNumber('');
    setCourierCode('');
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-44 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Perlu Nomor Resi
          <span className="ml-2 text-sm font-normal text-gray-500">({orders?.length ?? 0} pesanan)</span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Truck className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="font-medium text-gray-600">Semua pesanan sudah ada resi!</p>
          </CardContent>
        </Card>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            actionLabel="📦 Input Nomor Resi"
            actionIcon={Truck}
            onAction={o => { setSelectedOrder(o); setTrackingNumber(''); setCourierCode(''); setError(''); }}
          />
        ))
      )}

      <BottomSheet
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Input Resi ${selectedOrder?.orderNumber}`}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              Kurir: <span className="font-medium">{[selectedOrder?.courierCode, selectedOrder?.courierService].filter(Boolean).join(' ') || '—'}</span>
            </p>
          </div>
          <div>
            <Label htmlFor="tracking" className="text-xs font-semibold text-gray-500 uppercase">Nomor Resi *</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value.toUpperCase())}
              placeholder="Ketik atau scan resi..."
              className="mt-1 font-mono text-base"
              inputMode="text"
              autoComplete="off"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div>
            <Label htmlFor="courier" className="text-xs font-semibold text-gray-500 uppercase">Override Kurir (opsional)</Label>
            <Input
              id="courier"
              value={courierCode}
              onChange={e => setCourierCode(e.target.value)}
              placeholder="Contoh: JNE, J&T, SiCepat"
              className="mt-1"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedOrder(null)}>
              Batal
            </Button>
            <Button
              className="flex-1 min-h-[48px] font-semibold"
              onClick={handleSubmit}
              disabled={isTracking || !trackingNumber.trim()}
            >
              {isTracking ? 'Menyimpan…' : '✅ Simpan Resi'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ── Pickup Tab ────────────────────────────────────────────────────────────────

function PickupTab() {
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['field', 'pickup-queue'],
    queryFn: fetchPickupQueue,
    refetchInterval: 30000,
  });

  const { mutateAsync: deliverMutate, isPending: isDelivering } = useMutation({
    mutationFn: (orderId: string) => deliverPickup(orderId),
    onSuccess: () => refetch(),
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [codeError, setCodeError] = useState('');

  const handleDeliver = async () => {
    if (!selectedOrder) return;
    if (selectedOrder.pickupCode && inputCode.trim().toUpperCase() !== selectedOrder.pickupCode.toUpperCase()) {
      setCodeError('Kode tidak cocok. Minta pelanggan tunjukkan kode yang benar.');
      return;
    }
    await deliverMutate(selectedOrder.id);
    setSelectedOrder(null);
    setInputCode('');
    setCodeError('');
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Pesanan Ambil Sendiri
          <span className="ml-2 text-sm font-normal text-gray-500">({orders?.length ?? 0} pesanan)</span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">Tidak ada pesanan pickup saat ini</p>
          </CardContent>
        </Card>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            actionLabel="✅ Serahkan ke Pelanggan"
            onAction={o => { setSelectedOrder(o); setInputCode(''); setCodeError(''); }}
          />
        ))
      )}

      <BottomSheet
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Serahkan ${selectedOrder?.orderNumber}`}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              Minta pelanggan menunjukkan kode ambil mereka, lalu masukkan di bawah.
            </p>
          </div>
          {selectedOrder?.pickupCode && (
            <div>
              <Label htmlFor="pickupCode" className="text-xs font-semibold text-gray-500 uppercase">Kode Ambil Pelanggan</Label>
              <Input
                id="pickupCode"
                value={inputCode}
                onChange={e => { setInputCode(e.target.value); setCodeError(''); }}
                placeholder="Masukkan kode dari pelanggan"
                className="mt-1 font-mono text-base uppercase"
              />
              {codeError && (
                <div className="flex items-center gap-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {codeError}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedOrder(null)}>
              Batal
            </Button>
            <Button
              className="flex-1 min-h-[48px] font-semibold"
              onClick={handleDeliver}
              disabled={isDelivering}
            >
              {isDelivering ? 'Menyimpan…' : '✅ Konfirmasi Serahkan'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────

function InventoryTab() {
  const { data: inventory, isLoading, refetch } = useQuery({
    queryKey: ['field', 'inventory'],
    queryFn: fetchInventory,
  });

  const queryClient = useQueryClient();

  const { mutateAsync: restockMutate, isPending: isRestocking } = useMutation({
    mutationFn: restockInventory,
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['field', 'today-summary'] });
    },
  });

  const { mutateAsync: adjustMutate, isPending: isAdjusting } = useMutation({
    mutationFn: adjustInventory,
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['field', 'today-summary'] });
    },
  });

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [actionType, setActionType] = useState<'restock' | 'adjust' | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'out' | 'low'>('all');

  const handleSubmit = async () => {
    if (!selectedItem || !quantity) return;
    if (actionType === 'restock') {
      await restockMutate({ variantId: selectedItem.id, quantityAdded: parseInt(quantity), note: reason || undefined });
    } else if (actionType === 'adjust') {
      if (!reason) return;
      await adjustMutate({ variantId: selectedItem.id, newQuantity: parseInt(quantity), reason });
    }
    setSelectedItem(null);
    setActionType(null);
    setQuantity('');
    setReason('');
  };

  const filteredInventory = inventory?.filter(item => {
    if (filterLevel === 'out') return item.stockLevel === 'out';
    if (filterLevel === 'low') return item.stockLevel === 'low';
    return true;
  });

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Stok Produk</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Semua' },
          { key: 'out', label: '🔴 Habis' },
          { key: 'low', label: '🟡 Menipis' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterLevel(f.key as 'all' | 'out' | 'low')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              filterLevel === f.key ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredInventory?.map(item => (
          <Card key={item.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.productNameId}</p>
                  <p className="text-xs text-gray-400">{item.variantNameId} · {item.sku}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right mr-1">
                    <p className={cn('text-lg font-bold',
                      item.stockLevel === 'out' ? 'text-red-600' :
                      item.stockLevel === 'low' ? 'text-amber-600' : 'text-green-600'
                    )}>
                      {item.stock}
                    </p>
                    <p className="text-xs text-gray-400">unit</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] min-w-[44px] text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => { setSelectedItem(item); setActionType('restock'); setQuantity(''); setReason(''); }}
                    title="Tambah stok"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] min-w-[44px] text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => { setSelectedItem(item); setActionType('adjust'); setQuantity(item.stock.toString()); setReason(''); }}
                    title="Koreksi stok"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredInventory?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-gray-400">
              <p className="text-sm">Tidak ada produk di kategori ini</p>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomSheet
        open={!!selectedItem && !!actionType}
        onClose={() => { setSelectedItem(null); setActionType(null); setQuantity(''); setReason(''); }}
        title={actionType === 'restock' ? 'Tambah Stok' : 'Koreksi Stok'}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-sm">{selectedItem?.productNameId}</p>
            <p className="text-xs text-gray-500">{selectedItem?.variantNameId} · Stok saat ini: <span className="font-bold">{selectedItem?.stock} unit</span></p>
          </div>

          <div>
            <Label htmlFor="qty" className="text-xs font-semibold text-gray-500 uppercase">
              {actionType === 'restock' ? 'Jumlah Ditambahkan' : 'Stok Aktual (setelah hitung ulang)'}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setQuantity(q => Math.max(0, (parseInt(q) || 0) - 1).toString())}
              >−</Button>
              <Input
                id="qty"
                type="number"
                min="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="text-center font-bold text-lg"
              />
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setQuantity(q => ((parseInt(q) || 0) + 1).toString())}
              >+</Button>
            </div>
            {actionType === 'restock' && quantity && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                Stok setelah update: <span className="font-bold text-green-600">{(selectedItem?.stock ?? 0) + parseInt(quantity || '0')} unit</span>
              </p>
            )}
            {actionType === 'adjust' && quantity && parseInt(quantity) !== selectedItem?.stock && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                Selisih: <span className={cn('font-bold', parseInt(quantity) < (selectedItem?.stock ?? 0) ? 'text-red-500' : 'text-green-600')}>
                  {parseInt(quantity) - (selectedItem?.stock ?? 0)} unit
                </span>
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reason" className="text-xs font-semibold text-gray-500 uppercase">
              {actionType === 'adjust' ? 'Alasan Koreksi *' : 'Catatan (opsional)'}
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={actionType === 'adjust' ? 'Contoh: Rusak/tidak layak jual' : 'Contoh: Kiriman supplier 14 Mei'}
              className="mt-1"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setSelectedItem(null); setActionType(null); }}>
              Batal
            </Button>
            <Button
              className="flex-1 min-h-[48px] font-semibold"
              onClick={handleSubmit}
              disabled={isRestocking || isAdjusting || !quantity || (actionType === 'adjust' && !reason)}
            >
              {isRestocking || isAdjusting ? 'Menyimpan…' : '✅ Simpan'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ── Completed Tab ─────────────────────────────────────────────────────────────

function CompletedTab() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['field', 'today-summary'],
    queryFn: fetchTodaySummary,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['field', 'worker-activity'],
    queryFn: fetchWorkerActivity,
  });

  if (summaryLoading || activityLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">Rekap Hari Ini</h2>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Package, label: 'Dikemas', value: summary?.packedCount ?? 0, color: 'text-blue-500' },
          { icon: Truck, label: 'Diresi', value: summary?.trackingCount ?? 0, color: 'text-green-500' },
          { icon: CheckCircle, label: 'Pickup Selesai', value: summary?.pickupCount ?? 0, color: 'text-emerald-500' },
          { icon: Warehouse, label: 'Update Stok', value: summary?.inventoryUpdateCount ?? 0, color: 'text-purple-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <Icon className={cn('w-8 h-8 mx-auto mb-2', color)} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Aktivitas Terakhir</h3>
        <Card>
          <CardContent className="p-4">
            {activity?.orderActivity.length === 0 && activity?.inventoryActivity.length === 0 ? (
              <p className="text-center text-gray-400 py-4 text-sm">Belum ada aktivitas hari ini</p>
            ) : (
              <div className="space-y-3">
                {activity?.orderActivity.map(item => (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 shrink-0">
                      {item.toStatus === 'packed' ? (
                        <Package className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Truck className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700">
                        {item.orderNumber && <span className="font-mono font-semibold text-xs text-gray-500">{item.orderNumber} — </span>}
                        Status → <span className="font-medium">{item.toStatus}</span>
                      </p>
                      <p className="text-xs text-gray-400">{formatWIB(new Date(item.createdAt))}</p>
                    </div>
                  </div>
                ))}
                {activity?.inventoryActivity.map(item => (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 shrink-0">
                      <Warehouse className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700">
                        {item.variantName && <span className="font-medium">{item.variantName} — </span>}
                        Stok {item.changeType}: {item.quantityBefore} → {item.quantityAfter}
                        {item.note && <span className="text-gray-400"> ({item.note})</span>}
                      </p>
                      <p className="text-xs text-gray-400">{formatWIB(new Date(item.createdAt))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'packing', label: 'Packing', icon: Package, summaryKey: 'packedQueue' },
  { key: 'tracking', label: 'Kirim', icon: Truck, summaryKey: 'trackingQueue' },
  { key: 'pickup', label: 'Pickup', icon: ShoppingBag, summaryKey: 'pickupQueue' },
  { key: 'inventory', label: 'Stok', icon: Warehouse },
  { key: 'completed', label: 'Selesai', icon: CheckCircle },
];

export default function FieldDashboardPage() {
  const [activeTab, setActiveTab] = useState('packing');

  const { data: summary } = useQuery({
    queryKey: ['field', 'today-summary'],
    queryFn: fetchTodaySummary,
    refetchInterval: 60000,
  });

  const { data: packingQueue } = useQuery({
    queryKey: ['field', 'packing-queue'],
    queryFn: fetchPackingQueue,
    refetchInterval: 30000,
  });

  const { data: trackingQueue } = useQuery({
    queryKey: ['field', 'tracking-queue'],
    queryFn: fetchTrackingQueue,
    refetchInterval: 30000,
  });

  const { data: pickupQueue } = useQuery({
    queryKey: ['field', 'pickup-queue'],
    queryFn: fetchPickupQueue,
    refetchInterval: 30000,
  });

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-4 max-w-xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">🍜 Dashboard Gudang</h1>
          <p className="text-xs text-gray-500">{today}</p>
        </div>
      </div>

      {/* Tugas Hari Ini Summary Card */}
      <Card className="border-blue-100 bg-blue-50">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase mb-3">Tugas Hari Ini</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <button
              onClick={() => setActiveTab('packing')}
              className="hover:opacity-80 transition-opacity"
            >
              <p className="text-2xl font-bold text-blue-700">{packingQueue?.length ?? 0}</p>
              <p className="text-xs text-blue-600">📦 Perlu Dikemas</p>
            </button>
            <button
              onClick={() => setActiveTab('tracking')}
              className="hover:opacity-80 transition-opacity"
            >
              <p className="text-2xl font-bold text-indigo-700">{trackingQueue?.length ?? 0}</p>
              <p className="text-xs text-indigo-600">🚚 Perlu Resi</p>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className="hover:opacity-80 transition-opacity"
            >
              <p className="text-2xl font-bold text-green-700">{summary?.packedCount ?? 0}</p>
              <p className="text-xs text-green-600">✅ Selesai</p>
            </button>
          </div>
          {(packingQueue?.length ?? 0) > 0 && (
            <p className="text-xs text-blue-500 text-center mt-3 border-t border-blue-200 pt-2">
              Est. waktu packing: ~{((packingQueue?.length ?? 0) * 10)} menit
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const badge = tab.key === 'packing' ? packingQueue?.length :
                        tab.key === 'tracking' ? trackingQueue?.length :
                        tab.key === 'pickup' ? pickupQueue?.length : undefined;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-xs font-medium transition-all relative min-h-[52px]',
                activeTab === tab.key
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {badge !== undefined && badge > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'packing' && <PackingTab />}
        {activeTab === 'tracking' && <TrackingTab />}
        {activeTab === 'pickup' && <PickupTab />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'completed' && <CompletedTab />}
      </div>
    </div>
  );
}
