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
  try {
    console.log('[Startup] Beginning server initialization...');
    const PORT = parseInt(process.env.PORT || '3000', 10); // Changed to port 3000

    // Create required directories first
    await createRequiredDirectories();

    // Add a test endpoint
    app.get('/test', (_req, res) => {
      res.json({ status: 'Server is running' });
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

    // Test if port is in use
    const testServer = createServer();
    await new Promise<void>((resolve, reject) => {
      testServer.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[Server] Port ${PORT} is already in use`);
          testServer.close();
          reject(new Error(`Port ${PORT} is already in use`));
        } else {
          reject(err);
        }
      });

      testServer.once('listening', () => {
        testServer.close(() => resolve());
      });

      testServer.listen(PORT, '0.0.0.0');
    });

    // Start the actual server
    await new Promise<void>((resolve, reject) => {
      server.listen(PORT, "0.0.0.0", async (error?: Error) => {
        if (error) {
          console.error(`[Server] Failed to start:`, error);
          reject(error);
          return;
        }
        console.log(`[Server] Successfully bound to port ${PORT}`);
        resolve();
      });
    });

    // If server started successfully, setup middleware
    console.log('[Server] Setting up middleware...');
    if (process.env.NODE_ENV === 'development') {
      await setupVite(app, server);
    } else {
      try {
        serveStatic(app);
      } catch (error) {
        console.log('[Server] Falling back to development mode due to static serving error');
        await setupVite(app, server);
      }
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