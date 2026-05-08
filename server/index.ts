import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from 'fs';
import { storage } from "./storage";
import { resetPool, isNeonTerminationError } from "./db";
import { createServer } from 'http';
import { AddressInfo } from "net";
import cors from 'cors';
import session from 'express-session';
import compression from 'compression';
import { defaultLimiter } from "./rateLimit";

/**
 * Global error handlers for uncaught exceptions and unhandled rejections.
 * Neon serverless driver can throw from WebSocket event handlers which bypass
 * normal try/catch. These handlers ensure the process stays alive and the
 * connection pool is reset when connection termination is detected.
 */
process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught exception:', error.message);
  console.error('[Process] Stack:', error.stack);

  // Check if error originates from the Neon module (by stack trace)
  const isFromNeonModule = error.stack?.includes('@neondatabase/serverless') ||
    error.stack?.includes('neon_serverless') ||
    error.stack?.includes('neondatabase');

  const sourceErr = (error as unknown as { sourceError?: unknown }).sourceError;
  const isNeonErr = isNeonTerminationError(error) ||
    (sourceErr && isNeonTerminationError(sourceErr as unknown)) ||
    isFromNeonModule;

  console.log('[Process] isNeonError:', isNeonErr, '| fromNeonModule:', isFromNeonModule);

  if (isNeonErr) {
    console.log('[Process] Neon error detected, resetting pool and recovering...');
    try { resetPool(); } catch (e) { console.error('[Process] resetPool failed:', e); }
    // Do NOT exit - let the server continue serving requests
    return;
  }

  // For truly unknown errors not from Neon, log but still try to survive
  console.error('[Process] Unknown uncaught exception, attempting to continue...');
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Process] Unhandled rejection:', String(reason));
  if (reason instanceof Error) {
    console.error('[Process] Rejection stack:', reason.stack);
  }
  if (isNeonTerminationError(reason)) {
    console.log('[Process] Neon connection termination in promise, resetting pool...');
    try { resetPool(); } catch (e) { console.error('[Process] resetPool in rejection failed:', e); }
  }
});

// Also catch process exit to log the exit code
process.on('exit', (code) => {
  console.log(`[Process] Process exiting with code: ${code}`);
});

const app = express();

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://dapur-dekaka-basharaaina56.replit.app',
      'https://dimsumdapurdekaka.com',
      /\.kirk\.replit\.dev$/,
      /^https?:\/\/localhost/
    ];
    const allowed = !origin || allowedOrigins.some(pattern => 
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    );
    callback(null, allowed ? origin : false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

// Apply rate limiting before body parsing to reject early
app.use(defaultLimiter);

// Body parsing with size limits to prevent DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(compression());

// Session middleware
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn('[Session] SESSION_SECRET not set - session features disabled');
} else {
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
        domain: undefined,
      },
    })
  );
}

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
app.use('/logo/customers', express.static(path.join(process.cwd(), 'public', 'logo', 'customers'), staticFileOptions));
app.use('/public', express.static(path.join(process.cwd(), 'public'), staticFileOptions));

// Enhanced request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
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

let server: ReturnType<typeof createServer> | null = null;

const createRequiredDirectories = async () => {
  const dirs = ['uploads', 'image', 'logo', 'public', 'public/logo', 'public/logo/customers'];
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


/**
 * Starts the Express server with Vite in development or static serving in production.
 * Handles port fallback to dynamic port (0) if preferred port is in use.
 * Runs database initialization asynchronously without blocking server startup.
 * Sets up graceful shutdown handlers for SIGTERM and SIGINT.
 *
 * @returns Promise resolving to the HTTP server instance
 * @throws Error if server fails to start or directory creation fails
 */
const startServer = async () => {
  try {
    console.log('[Startup] Beginning server initialization...');

    // Create required directories (but don't wait for it to complete)
    const dirPromise = createRequiredDirectories();

    // Try to use the provided port, but fall back to 0 (dynamic port) if it's busy
    const initialPort = process.env.PORT ? Number(process.env.PORT) : 5000;
    const fallbackPort = 0; // This will let the OS assign an available port
    let port = initialPort;
    
    console.log(`[Port] Attempting to use port ${initialPort} for server`);

    // Register routes before static files
    server = registerRoutes(app);

    // Global error handler with improved logging
    app.use((_err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error('[Error] Unhandled server error');
      res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
    });

// Use Vite in all non-production environments by default.
// DEV=true remains an explicit override for local debugging scenarios.
const isDev = process.env.NODE_ENV !== 'production' || process.env.DEV === 'true';
console.log(`[Middleware] Environment check: NODE_ENV=${process.env.NODE_ENV}, DEV=${process.env.DEV}, isDev=${isDev}`);

if (isDev) {
  console.log('[Middleware] Setting up Vite development middleware');
  await setupVite(app, server);
} else {
  console.log('[Middleware] Setting up static file serving');
  serveStatic(app);
}

    // Ensure directories are created before continuing
    await dirPromise;

    // Start the server with improved error handling and fallback port
    return new Promise((resolve, reject) => {
      const startServerOnPort = (currentPort: number) => {
        const httpServer = server!;
        httpServer.listen(currentPort, "0.0.0.0", () => {
          // Get the actual port that was assigned (useful if we're using port 0)
          const address = httpServer.address() as AddressInfo;
          const usedPort = address?.port || currentPort;
          log(`[Server] Running on port ${usedPort}`);
          
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
        }).on('error', (error: Error & { code?: string }) => {
          if (error.code === 'EADDRINUSE' && currentPort === initialPort) {
            // If the initial port is in use, try with the fallback port
            console.log(`[Port] Port ${initialPort} is in use, trying with dynamic port assignment...`);
            startServerOnPort(fallbackPort);
          } else {
            console.error('[Server] Failed to start:', error);
            reject(error);
          }
        });
      };
      
      // Start with the initial port
      startServerOnPort(port);
    });
  } catch (error) {
    console.error('[Startup] Failed:', error);
    throw error;
  }
};

/**
 * Gracefully stops the HTTP server if running.
 * Used for SIGTERM/SIGINT shutdown handlers to ensure clean exit.
 */
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