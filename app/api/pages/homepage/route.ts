import { NextResponse } from "next/server";
import { z } from "zod";
import { error, ok } from "@lib/api-response";
import { requireAdmin } from "@lib/auth";
import { uploadFile } from "@lib/blob";
import { storage } from "@lib/storage";

const homepageCustomersSchema = z.object({
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
    hero: z.object({
      title: z.string(),
      subtitle: z.string(),
    }),
    carousel: z.object({
      title: z.string(),
      subtitle: z.string(),
    }),
    featuredProducts: z.object({
      title: z.string(),
      subtitle: z.string(),
    }),
    latestArticles: z.object({
      title: z.string(),
      subtitle: z.string(),
    }),
    customers: homepageCustomersSchema,
  }),
});

const homepageUpdateSchema = z.object({
  carousel: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
    })
    .optional(),
  content: z
    .object({
      carousel: z
        .object({
          title: z.string().optional(),
          subtitle: z.string().optional(),
        })
        .optional(),
      customers: z
        .object({
          title: z.string().optional(),
          subtitle: z.string().optional(),
          logos: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
});

type HomepageConfig = z.infer<typeof homepageSchema>;

function getDefaultHomepageConfig(): HomepageConfig {
  return {
    carousel: {
      images: Array.from({ length: 33 }, (_, index) => `/asset/${index + 1}.jpg`),
      title: "Dapur Dekaka",
      subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!",
    },
    logo: "/logo/logo.png",
    content: {
      hero: {
        title: "Dapur Dekaka",
        subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!",
      },
      carousel: {
        title: "Dapur Dekaka",
        subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!",
      },
      featuredProducts: {
        title: "Featured Products",
        subtitle: "Discover our most loved dim sum selections",
      },
      latestArticles: {
        title: "Latest Articles",
        subtitle: "Discover our latest news and updates",
      },
      customers: {
        title: "Our Customers",
        subtitle: "Trusted by businesses across Indonesia",
        logos: ["/logo/halal.png", "/logo/logo.png"],
      },
    },
  };
}

async function loadHomepageConfig(): Promise<HomepageConfig> {
  // #region agent debug log
  fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'app/api/pages/homepage/route.ts:104',message:'loadHomepageConfig start',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const stored = await storage.getPageContent("homepage");
  // #region agent debug log
  fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'app/api/pages/homepage/route.ts:105',message:'storage.getPageContent result',data:{stored: stored ? 'exists' : 'undefined', keys: stored ? Object.keys(stored) : [], hasContent: stored?.content ? 'yes' : 'no'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!stored?.content) {
    return getDefaultHomepageConfig();
  }

  const parsed = homepageSchema.safeParse(stored.content);
  // #region agent debug log
  fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'app/api/pages/homepage/route.ts:110',message:'schema.safeParse result',data:{success: parsed.success, error: parsed.success ? null : parsed.error?.message},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!parsed.success) {
    return getDefaultHomepageConfig();
  }

  const normalized = parsed.data;
  if (!normalized.content.customers.logos.length) {
    normalized.content.customers.logos = ["/logo/halal.png", "/logo/logo.png"];
  }

  return normalized;
}

async function parseUpdateBody(request: Request): Promise<z.infer<typeof homepageUpdateSchema>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const contentValue = formData.get("content");
    if (typeof contentValue !== "string") {
      return {};
    }
    const parsed = JSON.parse(contentValue) as unknown;
    const validation = homepageUpdateSchema.safeParse(parsed);
    if (!validation.success) {
      throw new Error("VALIDATION_FAILED");
    }
    return validation.data;
  }

  const rawJson = (await request.json()) as unknown;
  const validation = homepageUpdateSchema.safeParse(rawJson);
  if (!validation.success) {
    throw new Error("VALIDATION_FAILED");
  }
  return validation.data;
}

async function applyMultipartUploads(request: Request, configData: HomepageConfig): Promise<void> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return;
  }

  const formData = await request.formData();

  const logoPart = formData.get("logo");
  if (logoPart instanceof File && logoPart.size > 0) {
    configData.logo = await uploadFile(logoPart, "pages/homepage/logo");
  }

  const carouselParts = formData.getAll("carouselImages");
  const newCarouselImages: string[] = [];
  for (const part of carouselParts) {
    if (part instanceof File && part.size > 0) {
      newCarouselImages.push(await uploadFile(part, "pages/homepage/carousel"));
    }
  }
  if (newCarouselImages.length > 0) {
    configData.carousel.images = newCarouselImages;
  }

  const customerLogoParts = formData.getAll("customerLogos");
  for (const part of customerLogoParts) {
    if (part instanceof File && part.size > 0) {
      const uploaded = await uploadFile(part, "pages/homepage/customers");
      configData.content.customers.logos.push(uploaded);
    }
  }
}

export async function GET(): Promise<Response> {
  try {
    // #region agent debug log
    const logMsgs: Array<{ msg: string; data: unknown }> = [];
    logMsgs.push({ msg: "GET /api/pages/homepage called", data: {} });
    // #endregion
    const homepage = await loadHomepageConfig();
    logMsgs.push({ msg: "loadHomepageConfig success", data: { homepage: typeof homepage } });
    return NextResponse.json(ok(homepage), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (caught: unknown) {
    // #region agent debug log
    fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'app/api/pages/homepage/route.ts:192',message:'GET error',data:{caught: String(caught), stack: caught instanceof Error ? caught.stack : null, name: caught instanceof Error ? caught.name : typeof caught},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return NextResponse.json(error("FETCH_FAILED", "Failed to fetch homepage content", 500), { status: 500 });
  }
}

export async function PUT(request: Request): Promise<Response> {
  const authGate = await requireAdmin(request, new NextResponse());
  if (authGate) {
    return authGate;
  }

  try {
    const homepage = await loadHomepageConfig();
    const updateBody = await parseUpdateBody(request.clone());

    const title = updateBody.carousel?.title ?? updateBody.content?.carousel?.title;
    const subtitle = updateBody.carousel?.subtitle ?? updateBody.content?.carousel?.subtitle;

    if (title) {
      homepage.carousel.title = title;
      homepage.content.hero.title = title;
      homepage.content.carousel.title = title;
    }
    if (subtitle) {
      homepage.carousel.subtitle = subtitle;
      homepage.content.hero.subtitle = subtitle;
      homepage.content.carousel.subtitle = subtitle;
    }

    if (updateBody.content?.customers?.title) {
      homepage.content.customers.title = updateBody.content.customers.title;
    }
    if (updateBody.content?.customers?.subtitle) {
      homepage.content.customers.subtitle = updateBody.content.customers.subtitle;
    }
    if (updateBody.content?.customers?.logos) {
      homepage.content.customers.logos = updateBody.content.customers.logos;
    }

    await applyMultipartUploads(request, homepage);

    await storage.updatePageContent("homepage", { content: homepage });
    return NextResponse.json(ok({ message: "Homepage updated successfully" }));
  } catch (caught: unknown) {
    if (caught instanceof Error && caught.message === "VALIDATION_FAILED") {
      return NextResponse.json(error("VALIDATION_FAILED", "Invalid homepage payload", 400), { status: 400 });
    }
    if (caught instanceof SyntaxError) {
      return NextResponse.json(error("PARSE_ERROR", "Invalid content format", 400), { status: 400 });
    }
    return NextResponse.json(error("UPDATE_FAILED", "Failed to update homepage", 500), { status: 500 });
  }
}