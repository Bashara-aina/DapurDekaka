'use client';

import { Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface AdjustPointsModalProps {
  showAdjustPoints: boolean;
  onClose: () => void;
  adjustForm: { amount: number; type: 'add' | 'deduct'; reason: string };
  onAdjustFormChange: (form: { amount: number; type: 'add' | 'deduct'; reason: string }) => void;
  onSubmit: () => Promise<void>;
  isAdjusting: boolean;
}

export default function AdjustPointsModal({
  showAdjustPoints,
  onClose,
  adjustForm,
  onAdjustFormChange,
  onSubmit,
  isAdjusting,
}: AdjustPointsModalProps) {
  if (!showAdjustPoints) return null;

  function handleReasonChange(e: React.ChangeEvent<HTMLInputElement>) {
    onAdjustFormChange({ ...adjustForm, reason: e.target.value });
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    onAdjustFormChange({ ...adjustForm, amount: parseInt(e.target.value, 10) || 0 });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Sesuaikan Poin</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aksi</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAdjustFormChange({ ...adjustForm, type: 'add' })}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                  adjustForm.type === 'add'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Plus className="w-4 h-4 inline mr-1" />
                Tambah
              </button>
              <button
                type="button"
                onClick={() => onAdjustFormChange({ ...adjustForm, type: 'deduct' })}
                className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                  adjustForm.type === 'deduct'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Minus className="w-4 h-4 inline mr-1" />
                Kurang
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah Poin
            </label>
            <input
              type="number"
              min="1"
              value={adjustForm.amount || ''}
              onChange={handleAmountChange}
              placeholder="100"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alasan</label>
            <input
              type="text"
              value={adjustForm.reason}
              onChange={handleReasonChange}
              placeholder="Contoh: Koreksi kesalahan input"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={isAdjusting}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              adjustForm.type === 'add'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isAdjusting ? 'Memproses...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}