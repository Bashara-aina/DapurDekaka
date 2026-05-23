'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface B2BProfile {
  id: string;
  companyName: string;
  picName: string;
  picEmail: string;
  picPhone: string;
}

interface NewCustomer {
  companyName: string;
  picName: string;
  picEmail: string;
  picPhone: string;
}

interface ProfileSelectorProps {
  selectedProfileId: string;
  onProfileChange: (id: string) => void;
  showNewCustomer: boolean;
  onShowNewCustomerChange: (show: boolean) => void;
  newCustomer: NewCustomer;
  onNewCustomerChange: (customer: NewCustomer) => void;
  loadingProfiles: boolean;
  profiles: B2BProfile[];
}

export default function ProfileSelector({
  selectedProfileId,
  onProfileChange,
  showNewCustomer,
  onShowNewCustomerChange,
  newCustomer,
  onNewCustomerChange,
  loadingProfiles,
  profiles,
}: ProfileSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-admin-border p-6">
      <h2 className="font-semibold text-admin-text-primary mb-4">Pelanggan B2B</h2>
      {!loadingProfiles ? (
        <>
          <select
            value={selectedProfileId}
            onChange={(e) => {
              onProfileChange(e.target.value);
              onShowNewCustomerChange(e.target.value === 'new');
            }}
            className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm focus:outline-none focus:border-brand-red"
          >
            <option value="">Pilih pelanggan</option>
            <option value="new">+ Pelanggan Baru</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.companyName} — {p.picName}</option>
            ))}
          </select>

          {showNewCustomer && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
              <p className="text-sm font-medium text-admin-text-primary">Data Pelanggan Baru</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nama Perusahaan</Label>
                  <Input
                    value={newCustomer.companyName}
                    onChange={e => onNewCustomerChange({ ...newCustomer, companyName: e.target.value })}
                    placeholder="PT Example Indonesia"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nama PIC</Label>
                  <Input
                    value={newCustomer.picName}
                    onChange={e => onNewCustomerChange({ ...newCustomer, picName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email PIC</Label>
                  <Input
                    type="email"
                    value={newCustomer.picEmail}
                    onChange={e => onNewCustomerChange({ ...newCustomer, picEmail: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <Label className="text-xs">WhatsApp PIC</Label>
                  <Input
                    value={newCustomer.picPhone}
                    onChange={e => onNewCustomerChange({ ...newCustomer, picPhone: e.target.value })}
                    placeholder="62812xxxxxxxx"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="h-10 bg-gray-100 rounded animate-pulse" />
      )}
    </div>
  );
}