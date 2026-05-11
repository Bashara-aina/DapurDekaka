import { z } from "zod";
import { error, ok } from "@lib/api-response";
import { requireAdmin } from "@lib/auth";
import { uploadFile } from "@lib/blob";
import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

const customersSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  logos: z.array(z.string()),
});

const homepageSchema = z.object({
  carousel: z.object({
    images: z.array(z.string()),
    title: z.string(),
    subtitle: z.string(),
  }),
  logo: z.string(),
  content: z.object({
    hero: z.object({ title: z.string(), subtitle: z.string() }),
    carousel: z.object({ title: z.string(), subtitle: z.string() }),
    featuredProducts: z.object({ title: z.string(), subtitle: z.string() }),
    latestArticles: z.object({ title: z.string(), subtitle: z.string() }),
    customers: customersSchema,
  }),
});

const customersUpdateSchema = z.object({
  customers: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }),
});

type HomepageConfig = z.infer<typeof homepageSchema>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defaults(): HomepageConfig {
  return {
    carousel: {
      images: Array.from({ length: 33 }, (_, index) => `/asset/${index + 1}.jpg`),
      title: "Dapur Dekaka",
      subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!",
    },
    logo: "/logo/logo.png",
    content: {
      hero: { title: "Dapur Dekaka", subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!" },
      carousel: { title: "Dapur Dekaka", subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!" },
      featuredProducts: { title: "Featured Products", subtitle: "Discover our most loved dim sum selections" },
      latestArticles: { title: "Latest Articles", subtitle: "Discover our latest news and updates" },
      customers: { title: "Our Customers", subtitle: "Trusted by businesses across Indonesia", logos: [] },
    },
  };
}

async function loadHomepage(): Promise<HomepageConfig> {
  const current = await storage.getPageContent("homepage");
  const parsed = homepageSchema.safeParse(current?.content);
  if (!parsed.success) {
    return defaults();
  }
  return parsed.data;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "PUT") {
    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  }

  const authGate = await requireAdmin(request, new Response());
  if (authGate instanceof Response) {
    return authGate;
  }

  try {
    const homepage = await loadHomepage();
    const formData = await request.formData();
    const contentField = formData.get("content");

    if (typeof contentField === "string") {
      const payload = JSON.parse(contentField) as unknown;
      const validation = customersUpdateSchema.safeParse(payload);
      if (!validation.success) {
        return json(error("VALIDATION_FAILED", "Invalid customers content", 400), 400);
      }

      if (validation.data.customers.title) {
        homepage.content.customers.title = validation.data.customers.title;
      }
      if (validation.data.customers.subtitle) {
        homepage.content.customers.subtitle = validation.data.customers.subtitle;
      }
    }

    const logoParts = formData.getAll("customerLogos");
    for (const part of logoParts) {
      if (part instanceof File && part.size > 0) {
        homepage.content.customers.logos.push(await uploadFile(part, "pages/homepage/customers"));
      }
    }

    await storage.updatePageContent("homepage", { content: homepage });
    return json(ok({ message: "Customers section updated successfully", data: homepage.content.customers }));
  } catch (caught: unknown) {
    if (caught instanceof SyntaxError) {
      return json(error("PARSE_ERROR", "Invalid content format", 400), 400);
    }
    return json(error("SERVER_ERROR", "Internal server error", 500), 500);
  }
}
