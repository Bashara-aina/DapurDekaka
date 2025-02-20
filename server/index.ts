// Force development mode and set Vite configuration
process.env.NODE_ENV = 'development';
process.env.PORT = '5000'; // Explicitly set port for Replit

// Remove VITE_ALLOW_HOSTS as it's handled internally by Vite configuration
delete process.env.VITE_ALLOW_HOSTS;

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { createServer } from 'http';
import fs from 'fs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let server: any = null;

const createRequiredDirectories = async () => {
  const dirs = ['uploads', 'image', 'logo', 'public'];
  for (const dir of dirs) {
    const dirPath = path.join(process.cwd(), dir);
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`[Directory] Created/verified: ${dir}`);
    } catch (error) {
      console.error(`[Directory] Error creating ${dir}:`, error);
    }
  }
};

const startServer = async () => {
  const startTime = Date.now();
  try {
    console.log('[Startup] Beginning server initialization...');
    console.log(`[Startup] Current NODE_ENV: ${process.env.NODE_ENV}`);

    // Use the explicitly set port
    const port = parseInt(process.env.PORT || '5000', 10);
    console.log(`[Startup] Using port: ${port}`);

    // Create required directories first
    await createRequiredDirectories();

    // Add a test endpoint to verify basic Express functionality
    app.get('/test', (_req, res) => {
      res.json({
        status: 'Server is running',
        uptime: Math.floor((Date.now() - startTime) / 1000)
      });
    });

    // Create server instance
    server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('[Error]', err);
      res.status(status).json({ message });
    });

    // Start the server with retry logic
    let serverStarted = false;
    for (let attempt = 1; attempt <= 3 && !serverStarted; attempt++) {
      try {
        console.log(`[Server] Starting attempt ${attempt}/3...`);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Server startup timed out'));
          }, 30000);

          server.listen(port, "0.0.0.0", (error?: Error) => {
            clearTimeout(timeout);
            if (error) {
              console.error(`[Server] Failed to start (attempt ${attempt}):`, error);
              reject(error);
              return;
            }
            serverStarted = true;
            const duration = Date.now() - startTime;
            console.log(`[Server] Successfully bound to port ${port} (${duration}ms)`);
            resolve();
          });
        });

        if (serverStarted) break;
      } catch (error) {
        if (attempt === 3) {
          throw error;
        }
        console.log(`[Server] Retrying server start in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Only setup Vite if Express server started successfully
    if (serverStarted) {
      // Temporarily commenting out Vite setup to isolate Express functionality
      // console.log('[Server] Setting up Vite middleware...');
      // try {
      //   await setupVite(app, server);
      //   console.log('[Server] Vite middleware setup complete');
      // } catch (error) {
      //   console.error('[Server] Error setting up Vite middleware:', error);
      //   process.exit(1);
      // }

      const totalDuration = Date.now() - startTime;
      log(`[Server] Running and ready to accept connections (total startup: ${totalDuration}ms)`);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Startup] Fatal error after ${duration}ms:`, error);
    process.exit(1);
  }
};

const stopServer = () => {
  if (server) {
    console.log('[Server] Initiating graceful shutdown...');
    server.close(() => {
      console.log('[Server] Stopped gracefully');
    });
  }
};

// Ensure clean shutdown
process.on('SIGTERM', stopServer);
process.on('SIGINT', stopServer);

console.log('[Process] Starting server process...');
startServer().catch((error) => {
  console.error('[Process] Fatal error:', error);
  process.exit(1);
});