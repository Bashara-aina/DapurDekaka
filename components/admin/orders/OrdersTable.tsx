'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { OrderStatusBadge, type OrderStatus } from './OrderStatusBadge';

export interface OrdersTableOrder {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  totalAmount: number;
  createdAt: string;
  deliveryMethod: string;
}

interface OrdersTableProps {
  orders: OrdersTableOrder[];
  emptyMessage?: string;
  showDeliveryMethod?: boolean;
  /**
   * Optional per-row actions cell (e.g. Detail link + status Update menu).
   * Rendered as the last column when provided.
   */
  renderActions?: (order: OrdersTableOrder) => ReactNode;
}

const columnHelper = createColumnHelper<OrdersTableOrder>();

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="w-3.5 h-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="w-3.5 h-3.5" />;
  return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
}

/**
 * Orders data table (TanStack Table v8 + shadcn-style markup).
 *
 * Sorting is client-side over the current page; pagination / search / status
 * filtering stay server-driven via URL params (see OrdersClient + the
 * `GET /api/admin/orders` route). Status rendering is centralized in
 * `OrderStatusBadge` — the single source of truth per AUDIT-03 §4.
 */
export function OrdersTable({
  orders,
  emptyMessage = 'Belum ada pesanan',
  showDeliveryMethod = true,
  renderActions,
}: OrdersTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => {
    // `any` value type is the documented workaround for mixing accessor +
    // display columns in one array (TanStack Table v8 column variance).
    const cols: ColumnDef<OrdersTableOrder, any>[] = [
      columnHelper.accessor('orderNumber', {
        header: 'No. Pesanan',
        cell: (info) => (
          <Link
            href={`/admin/orders/${info.row.original.id}`}
            className="font-mono text-brand-red hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor('recipientName', {
        header: 'Pelanggan',
        cell: (info) => (
          <div>
            <div className="font-medium text-gray-900">{info.getValue()}</div>
            <div className="text-gray-400 text-xs">{info.row.original.recipientEmail}</div>
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        enableSorting: false,
        cell: (info) => <OrderStatusBadge status={info.getValue() as OrderStatus} />,
      }),
      ...(showDeliveryMethod
        ? [
            columnHelper.accessor('deliveryMethod', {
              header: 'Metode',
              enableSorting: false,
              cell: (info) =>
                info.getValue() === 'pickup' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">
                    Ambil Sendiri
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    Dikirim
                  </span>
                ),
            }),
          ]
        : []),
      columnHelper.accessor('totalAmount', {
        header: 'Total',
        cell: (info) => (
          <span className="font-semibold text-gray-900">{formatIDR(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor('createdAt', {
        header: 'Tanggal',
        cell: (info) => (
          <span className="text-gray-500 whitespace-nowrap">
            {formatWIB(new Date(info.getValue()))}
          </span>
        ),
      }),
    ];

    if (renderActions) {
      cols.push(
        columnHelper.display({
          id: 'actions',
          header: 'Aksi',
          enableSorting: false,
          cell: (info) => renderActions(info.row.original),
        })
      );
    }
    return cols;
    // renderActions is a stable closure from the parent in practice; including
    // it keeps the table in sync if the parent re-creates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeliveryMethod, renderActions]);

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-100">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      'py-3 px-4 font-semibold text-gray-600 whitespace-nowrap',
                      header.column.id === 'totalAmount' ? 'text-right' : 'text-left'
                    )}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors"
                        aria-label={`Urutkan kolom ${header.column.id}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon sorted={sorted} />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn(
                    'py-3 px-4',
                    cell.column.id === 'totalAmount' && 'text-right'
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}