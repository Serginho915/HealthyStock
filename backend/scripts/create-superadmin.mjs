import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";

const [, , emailArg, passwordArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error("Usage: npm run create-superadmin -- admin@example.com 'strong-password'");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await initDb();
  const email = emailArg.trim().toLowerCase();
  const passwordHash = createPasswordHash(passwordArg);
  const result = await pool.query(
    `INSERT INTO users (id, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'superadmin', TRUE)
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'superadmin',
       is_active = TRUE,
       updated_at = NOW()
     RETURNING email, role`,
    [crypto.randomUUID(), email, passwordHash]
  );

  console.log(`Superadmin ready: ${result.rows[0].email} (${result.rows[0].role})`);
} finally {
  await pool.end();
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'superadmin')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)
  `);
}

function createPasswordHash(password) {
  const iterations = 310_000;
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("base64url");
  return `pbkdf2-sha512$${iterations}$${salt}$${hash}`;
}
