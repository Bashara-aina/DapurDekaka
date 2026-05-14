'use client';

import { useQuery } from '@tanstack/react-query';

export function useOrderStatus(orderNumber: string, initialStatus: string) {
  const shouldPoll = ['pending_payment', 'shipped'].includes(initialStatus);

  return useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderNumber}`);
      return res.json();
    },
    refetchInterval: shouldPoll ? 30_000 : false,
    initialData: { data: { status: initialStatus } },
  });
}