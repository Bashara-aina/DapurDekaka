import { ClipboardList } from 'lucide-react';

export default function FieldLoading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="mx-4 mt-4">
        <div className="bg-white rounded-xl p-4 h-32 animate-pulse" />
      </div>
      <div className="flex gap-2 px-4 mt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="px-4 mt-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 h-40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}