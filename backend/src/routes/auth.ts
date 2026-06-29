import { Response, Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  createCsrfToken,
  createAccessToken,
  createRefreshToken,
  csrfCookieName,
  getCsrfCookieOptions,
  getAuthConfig,
  getRefreshCookieOptions,
  isCsrfTokenValid,
  readCookieValue,
  refreshCookieName,
  revokeRefreshToken,
  rotateRefreshToken
} from "../services/auth.js";
import { logAuditEvent } from "../services/auditLog.js";
import { consumeRateLimit } from "../services/rateLimit.js";
import { findActiveAdminById, touchAdminLastLogin, verifyAdminUserCredentials } from "../services/userStore.js";

const router = Router();

const credentialsSchema = z.object({
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(200)
});

router.post("/login", asyncHandler(async (req, res) => {
  if (!getAuthConfig().configured) {
    return res.status(503).json({ message: "Admin auth is not configured" });
  }

  const parsed = credentialsSchema.safeParse(req.body);
  const attemptKey = `${req.ip}:${parsed.success ? parsed.data.username : "invalid"}`;
  const limit = await consumeRateLimit(attemptKey, {
    keyPrefix: "auth_login",
    points: 5,
    durationSeconds: 15 * 60
  });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(limit.msBeforeNext / 1000)));
    return res.status(429).json({ message: "Too many login attempts. Try again later." });
  }

  const user = parsed.success
    ? await verifyAdminUserCredentials(parsed.data.username, parsed.data.password)
    : null;

  if (!parsed.success || !user) {
    await logAuditEvent({
      actor: parsed.success ? parsed.data.username : "unknown",
      action: "auth.login_failed",
      details: { ip: req.ip }
    });
    return res.status(401).json({ message: "Invalid credentials" });
  }

  await touchAdminLastLogin(user.id);
  await logAuditEvent({
    actor: user.email,
    action: "auth.login_success",
    details: { ip: req.ip }
  });
  const accessToken = await createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id);
  setRefreshCookie(res, refreshToken);
  setCsrfCookie(res, createCsrfToken());
  return res.json({ accessToken, user: { username: user.email, role: user.role } });
}));

router.post("/refresh", asyncHandler(async (req, res) => {
  if (!isCsrfTokenValid(req.header("cookie") ?? "", req.header("x-csrf-token") ?? undefined)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  const refreshToken = readCookieValue(req.header("cookie") ?? "", refreshCookieName);
  if (!refreshToken) {
    return res.status(401).json({ message: "Missing refresh token" });
  }

  const rotated = await rotateRefreshToken(refreshToken, async (subject) => Boolean(await findActiveAdminById(subject)));
  if (!rotated) {
    clearRefreshCookie(res);
    clearCsrfCookie(res);
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  setRefreshCookie(res, rotated.refreshToken);
  setCsrfCookie(res, createCsrfToken());
  return res.json({ accessToken: rotated.accessToken });
}));

router.post("/logout", asyncHandler(async (req, res) => {
  if (!isCsrfTokenValid(req.header("cookie") ?? "", req.header("x-csrf-token") ?? undefined)) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  const refreshToken = readCookieValue(req.header("cookie") ?? "", refreshCookieName);
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  clearRefreshCookie(res);
  clearCsrfCookie(res);
  return res.json({ ok: true });
}));

function setRefreshCookie(res: Response, token: string) {
  res.cookie(refreshCookieName, token, getRefreshCookieOptions());
}

function setCsrfCookie(res: Response, token: string) {
  res.cookie(csrfCookieName, token, getCsrfCookieOptions());
}

function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = getRefreshCookieOptions();
  res.clearCookie(refreshCookieName, options);
}

function clearCsrfCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = getCsrfCookieOptions();
  res.clearCookie(csrfCookieName, options);
}

export default router;
