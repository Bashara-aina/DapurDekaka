import { OrderTrackingClient } from '../../[orderNumber]/OrderTrackingClient';

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderSuccessPage({ params }: PageProps) {
  const { orderNumber } = await params;

  return <OrderTrackingClient orderNumber={orderNumber} />;
}