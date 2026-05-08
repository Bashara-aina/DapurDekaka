import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamic imports - only loaded when actually needed (development only)
  const [viteModule, nanoidModule, reactPluginModule] = await Promise.all([
    import("vite"),
    import("nanoid"),
    import("@vitejs/plugin-react"),
  ]);
  const { createServer: createViteServer, createLogger } = viteModule;
  const { nanoid } = nanoidModule;
  const reactPlugin = reactPluginModule.default;

  const viteLogger = createLogger();

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: ".",
  };

  // Inline minimal config - do NOT import vite.config.ts to avoid bundling
  // heavy dev dependencies like rollup into production
  const vite = await createViteServer({
    configFile: false,
    plugins: [reactPlugin()],
    customLogger: {
      ...viteLogger,
      error: (msg: string, options: unknown) => {
        viteLogger.error(msg, options as Parameters<typeof viteLogger.error>[1]);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
    root: path.resolve(__dirname, "..", "client"),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "..", "client", "src"),
        "@shared": path.resolve(__dirname, "..", "shared"),
      },
    },
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // Inject initial homepage data for instant first paint (no API waterfall)
      try {
        const { storage } = await import("./storage");
        const pageData = await storage.getPageContent("homepage");
        if (pageData?.content) {
          const initData = {
            carousel: pageData.content.carousel || pageData.content.hero || {},
            logo: pageData.logo,
            carouselTitle: pageData.content.carousel?.title || pageData.content.hero?.title || "",
            carouselSubtitle: pageData.content.carousel?.subtitle || pageData.content.hero?.subtitle || "",
          };
          const script = `<script>window.__INITIAL_DATA__=${JSON.stringify(initData)}<\/script>`;
          template = template.replace("</head>", `${script}</head>`);
        }
      } catch {
        // Non-fatal — dev server still works without initial data injection
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");

    // Inject initial homepage data for instant first paint in production too
    (async () => {
      try {
        const { storage } = await import("./storage");
        const pageData = await storage.getPageContent("homepage");
        if (pageData?.content) {
          const initData = {
            carousel: pageData.content.carousel || pageData.content.hero || {},
            logo: pageData.logo,
            carouselTitle: pageData.content.carousel?.title || pageData.content.hero?.title || "",
            carouselSubtitle: pageData.content.carousel?.subtitle || pageData.content.hero?.subtitle || "",
          };
          const script = `<script>window.__INITIAL_DATA__=${JSON.stringify(initData)}<\/script>`;
          html = html.replace("</head>", `${script}</head>`);
        }
      } catch {
        // Non-fatal in production
      }
      res.send(html);
    })();
  });
}
