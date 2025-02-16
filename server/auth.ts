import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};
