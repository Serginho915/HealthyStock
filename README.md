# HealthyStock

Full-stack blog platform where AI writes as Maria Iordanova in the style of "Bloomberg for Healthy Stocks".

## Stack

- Backend: Node.js, Express, TypeScript
- Frontend: Next.js (App Router), React, TypeScript, SCSS
- Infra: Docker, Docker Compose, PostgreSQL
- AI writing: OpenRouter API
- Newsletter: SMTP via Nodemailer

## Project Structure

- /backend
- /frontend
- /backend/Dockerfile
- /frontend/Dockerfile
- /docker-compose.yml
- /docker-compose.prod.yml

## Features

- Custom non-standard hero section
- Blog feed on homepage
- Individual blog article page
- Article search/filter
- SMTP subscription form and API
- OpenRouter endpoint for generating new articles from master prompt
- Admin panel for creating/editing articles and generation settings
- Draft/published article status, delete for generated/overridden posts, and backend audit logging
- Protected DB-backed admin auth with access token and httpOnly refresh cookie
- SEO setup: meta tags, Open Graph, canonical tags, JSON-LD, Next robots and sitemap routes, semantic markup

## Local Development (Docker)

1. Copy env templates:
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
2. Fill OpenRouter, `JWT_SECRET`, and `REFRESH_TOKEN_SECRET` in `backend/.env`.
   - For Docker, `DATABASE_URL` is overridden by `docker-compose.yml` and points to the `postgres` service.
   - SMTP can stay empty locally unless you want to test email subscriptions.
3. Run:
   - `docker compose up -d --build`
4. Create the first superadmin:
   - `docker compose exec backend npm run create-superadmin -- admin@yourdomain.com 'your-strong-password-here'`
5. Open:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000/api/health
   - Admin: http://localhost:3000/admin

## Admin Setup

Admin accounts are stored in PostgreSQL, not in `.env`. The database stores only `password_hash`, never the plain password.

With Docker:

- `docker compose exec backend npm run create-superadmin -- admin@yourdomain.com 'your-strong-password-here'`

Without Docker, point `DATABASE_URL` to PostgreSQL first, then run:

- `cd backend`
- `npm run create-superadmin -- admin@yourdomain.com 'your-strong-password-here'`

In the admin login screen, enter the email and the original password you chose. Re-running `create-superadmin` for the same email resets that user's password and keeps the account active with `superadmin` role.

Do not use `ADMIN_USERNAME`, `ADMIN_PASSWORD`, or `ADMIN_PASSWORD_HASH`. Those env-based credentials were replaced by the database-backed admin system.

## Auth Troubleshooting

If the admin page shows `Failed to fetch`, first check that the backend is alive:

- `curl http://localhost:4000/api/health`
- `docker compose ps`
- `docker compose logs --tail=120 backend`

If this happened after switching from the old env-based auth to DB auth, the browser may still have an old `hs_refresh_token` cookie. Clear cookies for `localhost`, refresh `/admin`, and sign in again.

You can also clear stored refresh tokens locally:

- stop the backend or make sure nobody is logged in
- delete `backend/data/refresh-tokens.json`
- restart backend: `docker compose restart backend`

This only logs admins out. It does not delete users from PostgreSQL.

## Production Secrets

Set stable, strong secrets in `backend/.env.production` or your hosting secret manager:

- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`

Generate them once, keep them stable, and do not commit them:

- `cd backend && npm run generate-secrets`

Do not generate these secrets on every app startup. Changing them invalidates active admin sessions and refresh tokens.

For production Docker deploys, also set:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

## Production Deployment (Docker)

1. Generate production env files:
   - `npm run setup:prod-env`
   - the script keeps existing non-placeholder values and only generates missing placeholder secrets
2. Review generated files:
   - root `.env.production`
   - `backend/.env.production`
3. Replace placeholders:
   - root `.env.production`: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`
   - `backend/.env.production`: `CORS_ORIGIN`, `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, SMTP values if needed
   - optional OpenRouter tuning is available through `OPENROUTER_TIMEOUT_MS`, `OPENROUTER_MAX_INPUT_CHARS`, `OPENROUTER_MAX_OUTPUT_TOKENS`, and `OPENROUTER_TEMPERATURE`
   - root `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` are used by Docker Compose
   - backend `DATABASE_URL` is generated from the same root `POSTGRES_*` values, so Docker and backend stay aligned
   - generated `POSTGRES_PASSWORD`, `JWT_SECRET`, and `REFRESH_TOKEN_SECRET` should stay stable and should not be regenerated on every deploy
4. Build and start:
   - `docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d`
5. Create the first superadmin:
   - safer shell-history friendly form:
     - `SUPERADMIN_PASSWORD='your-strong-production-password' docker compose --env-file .env.production -f docker-compose.prod.yml exec -e SUPERADMIN_PASSWORD backend npm run create-superadmin -- admin@yourdomain.com`
   - direct form:
     - `docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run create-superadmin -- admin@yourdomain.com 'your-strong-production-password'`
6. Verify:
   - `docker compose --env-file .env.production -f docker-compose.prod.yml ps`
   - `curl http://localhost:4000/api/health`

Production backend will refuse to start if required secrets are missing, if `JWT_SECRET` and `REFRESH_TOKEN_SECRET` are equal, if secrets are too short, or if production CORS/site URLs still point to `localhost`.

## Local Development (without Docker)

1. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Start backend:
   - `cd backend && npm run dev`
3. Start frontend:
   - `cd frontend && npm run dev`

## Production Ports

- Frontend container is exposed on host port `8080`.
- Backend container is exposed on host port `4000`.
- PostgreSQL is not exposed publicly in `docker-compose.prod.yml`; it is available only inside the Docker network.

Put a reverse proxy such as Nginx, Caddy, Traefik, or your hosting platform in front of these containers for HTTPS and public domains.

An Nginx starting point is available in `nginx.sample`. It proxies `/api/` to backend port `4000` and all frontend traffic to port `8080`.

## API Summary

- `GET /api/health`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /api/posts/search?q=...`
- `POST /api/subscribe` with `{ "email": "..." }`
- `POST /api/ai/generate-article` with `{ "topic": "..." }` - admin access token required
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/admin/posts`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:slug`
- `DELETE /api/admin/posts/:slug`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`

## Notes

- Set `NEXT_PUBLIC_SITE_URL`, `CORS_ORIGIN`, and cookie domain settings when deploying to a real domain.
- Generated/admin-edited posts are stored in `backend/data/generated-posts.json`.
- Admin settings are stored in `backend/data/admin-settings.json`.
- Refresh sessions are stored in `backend/data/refresh-tokens.json`.
- Audit events are stored in `backend/data/audit-log.jsonl`.
- Runtime data files are ignored by git. Back up the backend data volume in production.
- Admin users and password hashes are stored in PostgreSQL. Back up the PostgreSQL volume in production.
- Admin article HTML is sanitized before saving. Back up both the PostgreSQL volume and backend data volume in production.
- Production Docker images do not include local `backend/data` files, `.env`, `node_modules`, `.next`, or TypeScript build cache.
