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
  fallthrough: true
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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

let server: any = null;

// Improved server shutdown
const stopServer = () => {
  return new Promise<void>((resolve) => {
    if (server) {
      console.log('[Server] Gracefully shutting down...');
      server.close(() => {
        console.log('[Server] Stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
};

const startServer = async () => {
  try {
    // Stop existing server if running
    await stopServer();

    console.log('[Startup] Beginning server initialization...');

    // Create required directories
    const dirs = ['uploads', 'image', 'logo'];
    for (const dir of dirs) {
      const dirPath = path.join(process.cwd(), dir);
      await fs.promises.mkdir(dirPath, { recursive: true });
    }

    // Use fixed port 5000
    const port = 5000;
    console.log(`[Port] Using port ${port}`);

    // Register routes and create server
    server = createServer(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[Error] Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    // Setup appropriate middleware based on environment
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Middleware] Setting up Vite development server');
      await setupVite(app, server);
    } else {
      console.log('[Middleware] Setting up static file serving');
      serveStatic(app);
    }

    // Start listening
    return new Promise((resolve, reject) => {
      console.log('[Server] Attempting to listen on port 5000...');

      server.listen(port, "0.0.0.0", () => {
        log(`[Server] Running on port ${port}`);
        console.log(`[Server] Access your application at http://localhost:${port}`);
        resolve(server);
      }).on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[Error] Port ${port} is already in use. Please ensure no other instance is running.`);
          console.error('[Server] Try running "pkill -f \'node.*server/index\'" to kill existing instances.');
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error('[Startup] Failed:', error);
    throw error;
  }
};

// Handle graceful shutdown
process.on('SIGTERM', stopServer);
process.on('SIGINT', stopServer);

// Export for testing
export { startServer, stopServer };

// Start the server
console.log('[Process] Starting server process...');
startServer().catch((error) => {
  console.error('[Process] Fatal error:', error);
  process.exit(1);
});