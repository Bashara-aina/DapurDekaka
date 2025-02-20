// Force development mode and set Vite configuration
process.env.NODE_ENV = 'development';
process.env.VITE_ALLOW_HOSTS = 'all'; // This will be used in Vite config

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

const tryBindPort = async (port: number, maxRetries = 3): Promise<number> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentPort = port + attempt;
    const testServer = createServer();

    try {
      await new Promise<void>((resolve, reject) => {
        testServer.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[Server] Port ${currentPort} is in use, trying next port...`);
            resolve(); // Continue to next attempt
          } else {
            reject(err);
          }
        });

        testServer.once('listening', () => {
          console.log(`[Server] Found available port: ${currentPort}`);
          resolve();
        });

        testServer.listen(currentPort, '0.0.0.0');
      });

      // Properly close the test server
      await new Promise<void>((resolve) => {
        testServer.close(() => {
          console.log(`[Server] Test server closed on port ${currentPort}`);
          resolve();
        });
      });

      // Add a longer delay after finding an available port
      await new Promise(resolve => setTimeout(resolve, 2000));
      return currentPort;
    } catch (error) {
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });

      if (attempt === maxRetries - 1) {
        throw new Error(`Failed to find available port after ${maxRetries} attempts`);
      }
    }
  }
  throw new Error('Failed to bind to any port');
};

const startServer = async () => {
  try {
    console.log('[Startup] Beginning server initialization...');
    // Default to port 5000 as it seems to be required by the environment
    const basePort = parseInt(process.env.PORT || '5000', 10);
    console.log(`[Startup] Using base port: ${basePort}`);

    // Create required directories first
    await createRequiredDirectories();

    // Add a test endpoint
    app.get('/test', (_req, res) => {
      res.json({ status: 'Server is running' });
    });

    // Find an available port
    const port = await tryBindPort(basePort);
    console.log(`[Server] Successfully found available port: ${port}`);

    // Create server instance
    server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('[Error]', err);
      res.status(status).json({ message });
    });

    // Start the actual server
    await new Promise<void>((resolve, reject) => {
      server.listen(port, "0.0.0.0", async (error?: Error) => {
        if (error) {
          console.error(`[Server] Failed to start:`, error);
          reject(error);
          return;
        }
        console.log(`[Server] Successfully bound to port ${port}`);
        resolve();
      });
    });

    // If server started successfully, setup middleware
    console.log('[Server] Setting up middleware...');
    try {
      await setupVite(app, server);
      console.log('[Server] Vite middleware setup complete');
    } catch (error) {
      console.error('[Server] Error setting up Vite middleware:', error);
      process.exit(1);
    }

    log(`[Server] Running and ready to accept connections`);

  } catch (error) {
    console.error('[Startup] Fatal error:', error);
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