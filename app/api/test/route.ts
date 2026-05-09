import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";

export async function GET(): Promise<Response> {
  try {
    const result = await sql`SELECT 'hello' as message`;
    return NextResponse.json({ success: true, data: result.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg });
  }
}