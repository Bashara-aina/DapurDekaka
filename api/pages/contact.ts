import type { PageContent } from "@shared/schema";
import { z } from "zod";
import { error, ok } from "../../lib/api-response";
import { requireAdmin } from "../../lib/auth";
import { storage } from "../../lib/storage";

export const config = { runtime: "nodejs" };

const contactPageSchema = z.object({
  title: z.string(),
  description: z.string(),
  mainImage: z.string(),
  contactInfo: z.object({
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    openingHours: z.string(),
    mapEmbedUrl: z.string(),
  }),
  socialLinks: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      url: z.string(),
      icon: z.string(),
    }),
  ),
  quickOrderUrl: z.string(),
});

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const content = await storage.getPageContent("contact");
    if (content?.content) {
      return json(ok(content), 200, {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      });
    }

    const fallback: { content: unknown } = {
      content: {
        title: "Contact Us",
        description: "Get in touch with us for inquiries about our premium halal dim sum.",
        mainImage: "/asset/1.jpg",
        contactInfo: {
          address: "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
          phone: "+62 8229-5986-407",
          email: "dapurdekaka@gmail.com",
          openingHours: "07:30 - 20:00",
          mapEmbedUrl:
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3960.628663657452!2d107.62787277454113!3d-6.934907867883335",
        },
        socialLinks: [
          { id: "shopee", label: "Shopee", url: "https://shopee.co.id/dapurdekaka", icon: "simple-icons:shopee" },
          { id: "instagram", label: "Instagram", url: "https://instagram.com/dapurdekaka", icon: "lucide:instagram" },
          {
            id: "grab",
            label: "Grab",
            url: "https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE",
            icon: "simple-icons:grab",
          },
        ],
        quickOrderUrl: "https://wa.me/6282295986407",
      },
    };

    return json(ok(fallback), 200, {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    });
  }

  if (request.method === "PUT") {
    const auth = await requireAdmin(request, new Response());
    if (auth instanceof Response) return auth;
    const payload = (await request.json()) as unknown;
    const validated = z.object({ content: contactPageSchema }).safeParse(payload);
    if (!validated.success) return json(error("VALIDATION_FAILED", "Invalid contact page payload", 400), 400);
    // The shared schema union does not include contact-specific shape yet.
    const updated = await storage.updatePageContent("contact", validated.data as PageContent);
    return json(ok(updated), 200);
  }

  return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
}
