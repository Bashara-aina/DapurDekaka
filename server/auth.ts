import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Enhanced debugging in production
    if (process.env.NODE_ENV === "production") {
      console.log("Auth Request Headers:", req.headers);
      console.log("Session data:", req.session);
      console.log("Session ID:", req.sessionID);
      console.log("Cookies:", req.headers.cookie);
      console.log("Origin:", req.headers.origin);
      console.log("User Agent:", req.headers["user-agent"]);
    }
    
    if (!req.session.userId) {
      console.log("Auth Failed: No session user ID found");
      return res.status(401).json({ message: "Unauthorized - No session user ID" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      console.log(`Auth Failed: User with ID ${req.session.userId} not found in database`);
      return res.status(401).json({ message: "User not found" });
    }
    
    // Authentication successful
    console.log(`Auth Success: User ${user.username} (ID: ${user.id}) authenticated`);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};
