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

// Serve static files from image, logo, and uploads directories
app.use('/image', express.static(path.join(process.cwd(), 'image'), staticFileOptions));
app.use('/logo', express.static(path.join(process.cwd(), 'logo'), staticFileOptions));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), staticFileOptions));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

let server: any = null;

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

const findAvailablePort = async (startPort: number, maxAttempts: number = 10): Promise<number> => {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    const tryPort = () => {
      const tempServer = createServer();
      tempServer.listen(currentPort, '0.0.0.0');

      tempServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[Port] ${currentPort} is in use, trying next port`);
          currentPort++;
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error(`Could not find available port after ${maxAttempts} attempts`));
            return;
          }
          tempServer.close(() => tryPort());
        } else {
          reject(err);
        }
      });

      tempServer.on('listening', () => {
        const finalPort = (tempServer.address() as any).port;
        tempServer.close(() => resolve(finalPort));
      });
    };

    tryPort();
  });
};

const startServer = async () => {
  try {
    console.log('[Startup] Beginning server initialization...');

    // Create required directories
    await createRequiredDirectories();

    // Find available port
    const port = await findAvailablePort(5000);
    console.log(`[Port] Found available port: ${port}`);

    // Register routes and create server
    server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('[Error]', err);
      res.status(status).json({ message });
    });

    // Setup middleware based on environment
    if (process.env.NODE_ENV === 'development') {
      console.log('[Middleware] Setting up Vite development middleware');
      await setupVite(app, server);
    } else {
      console.log('[Middleware] Setting up static file serving');
      try {
        serveStatic(app);
      } catch (error) {
        // If static serving fails (e.g., no build directory), fall back to Vite middleware
        console.log('[Middleware] Static serving failed, falling back to Vite middleware');
        await setupVite(app, server);
      }
    }

    // Start the server
    return new Promise((resolve, reject) => {
      server.listen(port, "0.0.0.0", async () => {
        log(`[Server] Running on port ${port}`);
        try {
          // Initialize database content after server is running
          console.log('[Database] Starting data initialization...');
          await storage.getAllMenuItems();
          console.log('[Database] Data initialization complete');
          resolve(server);
        } catch (error) {
          console.error('[Database] Initialization error:', error);
          reject(error);
        }
      }).on('error', (error: any) => {
        console.error('[Server] Failed to start:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('[Startup] Failed:', error);
    throw error;
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