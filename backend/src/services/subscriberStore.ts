import { query } from "./db.js";

export async function addSubscriber(email: string, source: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await query<{ email: string }>(
    `INSERT INTO subscribers (email, source, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (email) DO NOTHING
     RETURNING email`,
    [normalizedEmail, source]
  );

  return result.length > 0;
}
