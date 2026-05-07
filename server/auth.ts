import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { logger } from "./utils/logger";

/**
 * Middleware that protects routes requiring authenticated users.
 * Checks for valid session with userId; returns 401 if not authenticated.
 * Used for admin-only endpoints like content management.
 *
 * @param req - Express request with session data
 * @param res - Express response for error responses
 * @param next - Express next function to continue to protected route
 * @throws Returns 401 if session invalid or user not found in database
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.userId) {
      logger.warn("Auth failed: No session user ID found");
      return res.status(401).json({ message: "Unauthorized - No session user ID" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      logger.warn("Auth failed: User not found in database", { userId: req.session.userId });
      return res.status(401).json({ message: "User not found" });
    }

    logger.debug("Auth successful", { userId: user.id, username: user.username });
    next();
  } catch (error) {
    logger.error("Auth middleware error", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ message: "Authentication error" });
  }
};

/**
 * Verifies the request has an active admin session.
 * Returns 401 if unauthenticated, 403 if authenticated but not admin.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" }
      });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" }
      });
    }

    if (user.role !== "admin") {
      logger.warn("Admin access denied", { userId: user.id, username: user.username, role: user.role });
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin access required" }
      });
    }

    logger.debug("Admin access granted", { userId: user.id, username: user.username });
    next();
  } catch (error) {
    logger.error("Admin middleware error", { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ message: "Authorization error" });
  }
};
