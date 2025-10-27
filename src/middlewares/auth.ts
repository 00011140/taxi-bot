// src/interfaces/http/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    driverId?: string;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });

    const token = header.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        (req as any).driver = decoded;
        next();
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
}
