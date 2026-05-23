import { formatWIB } from '@/lib/utils/format-date';

interface PointsHistoryEntry {
  id: string;
  type: string;
  pointsAmount: number;
  note: string | null;
  createdAt: string;
}

interface PointsHistoryTableProps {
  pointsHistory: PointsHistoryEntry[];
}

const POINTS_TYPE_LABELS: Record<string, string> = {
  earn: 'Mendapat',
  redeem: 'Ditukar',
  expire: 'Kadaluarsa',
  adjust: 'Penyesuaian',
  refund: 'Refund',
};

export default function PointsHistoryTable({ pointsHistory }: PointsHistoryTableProps) {
  return (
    <div className="bg-white rounded-lg border border-admin-border p-6 lg:col-span-2">
      <h2 className="font-semibold text-gray-700 mb-4">Riwayat Poin</h2>
      {pointsHistory.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {pointsHistory.map(ph => (
                <tr key={ph.id}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                      ph.type === 'earn' ? 'bg-green-100 text-green-800' :
                      ph.type === 'redeem' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {POINTS_TYPE_LABELS[ph.type] ?? ph.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${
                    ph.type === 'earn' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {ph.type === 'earn' ? '+' : '-'}{ph.pointsAmount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{ph.note ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatWIB(ph.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Belum ada riwayat poin</p>
      )}
    </div>
  );
}