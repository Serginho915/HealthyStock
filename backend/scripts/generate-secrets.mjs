import crypto from "node:crypto";

console.log(`JWT_SECRET=${crypto.randomBytes(64).toString("base64url")}`);
console.log(`REFRESH_TOKEN_SECRET=${crypto.randomBytes(64).toString("base64url")}`);
console.log(`POSTGRES_PASSWORD=${crypto.randomBytes(32).toString("base64url")}`);
