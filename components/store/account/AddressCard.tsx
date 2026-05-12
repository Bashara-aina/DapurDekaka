'use client';

import { useState } from 'react';
import { MapPin, Pencil, Trash2, Check } from 'lucide-react';
import type { Address } from '@/lib/db/schema';

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export function AddressCard({ address, onEdit, onDelete, onSetDefault }: AddressCardProps) {
  return (
    <div className="bg-white rounded-card shadow-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-brand-cream rounded-lg flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-brand-red" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-text-primary">
                {address.label || 'Alamat'}
              </p>
              {address.isDefault && (
                <span className="px-2 py-0.5 bg-success-light text-success text-xs font-medium rounded">
                  <Check className="w-3 h-3 inline mr-1" />
                  Utama
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-text-primary mt-1">{address.recipientName}</p>
            <p className="text-sm text-text-secondary">{address.recipientPhone}</p>
            <p className="text-sm text-text-secondary mt-2 line-clamp-2">
              {address.addressLine}, {address.district}
            </p>
            <p className="text-sm text-text-secondary">
              {address.city}, {address.province} {address.postalCode}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onEdit(address)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-brand-cream-dark hover:bg-brand-cream transition-colors"
            aria-label="Edit alamat"
          >
            <Pencil className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={() => onDelete(address.id)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Hapus alamat"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {!address.isDefault && (
        <button
          onClick={() => onSetDefault(address.id)}
          className="w-full mt-4 py-2 text-sm text-brand-red font-medium border border-brand-red rounded-lg hover:bg-brand-red-muted transition-colors"
        >
          Jadikan Alamat Utama
        </button>
      )}
    </div>
  );
}