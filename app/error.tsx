'use client';

import { EmptyState } from '@/components/store/common/EmptyState';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Debug logging
  if (typeof window !== 'undefined') {
    fetch('http://127.0.0.1:7420/ingest/09d39df7-998a-468e-966d-456351968e13', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '561006' },
      body: JSON.stringify({
        sessionId: '561006',
        location: 'app/error.tsx',
        message: 'Root error boundary triggered',
        data: {
          message: error.message,
          digest: error.digest,
          name: error.name,
          stack: error.stack?.substring(0, 300)
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
  }

  return (
    <EmptyState
      variant="error"
      title="Ups, ada yang tidak beres"
      description="Tim kami sedang memperbaikinya. Coba lagi sebentar ya!"
      action={{ label: '🔄 Coba Lagi', onClick: reset }}
    />
  );
}