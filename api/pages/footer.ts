import { z } from "zod";
import { error, ok } from "../../lib/api-response";
import { requireAdmin } from "../../lib/auth";
import { uploadFile } from "../../lib/blob";
import { storage } from "../../lib/storage";

export const config = { runtime: "nodejs" };

const socialLinkSchema = z.object({
  id: z.string(),
  platform: z.string(),
  url: z.string().url(),
  icon: z.string(),
});

const footerContentSchema = z.object({
  companyName: z.string().min(1).max(100),
  tagline: z.string().max(500),
  address: z.string().max(300),
  phone: z.string().max(20),
  email: z.string().email(),
  socialLinks: z.array(socialLinkSchema),
  copyright: z.string(),
  logoUrl: z.string().optional(),
});

function json(body: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const page = await storage.getPageContent("footer");
    return json(ok(page ?? {
      content: {
        companyName: "Dapur Dekaka",
        tagline: "Premium halal dim sum made with love and quality ingredients.",
        address: "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
        phone: "082295986407",
        email: "contact@dapurdekaka.com",
        socialLinks: [
          { id: "1", platform: "Instagram", url: "https://instagram.com/dapurdekaka", icon: "Instagram" },
          { id: "2", platform: "Shopee", url: "https://shopee.co.id/dapurdekaka", icon: "Shopee" },
          { id: "3", platform: "WhatsApp", url: "https://wa.me/6282295986407", icon: "WhatsApp" },
          {
            id: "4",
            platform: "Grab",
            url: "https://food.grab.com/id/en/restaurant/dapur-dekaka-dimsum-delivery/",
            icon: "Grab",
          },
        ],
        copyright: `© ${new Date().getFullYear()} Dapur Dekaka. All rights reserved.`,
        logoUrl: "",
      },
    }), 200, {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    });
  }

  if (request.method === "PUT") {
    const auth = await requireAdmin(request, new Response());
    if (auth instanceof Response) return auth;

    try {
      const contentType = request.headers.get("content-type") ?? "";
      let payload: unknown;
      let logoFile: File | null = null;

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const contentRaw = formData.get("content");
        payload = typeof contentRaw === "string" ? JSON.parse(contentRaw) : null;
        const logo = formData.get("logo");
        if (logo instanceof File && logo.size > 0) {
          logoFile = logo;
        }
      } else {
        payload = await request.json();
      }

      const validated = footerContentSchema.safeParse(payload);
      if (!validated.success) {
        return json(error("VALIDATION_FAILED", "Invalid footer content", 400), 400);
      }
      if (logoFile) {
        validated.data.logoUrl = await uploadFile(logoFile, "pages/footer");
      }

      await storage.updatePageContent("footer", { content: validated.data });
      return json(ok({ message: "Footer content updated successfully" }), 200);
    } catch (caught: unknown) {
      if (caught instanceof SyntaxError) {
        return json(error("PARSE_ERROR", "Invalid footer data format", 400), 400);
      }
      return json(error("UPDATE_FAILED", "Failed to update footer content", 500), 500);
    }
  }

  return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
}
