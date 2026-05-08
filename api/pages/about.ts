import { z } from "zod";
import { error, ok } from "../../lib/api-response";
import { requireAdmin } from "../../lib/auth";
import { storage } from "../../lib/storage";

export const config = { runtime: "nodejs" };

const aboutSchema = z.object({
  title: z.string(),
  description: z.string(),
  mainImage: z.string(),
  mainDescription: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
    }),
  ),
  features: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      image: z.string(),
    }),
  ),
});

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

function defaultAbout() {
  return {
    content: {
      title: "About Dapur Dekaka",
      description: "",
      mainImage: "/asset/28.jpg",
      mainDescription:
        "Dapur Dekaka adalah produsen frozen food dimsum berbagai varian. Berlokasi di Bandung, kami telah mendistribusikan produk sampai ke Jakarta, Bekasi, Tangerang, dan Palembang.",
      sections: [
        {
          title: "Di Dapur Dekaka",
          description:
            "Kami sangat bersemangat untuk menghadirkan cita rasa otentik dim sum buatan tangan ke meja Anda.",
        },
      ],
      features: [
        {
          id: "premium",
          title: "Bahan-bahan Premium",
          description: "Kami hanya menggunakan bahan-bahan terbaik.",
          image: "/asset/premium-ingredients.jpg",
        },
        {
          id: "handmade",
          title: "Keunggulan Buatan Tangan",
          description: "Setiap potongan dim sum dibuat dengan hati-hati.",
          image: "/asset/handmade.jpg",
        },
        {
          id: "halal",
          title: "Bersertifikat Halal",
          description: "Produk kami memenuhi standar halal.",
          image: "/asset/halal-certified.jpg",
        },
        {
          id: "preservative",
          title: "Tanpa Pengawet",
          description: "Kesegaran dan rasa alami adalah prioritas kami.",
          image: "/asset/no-preservatives.jpg",
        },
      ],
    },
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    try {
      const page = await storage.getPageContent("about");
      return json(ok(page ?? defaultAbout()), 200, {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      });
    } catch {
      return json(error("FETCH_FAILED", "Failed to fetch about page content", 500), 500);
    }
  }

  if (request.method === "PUT") {
    const authGate = await requireAdmin(request, new Response());
    if (authGate) return authGate;

    try {
      const payload = (await request.json()) as unknown;
      const parsed = z.object({ content: aboutSchema }).safeParse(payload);
      if (!parsed.success) {
        return json(error("VALIDATION_FAILED", "Invalid about page payload", 400), 400);
      }
      const updated = await storage.updatePageContent("about", parsed.data);
      return json(ok(updated));
    } catch {
      return json(error("UPDATE_FAILED", "Failed to update about page content", 500), 500);
    }
  }

  return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
}
