interface CustomerDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  pointsBalance: number | null;
  createdAt: string;
}

interface CustomerInfoCardProps {
  customer: CustomerDetail;
}

export default function CustomerInfoCard({ customer }: CustomerInfoCardProps) {
  return (
    <div className="bg-white rounded-lg border border-admin-border p-6">
      <h2 className="font-semibold text-gray-700 mb-4">Info Personal</h2>
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Nama</dt>
          <dd className="font-medium">{customer.name ?? '-'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Email</dt>
          <dd className="font-medium">{customer.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Telepon</dt>
          <dd className="font-medium">{customer.phone ?? '-'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Role</dt>
          <dd className="font-medium">{customer.role.charAt(0).toUpperCase() + customer.role.slice(1)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Poin</dt>
          <dd className="font-medium text-amber-600">{customer.pointsBalance ?? 0} pts</dd>
        </div>
      </dl>
    </div>
  );
}