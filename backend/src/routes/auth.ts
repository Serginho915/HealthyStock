import { Response, Router } from "express";
import { z } from "zod";
import {
  createAccessToken,
  createRefreshToken,
  getAuthConfig,
  getRefreshCookieOptions,
  refreshCookieName,
  revokeRefreshToken,
  rotateRefreshToken
} from "../services/auth.js";
import { logAuditEvent } from "../services/auditLog.js";
import { findActiveAdminById, touchAdminLastLogin, verifyAdminUserCredentials } from "../services/userStore.js";

const router = Router();
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const maxLoginAttempts = 5;
const loginWindowMs = 15 * 60 * 1000;

const credentialsSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200)
});

router.post("/login", async (req, res) => {
  if (!getAuthConfig().configured) {
    return res.status(503).json({ message: "Admin auth is not configured" });
  }

  const parsed = credentialsSchema.safeParse(req.body);
  const attemptKey = `${req.ip}:${parsed.success ? parsed.data.username : "invalid"}`;
  if (isLoginBlocked(attemptKey)) {
    return res.status(429).json({ message: "Too many login attempts. Try again later." });
  }

  const user = parsed.success
    ? await verifyAdminUserCredentials(parsed.data.username, parsed.data.password)
    : null;

  if (!parsed.success || !user) {
    recordFailedLogin(attemptKey);
    await logAuditEvent({
      actor: parsed.success ? parsed.data.username : "unknown",
      action: "auth.login_failed",
      details: { ip: req.ip }
    });
    return res.status(401).json({ message: "Invalid credentials" });
  }

  clearFailedLogin(attemptKey);
  await touchAdminLastLogin(user.id);
  await logAuditEvent({
    actor: user.email,
    action: "auth.login_success",
    details: { ip: req.ip }
  });
  const accessToken = createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);
  return res.json({ accessToken, user: { username: user.email, role: user.role } });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = readCookie(req.header("cookie") ?? "", refreshCookieName);
  if (!refreshToken) {
    return res.status(401).json({ message: "Missing refresh token" });
  }

  const rotated = await rotateRefreshToken(refreshToken, async (subject) => Boolean(await findActiveAdminById(subject)));
  if (!rotated) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  setRefreshCookie(res, rotated.refreshToken);
  return res.json({ accessToken: rotated.accessToken });
});

router.post("/logout", async (req, res) => {
  const refreshToken = readCookie(req.header("cookie") ?? "", refreshCookieName);
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

function setRefreshCookie(res: Response, token: string) {
  res.cookie(refreshCookieName, token, getRefreshCookieOptions());
}

function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = getRefreshCookieOptions();
  res.clearCookie(refreshCookieName, options);
}

function readCookie(header: string, name: string): string | undefined {
  const cookies = header.split(";").map((item) => item.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

function isLoginBlocked(key: string): boolean {
  const attempt = loginAttempts.get(key);
  return Boolean(attempt && attempt.blockedUntil > Date.now());
}

function recordFailedLogin(key: string) {
  const current = loginAttempts.get(key);
  const count = (current?.blockedUntil && current.blockedUntil > Date.now() ? current.count : current?.count ?? 0) + 1;
  loginAttempts.set(key, {
    count,
    blockedUntil: count >= maxLoginAttempts ? Date.now() + loginWindowMs : 0
  });
}

function clearFailedLogin(key: string) {
  loginAttempts.delete(key);
}

export default router;
