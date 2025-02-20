import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import fs from 'fs';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from image, logo, and uploads directories
app.use('/image', express.static(path.join(process.cwd(), 'image'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Access-Control-Allow-Origin', '*');
  },
  fallthrough: false
}));

app.use('/logo', express.static(path.join(process.cwd(), 'logo'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Access-Control-Allow-Origin', '*');
  },
  fallthrough: false
}));

// Add uploads directory for blog images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Access-Control-Allow-Origin', '*');
  },
  fallthrough: false
}));

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

const startServer = async () => {
  try {
    // Create directories if they don't exist
    const dirs = ['uploads', 'image', 'logo'];
    for (const dir of dirs) {
      const dirPath = path.join(process.cwd(), dir);
      try {
        await fs.promises.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (error) {
        if ((error as any).code !== 'EEXIST') {
          console.error(`Error creating directory ${dir}:`, error);
          throw error;
        }
      }
    }

    server = registerRoutes(app);

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error('Error:', err);
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    return new Promise((resolve, reject) => {
      const port = process.env.PORT || 5000;
      server.listen(port, "0.0.0.0", () => {
        log(`Server is running on port ${port}`);
        resolve(server);
      }).on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${port} is already in use. Please ensure no other server is running.`);
        }
        reject(error);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
};

const stopServer = () => {
  if (server) {
    server.close(() => {
      console.log('Server stopped');
    });
  }
};

// Handle graceful shutdown
process.on('SIGTERM', stopServer);
process.on('SIGINT', stopServer);

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});