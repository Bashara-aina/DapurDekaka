// Force development mode and set Vite configuration
process.env.NODE_ENV = 'development';
process.env.PORT = '5000'; // Use Replit's default port

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

const cleanupServer = () => {
  return new Promise<void>((resolve) => {
    if (server) {
      console.log('[Server] Cleaning up existing server...');
      server.close(() => {
        console.log('[Server] Existing server closed');
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
};

const startServerWithRetry = async (port: number, retries = 3, delay = 1000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Server] Starting attempt ${attempt}/${retries}...`);

      // Create a new server instance
      server = createServer(app);

      await new Promise<void>((resolve, reject) => {
        server.listen(port, "0.0.0.0", (error?: Error) => {
          if (error) {
            console.error('[Server] Failed to start Express:', error);
            reject(error);
            return;
          }
          console.log(`[Server] Express server started successfully on port ${port}`);
          resolve();
        });
      });

      // If we get here, server started successfully
      return;
    } catch (error) {
      console.error(`[Server] Attempt ${attempt} failed:`, error);

      // Clean up the failed server instance
      await cleanupServer();

      if (attempt === retries) {
        throw error;
      }

      // Wait before retrying
      console.log(`[Server] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const startServer = async () => {
  const startTime = Date.now();
  try {
    console.log('[Startup] Beginning server initialization...');
    console.log(`[Startup] Current NODE_ENV: ${process.env.NODE_ENV}`);

    const port = parseInt(process.env.PORT || '5000', 10);
    console.log(`[Startup] Using port: ${port}`);

    // Create required directories
    await createRequiredDirectories();

    // Add test endpoint
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

    // Ensure clean state before starting
    await cleanupServer();

    // Start Express server with retry mechanism
    await startServerWithRetry(port);

    // Setup Vite middleware after Express is running
    console.log('[Server] Setting up Vite middleware...');
    try {
      await setupVite(app, server);
      console.log('[Server] Vite middleware setup complete');
    } catch (error) {
      console.error('[Server] Error setting up Vite middleware:', error);
      // Don't exit on Vite error, continue with basic Express functionality
    }

    const totalDuration = Date.now() - startTime;
    log(`[Server] Running and ready to accept connections (total startup: ${totalDuration}ms)`);

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
      process.exit(0);
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