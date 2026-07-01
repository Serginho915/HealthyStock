import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { query } from "./db.js";

const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlMs = 1000 * 60 * 60 * 24 * 14;
const csrfTokenTtlMs = 1000 * 60 * 60 * 12;
const passwordHashIterations = 310_000;

export interface AccessTokenPayload {
  sub: string;
  role: "admin";
  exp: number;
}

interface RefreshTokenRow {
  subject: string;
}

interface AccessTokenClaims {
  role: "admin";
}

export const refreshCookieName = "hs_refresh_token";
export const csrfCookieName = "hs_csrf_token";

export function getAuthConfig() {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  return {
    configured: Boolean(jwtSecret && refreshSecret),
    jwtSecret,
    refreshSecret
  };
}

export function validateProductionAuthConfig() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const config = getAuthConfig();
  const missing = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["REDIS_URL", process.env.REDIS_URL],
    ["CORS_ORIGIN", process.env.CORS_ORIGIN],
    ["JWT_SECRET", config.jwtSecret],
    ["REFRESH_TOKEN_SECRET", config.refreshSecret],
    ["OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY],
    ["OPENROUTER_SITE_URL", process.env.OPENROUTER_SITE_URL]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing production auth env vars: ${missing.join(", ")}`);
  }

  if (config.jwtSecret && config.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  if (config.refreshSecret && config.refreshSecret.length < 32) {
    throw new Error("REFRESH_TOKEN_SECRET must be at least 32 characters in production");
  }

  if (config.jwtSecret === config.refreshSecret) {
    throw new Error("JWT_SECRET and REFRESH_TOKEN_SECRET must be different");
  }

  const corsOrigins = process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  if (corsOrigins.some((origin) => origin === "*")) {
    throw new Error("CORS_ORIGIN cannot include * in production");
  }

  if (corsOrigins.some((origin) => origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    throw new Error("CORS_ORIGIN must use production frontend URL(s) in production");
  }

  if (process.env.OPENROUTER_SITE_URL?.includes("localhost")) {
    throw new Error("OPENROUTER_SITE_URL must be your production site URL in production");
  }

  if (process.env.REFRESH_COOKIE_SAMESITE === "none" && !process.env.REFRESH_COOKIE_DOMAIN) {
    throw new Error("REFRESH_COOKIE_DOMAIN is required when REFRESH_COOKIE_SAMESITE=none in production");
  }
}

export function getRefreshCookieOptions() {
  const sameSite = parseSameSite(process.env.REFRESH_COOKIE_SAMESITE);
  const domain = process.env.REFRESH_COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === "production",
    domain,
    path: "/api/auth",
    maxAge: refreshTokenTtlMs
  } as const;
}

export function getCsrfCookieOptions() {
  const sameSite = parseSameSite(process.env.REFRESH_COOKIE_SAMESITE);
  const domain = process.env.REFRESH_COOKIE_DOMAIN || undefined;

  return {
    httpOnly: false,
    sameSite,
    secure: process.env.NODE_ENV === "production",
    domain,
    path: "/",
    maxAge: csrfTokenTtlMs
  } as const;
}

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isCsrfTokenValid(cookieHeader: string, headerToken: string | undefined): boolean {
  if (!headerToken) {
    return false;
  }

  const cookieToken = readCookieValue(cookieHeader, csrfCookieName);
  return Boolean(cookieToken && safeEqual(cookieToken, headerToken));
}

export function readCookieValue(header: string, name: string): string | undefined {
  const cookies = header.split(";").map((item) => item.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export function createPasswordHash(password: string): string {
  const salt = randomBytes(24).toString("base64url");
  const hash = pbkdf2Sync(password, salt, passwordHashIterations, 64, "sha512").toString("base64url");
  return `pbkdf2-sha512$${passwordHashIterations}$${salt}$${hash}`;
}

export async function createAccessToken(subject: string): Promise<string> {
  const config = getAuthConfig();
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is not set");
  }

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${accessTokenTtlSeconds}s`)
    .sign(getJwtSecretBytes(config.jwtSecret));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  const config = getAuthConfig();
  if (!config.jwtSecret) {
    return null;
  }

  try {
    const verified = await jwtVerify<AccessTokenClaims>(token, getJwtSecretBytes(config.jwtSecret), {
      algorithms: ["HS256"]
    });

    if (verified.payload.role !== "admin" || typeof verified.payload.sub !== "string") {
      return null;
    }

    return {
      sub: verified.payload.sub,
      role: "admin",
      exp: Number(verified.payload.exp ?? 0)
    };
  } catch {
    return null;
  }
}

export async function createRefreshToken(subject: string): Promise<string> {
  const token = randomBytes(48).toString("base64url");
  await query(
    `INSERT INTO refresh_tokens (token_hash, subject, created_at, expires_at)
     VALUES ($1, $2, NOW(), NOW() + INTERVAL '14 days')`,
    [hashRefreshToken(token), subject]
  );

  await query(`DELETE FROM refresh_tokens WHERE expires_at <= NOW()`);
  return token;
}

export async function rotateRefreshToken(
  token: string,
  validateSubject: (subject: string) => Promise<boolean> = async () => true
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashRefreshToken(token);
  const rotated = await query<RefreshTokenRow>(
    `DELETE FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     RETURNING subject`,
    [tokenHash]
  );

  const record = rotated[0];
  if (!record) {
    return null;
  }

  if (!(await validateSubject(record.subject))) {
    return null;
  }

  const accessToken = await createAccessToken(record.subject);
  const refreshToken = await createRefreshToken(record.subject);
  return { accessToken, refreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashRefreshToken(token);
  await query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}

function hashRefreshToken(token: string): string {
  const secret = process.env.REFRESH_TOKEN_SECRET ?? "";
  return createHmac("sha256", secret).update(token).digest("hex");
}

function getJwtSecretBytes(secret: string) {
  return new TextEncoder().encode(secret);
}

function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
  const [algorithm, iterationsValue, salt, hash] = storedHash.split("$");
  const iterations = Number(iterationsValue);

  if (algorithm !== "pbkdf2-sha512" || !Number.isInteger(iterations) || !salt || !hash) {
    return false;
  }

  const candidate = pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("base64url");
  return safeEqual(candidate, hash);
}

function parseSameSite(value: string | undefined): "lax" | "strict" | "none" {
  if (value === "strict" || value === "none") {
    return value;
  }

  return "lax";
}
