import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from 'fs';
import { storage } from "./storage";
import { createServer } from 'http';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files with proper cache headers
const staticFileOptions = {
  setHeaders: (res: Response) => {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Access-Control-Allow-Origin', '*');
  },
  fallthrough: false
};

// Create required directories
const createRequiredDirectories = async () => {
  const dirs = ['uploads', 'image', 'logo'];
  for (const dir of dirs) {
    const dirPath = path.join(process.cwd(), dir);
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`[Directory] Created/verified: ${dir}`);
    } catch (error) {
      if ((error as any).code !== 'EEXIST') {
        console.error(`[Directory] Error creating ${dir}:`, error);
        throw error;
      }
    }
  }
};

// Initialize menu items and database content
const initializeContent = async () => {
  try {
    console.log('[Database] Starting data initialization...');
    await storage.getAllMenuItems();
    console.log('[Database] Data initialization complete');
  } catch (error) {
    console.error('[Database] Initialization error:', error);
    // Continue running the server even if initialization fails
    console.log('[Database] Continuing despite initialization error');
  }
};

let server: any = null;

const startServer = async () => {
  try {
    console.log('[Startup] Beginning server initialization...');

    // Get port from environment variable or default to 5000
    const PORT = parseInt(process.env.PORT || '5000', 10);

    // Create server instance first
    server = registerRoutes(app);

    // Setup middleware before starting server
    app.use("/image", express.static(path.join(process.cwd(), 'image'), staticFileOptions));
    app.use("/logo", express.static(path.join(process.cwd(), 'logo'), staticFileOptions));
    app.use("/uploads", express.static(path.join(process.cwd(), 'uploads'), staticFileOptions));

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('[Error]', err);
      res.status(status).json({ message });
    });

    // Start server immediately
    await new Promise<void>((resolve, reject) => {
      server.listen(PORT, "0.0.0.0", (error?: Error) => {
        if (error) {
          console.error(`[Server] Failed to start on port ${PORT}:`, error);
          reject(error);
          return;
        }
        log(`[Server] Running on port ${PORT}`);
        resolve();
      });
    });

    // Setup Vite or static serving after server is running
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] Setting up Vite development middleware');
      await setupVite(app, server);
    } else {
      console.log('[Middleware] Setting up static file serving');
      try {
        serveStatic(app);
      } catch (error) {
        console.log('[Middleware] Static serving failed, falling back to Vite middleware');
        await setupVite(app, server);
      }
    }

    // Initialize directories and content after server is running
    await createRequiredDirectories();
    await initializeContent();

  } catch (error) {
    console.error('[Startup] Failed:', error);
    process.exit(1);
  }
};

const stopServer = () => {
  if (server) {
    server.close(() => {
      console.log('[Server] Stopped gracefully');
    });
  }
};

// Handle graceful shutdown
process.on('SIGTERM', stopServer);
process.on('SIGINT', stopServer);

// Start the server
console.log('[Process] Starting server process...');
startServer().catch((error) => {
  console.error('[Process] Fatal error:', error);
  process.exit(1);
});