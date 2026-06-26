import { NextFunction, Request, Response } from "express";
import { AccessTokenPayload, verifyAccessToken } from "../services/auth.js";

export type AdminRequest = Request & {
  admin?: AccessTokenPayload;
};

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const [type, token] = header.split(" ");

  const payload = type === "Bearer" && token ? verifyAccessToken(token) : null;
  if (!payload) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  (req as AdminRequest).admin = payload;
  return next();
}
