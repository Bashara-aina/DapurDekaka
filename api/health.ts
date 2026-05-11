import { ok } from "../lib/api-response";

export const config = { runtime: "nodejs" };

export default async function handler(): Promise<Response> {
  return new Response(
    JSON.stringify(
      ok({
        status: "ok",
        service: "dapur-dekaka",
        timestamp: new Date().toISOString(),
      })
    ),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}