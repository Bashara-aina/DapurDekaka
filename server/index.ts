// Force development mode and set Vite configuration
process.env.NODE_ENV = 'development';
process.env.VITE_ALLOW_HOSTS = 'true'; // Changed from 'all' to 'true' to match Vite's type expectations

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

const findAvailablePort = async (startPort: number, maxAttempts = 5): Promise<number> => {
  console.log(`[Port] Environment PORT=${process.env.PORT}`);
  console.log(`[Port] Starting port search from ${startPort}`);

  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const startTime = Date.now();
    console.log(`[Port] Attempt ${port - startPort + 1}/${maxAttempts}: Testing port ${port}`);

    try {
      const testServer = createServer();

      await new Promise<void>((resolve, reject) => {
        testServer.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            const duration = Date.now() - startTime;
            console.log(`[Port] Port ${port} is in use (${duration}ms)`);
            testServer.close();
            resolve();
          } else {
            console.error(`[Port] Unexpected error testing port ${port}:`, err);
            reject(err);
          }
        });

        testServer.once('listening', () => {
          const duration = Date.now() - startTime;
          console.log(`[Port] Successfully bound to port ${port} (${duration}ms)`);
          testServer.close(() => resolve());
        });

        console.log(`[Port] Attempting to bind to port ${port}...`);
        testServer.listen(port, '0.0.0.0');
      });

      const totalDuration = Date.now() - startTime;
      console.log(`[Port] Port ${port} test completed in ${totalDuration}ms`);
      return port;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Port] Error testing port ${port} (${duration}ms):`, error);
      continue;
    }
  }
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
};

const startServer = async () => {
  const startTime = Date.now();
  try {
    console.log('[Startup] Beginning server initialization...');
    console.log(`[Startup] Current NODE_ENV: ${process.env.NODE_ENV}`);

    // Start with port 3000 to avoid common conflicts
    const basePort = parseInt(process.env.PORT || '3000', 10);
    console.log(`[Startup] Using base port: ${basePort}`);

    // Create required directories first
    await createRequiredDirectories();

    // Add a test endpoint to verify basic Express functionality
    app.get('/test', (_req, res) => {
      res.json({
        status: 'Server is running',
        uptime: Math.floor((Date.now() - startTime) / 1000)
      });
    });

    // Find an available port
    const port = await findAvailablePort(basePort);
    console.log(`[Server] Found available port: ${port}`);

    // Create server instance
    server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('[Error]', err);
      res.status(status).json({ message });
    });

    // Start the server with increased timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timed out'));
      }, 30000); // 30 second timeout

      server.listen(port, "0.0.0.0", async (error?: Error) => {
        clearTimeout(timeout);
        if (error) {
          console.error(`[Server] Failed to start:`, error);
          reject(error);
          return;
        }
        const duration = Date.now() - startTime;
        console.log(`[Server] Successfully bound to port ${port} (${duration}ms)`);
        resolve();
      });
    });

    // Setup Vite middleware after server is running
    console.log('[Server] Setting up middleware...');
    try {
      await setupVite(app, server);
      console.log('[Server] Vite middleware setup complete');
    } catch (error) {
      console.error('[Server] Error setting up Vite middleware:', error);
      process.exit(1);
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
    server.close(() => {
      console.log('[Server] Stopped gracefully');
    });
  }
};

process.on('SIGTERM', stopServer);
process.on('SIGINT', stopServer);

console.log('[Process] Starting server process...');
startServer().catch((error) => {
  console.error('[Process] Fatal error:', error);
  process.exit(1);
});