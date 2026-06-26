import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const refreshTokensPath = path.resolve(process.cwd(), "data/refresh-tokens.json");
const accessTokenTtlSeconds = 15 * 60;
const refreshTokenTtlSeconds = 1000 * 60 * 60 * 24 * 14;
const passwordHashIterations = 310_000;

export interface AccessTokenPayload {
  sub: string;
  role: "admin";
  exp: number;
}

interface RefreshTokenRecord {
  tokenHash: string;
  subject: string;
  expiresAt: string;
  createdAt: string;
}

export const refreshCookieName = "hs_refresh_token";

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
    ["CORS_ORIGIN", process.env.CORS_ORIGIN],
    ["JWT_SECRET", config.jwtSecret],
    ["REFRESH_TOKEN_SECRET", config.refreshSecret],
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
    maxAge: refreshTokenTtlSeconds
  } as const;
}

export function createPasswordHash(password: string): string {
  const salt = randomBytes(24).toString("base64url");
  const hash = pbkdf2Sync(password, salt, passwordHashIterations, 64, "sha512").toString("base64url");
  return `pbkdf2-sha512$${passwordHashIterations}$${salt}$${hash}`;
}

export function createAccessToken(subject: string): string {
  const config = getAuthConfig();
  if (!config.jwtSecret) {
    throw new Error("JWT_SECRET is not set");
  }

  const payload: AccessTokenPayload = {
    sub: subject,
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + accessTokenTtlSeconds
  };

  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`, config.jwtSecret);
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const config = getAuthConfig();
  if (!config.jwtSecret) {
    return null;
  }

  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) {
    return null;
  }

  const expected = sign(`${header}.${body}`, config.jwtSecret);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as AccessTokenPayload;
    if (payload.role !== "admin" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createRefreshToken(subject: string): Promise<string> {
  const token = randomBytes(48).toString("base64url");
  const records = await readRefreshTokens();
  const now = new Date();

  records.push({
    tokenHash: hashRefreshToken(token),
    subject,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + refreshTokenTtlSeconds).toISOString()
  });

  await writeRefreshTokens(pruneExpired(records));
  return token;
}

export async function rotateRefreshToken(
  token: string,
  validateSubject: (subject: string) => Promise<boolean> = async () => true
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashRefreshToken(token);
  const records = pruneExpired(await readRefreshTokens());
  const record = records.find((item) => safeEqual(item.tokenHash, tokenHash));

  if (!record) {
    await writeRefreshTokens(records);
    return null;
  }

  if (!(await validateSubject(record.subject))) {
    await writeRefreshTokens(records.filter((item) => !safeEqual(item.tokenHash, tokenHash)));
    return null;
  }

  const nextRecords = records.filter((item) => !safeEqual(item.tokenHash, tokenHash));
  await writeRefreshTokens(nextRecords);

  const accessToken = createAccessToken(record.subject);
  const refreshToken = await createRefreshToken(record.subject);
  return { accessToken, refreshToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashRefreshToken(token);
  const records = await readRefreshTokens();
  await writeRefreshTokens(records.filter((item) => !safeEqual(item.tokenHash, tokenHash)));
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function hashRefreshToken(token: string): string {
  const secret = process.env.REFRESH_TOKEN_SECRET ?? "";
  return createHmac("sha256", secret).update(token).digest("hex");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
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

async function readRefreshTokens(): Promise<RefreshTokenRecord[]> {
  try {
    const data = await fs.readFile(refreshTokensPath, "utf-8");
    return JSON.parse(data) as RefreshTokenRecord[];
  } catch {
    return [];
  }
}

async function writeRefreshTokens(records: RefreshTokenRecord[]) {
  await fs.mkdir(path.dirname(refreshTokensPath), { recursive: true });
  await fs.writeFile(refreshTokensPath, JSON.stringify(records, null, 2), "utf-8");
}

function pruneExpired(records: RefreshTokenRecord[]) {
  const now = Date.now();
  return records.filter((record) => new Date(record.expiresAt).getTime() > now);
}
