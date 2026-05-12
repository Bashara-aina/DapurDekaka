import { CaptionGenerator } from '@/components/admin/ai/CaptionGenerator';

export default function AdminAIPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">AI Content Generator</h1>
        <p className="text-sm text-gray-600">
          Buat caption produk dan konten blog menggunakan AI. Fitur ini hanya untuk superadmin.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <CaptionGenerator />
      </div>
    </div>
  );
}