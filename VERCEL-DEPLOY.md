# HisabFlow — Vercel deployment

This repository is **one application containing Cognifyz Tasks 1–6**. Do not import the Task-1/Task-2 folders as separate Vercel projects.

## 1. Push the entire project to one GitHub repository

The repository root must contain `package.json`, `server.js`, `api/index.js`, `vercel.json`, `views/`, `public/`, `routes/`, `models/`, `middleware/`, `services/`, and `Task-1` through `Task-6` documentation folders.

## 2. Import that one repository into Vercel

Use **Add New → Project → Import** and select the GitHub repository.

Recommended settings:
- Framework Preset: Other
- Root Directory: `.`
- Build Command: leave empty
- Output Directory: leave empty
- Install Command: `npm install`

## 3. Add Environment Variables

Add these in Vercel for the Production environment:

- `MONGODB_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — a random secret of at least 32 characters
- `NODE_ENV` — `production`

Do not commit a real `.env` file.

## 4. Deploy

Vercel uses `api/index.js` as the serverless entry point and rewrites requests through Express. MongoDB is connected lazily on the first request and reused when possible.

## 5. Test

Open the deployment URL and test:
1. Create shop account
2. Log in
3. Add customer
4. Add credit/payment transaction
5. Open Today's Follow-ups
6. Open customer ledger
7. Test WhatsApp reminder link
8. Open Daily Closing
9. Create a second shop and verify its data is isolated

If deployment fails, copy the exact Vercel build/runtime error before changing code.
