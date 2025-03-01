import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from 'fs';
import { storage } from "./storage";
import { createServer } from 'http';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure static file serving with proper error handling
const staticFileOptions = {
  setHeaders: (res: Response) => {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Access-Control-Allow-Origin', '*');
  },
  fallthrough: true // Allow falling through to next middleware if file not found
};

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files with proper error handling
app.use('/uploads', express.static(uploadsDir, staticFileOptions));
app.use('/image', express.static(path.join(process.cwd(), 'image'), staticFileOptions));
app.use('/logo', express.static(path.join(process.cwd(), 'logo'), staticFileOptions));

// Enhanced request logging middleware
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
      console.error(`[Directory] Error creating ${dir}:`, error);
      throw error;
    }
  }
};

// Simple, more efficient port finder
const findAvailablePort = async (startPort: number, maxAttempts: number = 3): Promise<number> => {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    const tryPort = () => {
      console.log(`[Port] Trying port ${currentPort}...`);
      const tempServer = createServer();
      
      // Use a shorter timeout
      const timeout = setTimeout(() => {
        tempServer.close();
        currentPort++;
        attempts++;
        if (attempts >= maxAttempts) {
          // Just use a default port if we can't find one quickly
          console.log(`[Port] Using default port ${startPort + 1000}`);
          resolve(startPort + 1000);
          return;
        }
        tryPort();
      }, 500);

      tempServer.once('error', () => {
        clearTimeout(timeout);
        currentPort++;
        attempts++;
        if (attempts >= maxAttempts) {
          // Just use a default port if we can't find one quickly
          console.log(`[Port] Using default port ${startPort + 1000}`);
          resolve(startPort + 1000);
          return;
        }
        tempServer.close(() => tryPort());
      });

      tempServer.once('listening', () => {
        clearTimeout(timeout);
        const finalPort = (tempServer.address() as any).port;
        console.log(`[Port] Found available port: ${finalPort}`);
        tempServer.close(() => resolve(finalPort));
      });

      tempServer.listen(currentPort, '0.0.0.0');
    };

    tryPort();
  });
};

const startServer = async () => {
  try {
    console.log('[Startup] Beginning server initialization...');

    // Create required directories (but don't wait for it to complete)
    const dirPromise = createRequiredDirectories();

    // Find available port with improved logging
    console.log('[Port] Starting port availability check...');
    const port = await findAvailablePort(5000);
    console.log(`[Port] Selected port ${port} for server`);

    // Register routes before static files
    server = registerRoutes(app);

    // Global error handler with improved logging
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[Error] Detailed server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Always use Vite in development mode
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Middleware] Setting up Vite development middleware');
      await setupVite(app, server);
    } else {
      console.log('[Middleware] Setting up static file serving');
      serveStatic(app);
    }

    // Ensure directories are created before continuing
    await dirPromise;

    // Start the server with improved error handling
    return new Promise((resolve, reject) => {
      server.listen(port, "0.0.0.0", () => {
        log(`[Server] Running on port ${port}`);
        
        // Perform database initialization in the background
        // Don't block server start on database operations
        Promise.resolve().then(async () => {
          try {
            console.log('[Database] Starting data initialization...');
            await storage.getAllMenuItems();
            console.log('[Database] Data initialization complete');
          } catch (error) {
            console.error('[Database] Initialization error:', error);
            // Don't reject the server promise - allow server to run even if DB has issues
          }
        });
        
        resolve(server);
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