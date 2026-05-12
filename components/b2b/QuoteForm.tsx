'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, User, Mail, Phone, MessageSquare, Send, CheckCircle } from 'lucide-react';

const VOLUME_OPTIONS = [
  { value: '1-5-juta', label: 'Rp 1 - 5 juta/bulan' },
  { value: '5-10-juta', label: 'Rp 5 - 10 juta/bulan' },
  { value: '10-20-juta', label: 'Rp 20 - 20 juta/bulan' },
  { value: '20-50-juta', label: 'Rp 20 - 50 juta/bulan' },
  { value: '50-juta-plus', label: 'Rp 50 juta+/bulan' },
];

const COMPANY_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'restoran', label: 'Restoran' },
  { value: 'catering', label: 'Catering' },
  { value: 'event-organizer', label: 'Event Organizer' },
  { value: 'kantor', label: 'Kantor / Perusahaan' },
  { value: 'lainnya', label: 'Lainnya' },
];

interface QuoteFormData {
  companyName: string;
  picName: string;
  picEmail: string;
  picPhone: string;
  companyType: string;
  message: string;
  estimatedVolume: string;
}

const initialFormData: QuoteFormData = {
  companyName: '',
  picName: '',
  picEmail: '',
  picPhone: '',
  companyType: '',
  message: '',
  estimatedVolume: '',
};

export function QuoteForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<QuoteFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/b2b/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          router.push('/b2b');
        }, 3000);
      } else {
        setError(result.error || 'Gagal mengirim permintaan. Silakan coba lagi.');
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-12 px-4">
        <div className="w-16 h-16 bg-brand-red/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-brand-red" />
        </div>
        <h3 className="font-display text-xl font-semibold mb-2">Permintaan Terkirim!</h3>
        <p className="text-text-secondary">
          Terima kasih atas interesse Anda. Tim kami akan menghubungi Anda dalam 1x24 jam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-error-light text-error rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="companyName" className="text-sm font-medium text-text-primary">
            Nama Perusahaan *
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              id="companyName"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="PT Maju Mundur"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="companyType" className="text-sm font-medium text-text-primary">
            Jenis Bisnis *
          </label>
          <select
            id="companyType"
            name="companyType"
            value={formData.companyType}
            onChange={handleChange}
            className="w-full h-10 px-3 border border-brand-cream-dark rounded-lg text-sm focus:outline-none focus:border-brand-red"
            required
          >
            <option value="">Pilih jenis bisnis</option>
            {COMPANY_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="picName" className="text-sm font-medium text-text-primary">
            Nama Penanggung Jawab *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              id="picName"
              name="picName"
              value={formData.picName}
              onChange={handleChange}
              placeholder="Budi Santoso"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="estimatedVolume" className="text-sm font-medium text-text-primary">
            Estimasi Volume Bulanan
          </label>
          <select
            id="estimatedVolume"
            name="estimatedVolume"
            value={formData.estimatedVolume}
            onChange={handleChange}
            className="w-full h-10 px-3 border border-brand-cream-dark rounded-lg text-sm focus:outline-none focus:border-brand-red"
          >
            <option value="">Pilih volume</option>
            {VOLUME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="picEmail" className="text-sm font-medium text-text-primary">
            Email *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              id="picEmail"
              name="picEmail"
              type="email"
              value={formData.picEmail}
              onChange={handleChange}
              placeholder="budi@perusahaan.com"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="picPhone" className="text-sm font-medium text-text-primary">
            WhatsApp *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              id="picPhone"
              name="picPhone"
              type="tel"
              value={formData.picPhone}
              onChange={handleChange}
              placeholder="081234567890"
              className="pl-10"
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium text-text-primary">
          Pesan / Kebutuhan *
        </label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Jelaskan kebutuhan Anda: produk yang diinginkan, quantity, waktu pengiriman, dll."
            rows={4}
            className="w-full px-3 py-2 pl-10 border border-brand-cream-dark rounded-lg text-sm focus:outline-none focus:border-brand-red resize-none"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 bg-brand-red text-white font-bold rounded-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Mengirim...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            Kirim Permintaan
          </span>
        )}
      </Button>
    </form>
  );
}