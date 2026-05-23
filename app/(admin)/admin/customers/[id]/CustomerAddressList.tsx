interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  addressLine: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

interface CustomerAddressListProps {
  addresses: Address[];
}

export default function CustomerAddressList({ addresses }: CustomerAddressListProps) {
  return (
    <div className="bg-white rounded-lg border border-admin-border p-6">
      <h2 className="font-semibold text-gray-700 mb-4">Alamat</h2>
      {addresses.length > 0 ? (
        <div className="space-y-3">
          {addresses.map(addr => (
            <div key={addr.id} className="border border-admin-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{addr.label ?? 'Alamat'}</span>
                {addr.isDefault && (
                  <span className="text-xs bg-brand-red text-white px-2 py-0.5 rounded">Default</span>
                )}
              </div>
              <p className="text-sm text-gray-600">{addr.recipientName} · {addr.phone}</p>
              <p className="text-sm text-gray-500">{addr.addressLine}</p>
              <p className="text-sm text-gray-500">{addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.postalCode}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Belum ada alamat tersimpan</p>
      )}
    </div>
  );
}