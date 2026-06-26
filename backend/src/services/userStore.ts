import { randomUUID } from "node:crypto";
import { createPasswordHash, verifyPasswordHash } from "./auth.js";
import { query } from "./db.js";

export type AdminRole = "admin" | "superadmin";

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const normalizedEmail = normalizeEmail(email);
  const rows = await query<UserRow>(
    `SELECT id, email, password_hash, role, is_active, created_at, updated_at, last_login_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findActiveAdminById(userId: string): Promise<AdminUser | null> {
  if (!isUuid(userId)) {
    return null;
  }

  const rows = await query<UserRow>(
    `SELECT id, email, password_hash, role, is_active, created_at, updated_at, last_login_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  const user = rows[0] ? mapUser(rows[0]) : null;
  if (!user || !user.isActive || !isAdminRole(user.role)) {
    return null;
  }

  return user;
}

export async function verifyAdminUserCredentials(email: string, password: string): Promise<AdminUser | null> {
  const user = await findAdminByEmail(email);
  if (!user || !user.isActive || !isAdminRole(user.role)) {
    return null;
  }

  return verifyPasswordHash(password, user.passwordHash) ? user : null;
}

export async function touchAdminLastLogin(userId: string) {
  await query(
    `UPDATE users
     SET last_login_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

export async function upsertSuperadmin(email: string, password: string): Promise<AdminUser> {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = createPasswordHash(password);
  const rows = await query<UserRow>(
    `INSERT INTO users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'superadmin', TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'superadmin',
       is_active = TRUE,
       updated_at = NOW()
     RETURNING id, email, password_hash, role, is_active, created_at, updated_at, last_login_at`,
    [randomUUID(), normalizedEmail, passwordHash]
  );

  return mapUser(rows[0]);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isAdminRole(role: string): role is AdminRole {
  return role === "admin" || role === "superadmin";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  };
}
