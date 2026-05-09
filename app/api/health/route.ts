import { NextResponse } from "next/server";

interface HealthResponse {
  success: boolean;
  data: {
    status: "ok";
    service: string;
    timestamp: string;
  };
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json(
    {
      success: true,
      data: {
        status: "ok",
        service: "dapur-dekaka-next",
        timestamp: new Date().toISOString(),
      },
    },
    { status: 200 },
  );
}
