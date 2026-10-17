# HeRo Shield - Website + Dashboard

Vercel + Supabase. No build step, no dependencies.

## Files
- `index.html` - website
- `dashboard.html` + `assets/dashboard.js` - dashboard (Discord login)
- `heroshield.zip` - the FiveM resource (download button)
- `api/` - backend (Vercel functions)
- `supabase.sql` - database

## Setup
1. **Supabase**: new project → SQL Editor → paste `supabase.sql` → Run.
   Copy the Project URL and the `service_role` key (Settings → API).
2. **Discord**: discord.com/developers → New Application → OAuth2.
   Copy Client ID + Client Secret. Add redirect: `https://heroshield.vercel.app/api/auth/callback`
3. **Vercel**: import this folder → Settings → Environment Variables (see `.env.example`) → Redeploy.

Never put the `service_role` key in the website files. It is only used in `api/`.
