# PRO HealthTrack

HealthTrack is a Next.js app with PostgreSQL-backed API routes for user login, submissions, document metadata, and admin analytics.

## Local Development

```bash
npm install
npm run dev
```

Create `.env.local` in this project root:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=
```

Apply the database schema from `database/schema.sql` to your Neon/PostgreSQL database.

## Deployment

Recommended deployment split:

- Database: Neon PostgreSQL
- Backend/API: Render
- Frontend: Vercel

### Neon

1. Create a Neon PostgreSQL database.
2. Run `database/schema.sql`.
3. Copy the pooled connection string for `DATABASE_URL`.

### Render Backend

Create a Render Web Service from this repo.

Use:

```bash
npm install
npm run build
npm run start
```

Set environment variables:

```env
DATABASE_URL=your_neon_connection_string
FRONTEND_URL=https://your-vercel-app.vercel.app
NEXT_PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app
```

### Vercel Frontend

Import the same repo in Vercel.

Set environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com
NEXT_PUBLIC_FRONTEND_URL=https://your-vercel-app.vercel.app
```

The frontend uses `NEXT_PUBLIC_API_BASE_URL` to call the Render API with credentials.

## Verification

```bash
npm run lint
npm run build
```
