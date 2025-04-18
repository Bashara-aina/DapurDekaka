import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from 'fs';
import { storage } from "./storage";
import { createServer } from 'http';
import cors from 'cors';
import session from 'express-session';

const app = express();

// Configure CORS for cross-domain cookie support
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

// Session middleware is configured in routes.ts to prevent duplication
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
app.use('/logo/customers', express.static(path.join(process.cwd(), 'public', 'logo', 'customers'), staticFileOptions));
app.use('/public', express.static(path.join(process.cwd(), 'public'), staticFileOptions));

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

    // Start the server with improved error handling and fallback port
    return new Promise((resolve, reject) => {
      const startServerOnPort = (currentPort: number) => {
        server.listen(currentPort, "0.0.0.0", () => {
          // Get the actual port that was assigned (useful if we're using port 0)
          const usedPort = (server.address() as any).port;
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
        }).on('error', (error: any) => {
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