'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Package, Truck, ClipboardList, CheckCircle2, ChevronLeft, Search, Minus, Plus, X, Camera, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { formatWIB } from '@/lib/utils/format-date';

interface OrderItem {
  productNameId: string;
  variantNameId: string;
  quantity: number;
  sku: string;
  weightGram: number;
}

interface PackingOrder {
  id: string;
  orderNumber: string;
  paidAt: string | null;
  items: OrderItem[];
  totalWeight: number;
  courierCode: string | null;
  courierService: string | null;
  courierName: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  addressLine: string | null;
  customerNote: string | null;
  deliveryMethod: string;
  requiresColdChain: boolean;
  recipientName: string;
  pickupCode: string | null;
}

interface TrackingOrder {
  id: string;
  orderNumber: string;
  packedAt: string | null;
  items: Pick<OrderItem, 'productNameId' | 'variantNameId' | 'quantity'>[];
  totalWeight: number;
  courierCode: string | null;
  courierService: string | null;
  courierName: string | null;
  district: string | null;
  city: string | null;
  recipientName: string;
  deliveryMethod: string;
}

interface PickupOrder {
  id: string;
  orderNumber: string;
  pickupCode: string | null;
  status: string;
  createdAt: string;
  items: Pick<OrderItem, 'productNameId' | 'variantNameId' | 'quantity'>[];
  recipientName: string;
}

interface InventoryItem {
  id: string;
  nameId: string;
  sku: string;
  stock: number;
  weightGram: number;
  productNameId: string | null;
}

interface WorkerSummary {
  packedToday: number;
  shippedToday: number;
  deliveredPickupToday: number;
  workerPackedCount: number;
  inventoryUpdatesToday: number;
  recentActivity: {
    orderNumber: string;
    status: string;
    updatedAt: string;
    courierCode: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    deliveryMethod: string;
  }[];
}

type Tab = 'packing' | 'tracking' | 'inventory' | 'completed';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'packing', label: 'Packing', icon: <Package className="w-4 h-4" /> },
  { id: 'tracking', label: 'Pengiriman', icon: <Truck className="w-4 h-4" /> },
  { id: 'inventory', label: 'Inventori', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'completed', label: 'Selesai', icon: <CheckCircle2 className="w-4 h-4" /> },
];

function formatRelativeTime(date: string | null): string {
  if (!date) return '-';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j ${minutes % 60}m lalu`;
  return `${Math.floor(hours / 24)}d lalu`;
}

export default function FieldWorkerDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('packing');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PackingOrder | TrackingOrder | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: packingData, isLoading: packingLoading } = useQuery({
    queryKey: ['packing-queue'],
    queryFn: async () => {
      const res = await fetch('/api/admin/field/packing-queue');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as PackingOrder[];
    },
    refetchInterval: 30000,
  });

  const { data: trackingData, isLoading: trackingLoading } = useQuery({
    queryKey: ['tracking-queue'],
    queryFn: async () => {
      const res = await fetch('/api/admin/field/tracking-queue');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as TrackingOrder[];
    },
    refetchInterval: 30000,
  });

  const { data: pickupData, isLoading: pickupLoading } = useQuery({
    queryKey: ['pickup-queue'],
    queryFn: async () => {
      const res = await fetch('/api/admin/field/pickup-queue');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as PickupOrder[];
    },
    refetchInterval: 30000,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['field-inventory'],
    queryFn: async () => {
      const res = await fetch('/api/admin/field/inventory');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as InventoryItem[];
    },
    refetchInterval: 60000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['today-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/field/today-summary');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as WorkerSummary;
    },
    refetchInterval: 60000,
  });

  const queryClient = useQueryClient();

  const markPackedMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'packed' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packing-queue'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tracking-queue'] });
    },
  });

  const confirmPickupMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickup-queue'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
    },
  });

  const saveTrackingMutation = useMutation({
    mutationFn: async ({ orderId, trackingNumber, courierCode }: { orderId: string; trackingNumber: string; courierCode?: string }) => {
      const res = await fetch(`/api/admin/field/orders/${orderId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, courierCode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracking-queue'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
    },
  });

  const restockMutation = useMutation({
    mutationFn: async ({ variantId, quantityAdded, note }: { variantId: string; quantityAdded: number; note?: string }) => {
      const res = await fetch('/api/admin/field/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, quantityAdded, note }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
      setShowRestockModal(false);
      setSelectedInventoryItem(null);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ variantId, newQuantity, reason }: { variantId: string; newQuantity: number; reason: string }) => {
      const res = await fetch('/api/admin/field/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, newQuantity, reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['today-summary'] });
      setShowAdjustModal(false);
      setSelectedInventoryItem(null);
    },
  });

  const packingCount = summaryData?.packedToday ?? 0;
  const trackingCount = (trackingData?.length ?? 0) + (pickupData?.length ?? 0);
  const inventoryAlerts = inventoryData?.filter(i => i.stock === 0 || i.stock < 10).length ?? 0;

  const filteredPackingOrders = packingData?.filter(o => 
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const filteredTrackingOrders = trackingData?.filter(o =>
    o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🍜</span>
            <span className="font-bold text-[#1A1A1A]">DapurDekaka — Gudang</span>
          </div>
          <button className="relative p-2">
            <Bell className="w-5 h-5 text-gray-600" />
            {packingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-brand-red rounded-full" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Halo, Worker 👋</span>
          <span>{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="bg-white mx-4 mt-4 rounded-xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-sm text-gray-500 mb-3">TUGAS HARI INI</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-brand-red">{packingCount}</p>
            <p className="text-xs text-gray-500 mt-1">Perlu Dikemas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-500">{trackingCount}</p>
            <p className="text-xs text-gray-500 mt-1">Perlu Resi</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{summaryData?.workerPackedCount ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Selesai</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 px-4 mt-4 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              activeTab === tab.id
                ? 'bg-brand-red text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'packing' && packingCount > 0 && (
              <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{packingCount}</span>
            )}
            {tab.id === 'tracking' && trackingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{trackingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor pesanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-4 space-y-4">
        {activeTab === 'packing' && (
          <>
            {packingLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredPackingOrders.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <span className="text-4xl">📭</span>
                <p className="mt-3 font-medium text-gray-600">Tidak ada pesanan yang perlu dikemas</p>
                <p className="text-sm text-gray-400 mt-1">Semua pesanan sudah diproses!</p>
              </div>
            ) : (
              filteredPackingOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onMarkPacked={() => markPackedMutation.mutate(order.id)}
                  isPacking
                />
              ))
            )}
          </>
        )}

        {activeTab === 'tracking' && (
          <>
            {pickupData && pickupData.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-500 mb-3">PESANAN AMBIL SENDIRI</h3>
                {pickupData.map(order => (
                  <PickupOrderCard
                    key={order.id}
                    order={order}
                    onConfirm={() => confirmPickupMutation.mutate(order.id)}
                  />
                ))}
              </div>
            )}
            {trackingLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredTrackingOrders.length === 0 && pickupData?.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <span className="text-4xl">📭</span>
                <p className="mt-3 font-medium text-gray-600">Tidak ada pesanan yang perlu resi</p>
              </div>
            ) : (
              filteredTrackingOrders.map(order => (
                <TrackingOrderCard
                  key={order.id}
                  order={order}
                  onSaveTracking={(tn, cc) => saveTrackingMutation.mutate({ orderId: order.id, trackingNumber: tn, courierCode: cc })}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'inventory' && (
          <>
            {inventoryLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : (
              <InventoryList
                items={inventoryData ?? []}
                onRestock={(item) => {
                  setSelectedInventoryItem(item);
                  setShowRestockModal(true);
                }}
                onAdjust={(item) => {
                  setSelectedInventoryItem(item);
                  setShowAdjustModal(true);
                }}
              />
            )}
          </>
        )}

        {activeTab === 'completed' && (
          <CompletedSection data={summaryData} />
        )}
      </div>

      {/* Restock Modal */}
      {showRestockModal && selectedInventoryItem && (
        <RestockModal
          item={selectedInventoryItem}
          onClose={() => {
            setShowRestockModal(false);
            setSelectedInventoryItem(null);
          }}
          onConfirm={(quantity, note) => {
            restockMutation.mutate({ variantId: selectedInventoryItem.id, quantityAdded: quantity, note });
          }}
          isLoading={restockMutation.isPending}
        />
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedInventoryItem && (
        <AdjustModal
          item={selectedInventoryItem}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedInventoryItem(null);
          }}
          onConfirm={(newQuantity, reason) => {
            adjustMutation.mutate({ variantId: selectedInventoryItem.id, newQuantity, reason });
          }}
          isLoading={adjustMutation.isPending}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onMarkPacked, isPacking }: { order: PackingOrder; onMarkPacked: () => void; isPacking?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-[#1A1A1A]">{order.orderNumber}</span>
        <span className="text-xs text-gray-400">{formatRelativeTime(order.paidAt)}</span>
      </div>
      
      <div className="space-y-1 mb-3">
        {order.items.map((item, idx) => (
          <p key={idx} className="text-sm text-gray-600">
            {item.quantity}× {item.productNameId} ({item.variantNameId})
          </p>
        ))}
      </div>

      <div className="text-xs text-gray-400 mb-2">
        📦 {order.totalWeight.toLocaleString('id-ID')} gram
        {order.courierName && <span className="ml-2">🚚 {order.courierName}</span>}
        {order.district && <span className="ml-2">— {order.district}</span>}
      </div>

      {order.requiresColdChain && (
        <div className="bg-blue-50 text-blue-600 text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-2">
          ❄️ PERLU DRY ICE (zona: luar kota)
        </div>
      )}

      {order.customerNote && (
        <p className="text-xs text-gray-500 italic mb-3">📝 {order.customerNote}</p>
      )}

      {isPacking && (
        <Button
          onClick={onMarkPacked}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          ✅ TANDAI SELESAI DIKEMAS
        </Button>
      )}
    </div>
  );
}

function TrackingOrderCard({ order, onSaveTracking }: { order: TrackingOrder; onSaveTracking: (tn: string, cc?: string) => void }) {
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleSubmit = () => {
    if (trackingNumber.length >= 8) {
      onSaveTracking(trackingNumber, order.courierCode ?? undefined);
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-[#1A1A1A]">{order.orderNumber}</span>
        <span className="text-xs text-gray-400">{formatRelativeTime(order.packedAt)}</span>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        {order.items.map((item, idx) => (
          <span key={idx}>{item.quantity}× {item.productNameId}{idx < order.items.length - 1 ? ', ' : ''}</span>
        ))}
      </div>

      <div className="text-xs text-gray-400 mb-3">
        🚚 {order.courierName ?? order.courierCode ?? '-'} → {order.district ?? order.city ?? '-'}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
          placeholder="Ketik nomor resi..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20"
        />
        <Button size="sm" variant="outline" className="px-3">
          <Camera className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={trackingNumber.length < 8}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          ✅
        </Button>
      </div>
    </div>
  );
}

function PickupOrderCard({ order, onConfirm }: { order: PickupOrder; onConfirm: () => void }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-[#1A1A1A]">{order.orderNumber}</span>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Pickup</span>
      </div>

      <div className="text-sm text-gray-600 mb-2">
        {order.items.map((item, idx) => (
          <span key={idx}>{item.quantity}× {item.productNameId}{idx < order.items.length - 1 ? ', ' : ''}</span>
        ))}
      </div>

      <div className="bg-amber-50 text-amber-700 text-sm px-3 py-2 rounded-lg mb-3">
        Kode Ambbil: <span className="font-bold">{order.pickupCode}</span>
      </div>

      <Button
        onClick={onConfirm}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
      >
        ✅ SERAHKAN KE PELANGGAN
      </Button>
    </div>
  );
}

function InventoryList({ items, onRestock, onAdjust }: { items: InventoryItem[]; onRestock: (item: InventoryItem) => void; onAdjust: (item: InventoryItem) => void }) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <span className="text-4xl">✅</span>
          <p className="mt-3 font-medium text-gray-600">Semua stok dalam kondisi sehat</p>
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1A1A1A]">{item.nameId}</p>
                <p className="text-xs text-gray-400">{item.productNameId} · {item.sku}</p>
              </div>
              <div className="text-right">
                <p className={cn(
                  'text-lg font-bold',
                  item.stock === 0 ? 'text-red-500' : item.stock < 10 ? 'text-amber-500' : 'text-green-600'
                )}>
                  {item.stock} unit
                </p>
                <p className="text-xs text-gray-400">{item.weightGram}g</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRestock(item)}
                className="flex-1"
              >
                + Restock
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAdjust(item)}
                className="flex-1"
              >
                Koreksi
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RestockModal({ item, onClose, onConfirm, isLoading }: { item: InventoryItem; onClose: () => void; onConfirm: (quantity: number, note?: string) => void; isLoading: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Tambah Stok</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-gray-500 mb-1">{item.productNameId}</p>
        <p className="font-medium mb-4">{item.nameId}</p>
        <p className="text-sm text-gray-500 mb-4">Stok saat ini: <span className="font-bold text-[#1A1A1A]">{item.stock} unit</span></p>

        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold"
          >
            <Minus className="w-5 h-5" />
          </button>
          <span className="text-3xl font-bold w-20 text-center">{quantity}</span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4 text-center">
          Stok setelah update: <span className="font-bold text-green-600">{item.stock + quantity}</span> unit
        </p>

        <input
          type="text"
          placeholder="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm mb-4"
        />

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">BATAL</Button>
          <Button
            onClick={() => onConfirm(quantity, note)}
            disabled={isLoading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Menyimpan...' : '✅ SIMPAN RESTOCK'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({ item, onClose, onConfirm, isLoading }: { item: InventoryItem; onClose: () => void; onConfirm: (newQuantity: number, reason: string) => void; isLoading: boolean }) {
  const [newQuantity, setNewQuantity] = useState(item.stock);
  const [reason, setReason] = useState('');

  const diff = newQuantity - item.stock;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Koreksi Stok</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <p className="text-sm text-gray-500 mb-1">{item.productNameId}</p>
        <p className="font-medium mb-4">{item.nameId}</p>
        <p className="text-sm text-gray-500 mb-4">Stok sistem: <span className="font-bold text-[#1A1A1A]">{item.stock} unit</span></p>

        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => setNewQuantity(Math.max(0, newQuantity - 1))}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold"
          >
            <Minus className="w-5 h-5" />
          </button>
          <span className="text-3xl font-bold w-20 text-center">{newQuantity}</span>
          <button
            onClick={() => setNewQuantity(newQuantity + 1)}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl font-bold"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <p className={cn(
          'text-sm mb-4 text-center',
          diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500'
        )}>
          Selisih: {diff > 0 ? '+' : ''}{diff} unit
        </p>

        <input
          type="text"
          placeholder="Alasan koreksi (wajib diisi)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm mb-4"
        />

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">BATAL</Button>
          <Button
            onClick={() => onConfirm(newQuantity, reason)}
            disabled={isLoading || !reason}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Menyimpan...' : '✅ SIMPAN KOREKSI'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CompletedSection({ data }: { data: WorkerSummary | undefined }) {
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4">
        <h3 className="font-semibold text-gray-500 mb-3">SELESAI HARI INI — {today}</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{data?.packedToday ?? 0}</p>
            <p className="text-xs text-gray-500">Dikemas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{data?.shippedToday ?? 0}</p>
            <p className="text-xs text-gray-500">Resi masuk</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{data?.deliveredPickupToday ?? 0}</p>
            <p className="text-xs text-gray-500">Diserahkan</p>
          </div>
        </div>
      </div>

      {data?.recentActivity && data.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-500 mb-3">Aktivitas Terkini</h4>
          <div className="space-y-2">
            {data.recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm py-2 border-b border-gray-100 last:border-0">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="font-medium">{activity.orderNumber}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">{activity.status}</span>
                {activity.courierCode && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">{activity.courierCode}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}