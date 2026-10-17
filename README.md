# FreeVer

Student Assistant reliever system: the admin imports the S.A schedule once, every S.A logs in, picks the days they need a reliever, reviews who is free, and copies a ready-to-send Messenger message.

Stack: Vue 3 + Vite + Tailwind CSS (static site) and **Supabase** (database, login, and an Edge Function that keeps the AI key secret).

## 1. Set up Supabase (free)
1. Create a project at https://supabase.com.
2. **SQL editor**: paste and run `supabase/migrations/001_init.sql`, then `002_labs.sql` (laboratory schedule), then `003_hardening.sql` (security, clear sign-up errors, password reset). Run all three in order; each is safe to run twice.
   **Before you publish the site**, set the admin setup code so a stranger cannot become the admin:
   ```sql
   insert into public.app_config (id, admin_code) values (1, 'choose-a-long-secret')
   on conflict (id) do update set admin_code = excluded.admin_code;
   ```
3. **Authentication > Providers > Email**: turn **off** "Confirm email" (accounts use a private generated e-mail, people log in with Student ID or S.A name).
4. **Project Settings > API**: copy the *Project URL* and the *anon public key* into `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   The anon key is public by design; the data is protected by row level security.
5. **AI (optional but recommended)** - needs the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase secrets set --env-file supabase/.env      # GEMINI_API_KEY=... (free key from aistudio.google.com/apikey)
   supabase functions deploy ai --no-verify-jwt
   ```
   The key lives only on the server and is never in the website.
   **Verify JWT must be off** for this function (`--no-verify-jwt`, or Edge Functions > ai > Details > turn off "Verify JWT with legacy secret"). The function still requires a logged-in admin; the gateway check only blocks the browser's CORS preflight and causes "blocked by CORS policy" errors.

## 2. Run
```
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
npm test           # unit tests for the schedule, reliever and message logic
```
Tip: if the project lives in a OneDrive/Dropbox folder, exclude `node_modules` from syncing. A half-synced `node_modules` causes confusing build errors such as "Could not resolve './lib/websocket-factory'"; delete `node_modules` and run `npm install` again to fix it.

## 3. First use
- **The first account created becomes the admin**, so create yours first. If you set an admin setup code (step 1), the Create account form asks for it on that first account only.
- **Admin, once:** import the S.A schedule (ITO DEPARTMENT sheet: yellow = duty, blue = class) and press **Save to database**. Then choose the **Laboratory Schedule picture**: FreeVer reads every room and its open hours automatically (needs the AI function, step 5). Check the table, make sure each row has a room name (for example `5501`), and press **Save laboratory schedule**.
- **Every S.A:** register with your **Student ID** and **S.A name** (it must match the schedule), log in, pick the day(s) Monday-Saturday, and FreeVer compares each room's open hours with everyone's duty and class hours. It builds an hourly list per room, rotating the names. A name with **(OT)** is covering outside their own duty hours.
- Review the list (Leave/Absent re-picks the hour automatically; Change lets you choose anyone), then copy the message, which looks like this:
  ```
  @LJ's Temporary Relievers for Today

  (5501)
  7:00am - 8:00am — @Angelica
  8:00am - 9:00am — @Marianne
  9:00am - 10:00am — @Andrei (OT)
  ```
  You can change the title and closing line in Settings > Message.
- Column order: by default the **first name of each pair is the right column**. Untick the box on the import screen to read it the other way. In the review screen each reliever has a "Columns look swapped?" link for a single block (this change is only for your session).

## Privacy and security notes
- Names of other students are never listed: you only see your own name and the relievers you pick.
- Database access is limited by row level security: any logged-in S.A can *read* the schedule (needed to work out who is free); only the admin can change it. The schedule data is therefore visible to logged-in users who inspect network traffic.
- The AI function is for the **admin only**, limits image size, and limits requests per minute (counted in the database, so it holds across server instances). Schedule checks send students as S1, S2... (no names).
- **Keep `supabase/.env` out of synced/shared folders** and never commit it. It only needs `GEMINI_API_KEY`; remove `SUPABASE_SECRET_KEY` from it (nothing uses it) and rotate any key that was ever shared. Optional: set the `GEMINI_MODEL` secret (default `gemini-2.5-flash`) if Google renames or retires the model.
- **Forgot password?** The admin opens Settings > "Help a student who forgot their password" and sets a temporary password. Students can change their own password in Settings.
- Sign-in does not reveal whether a Student ID or name exists. Registration still has to say when an ID or name is already taken.
- A Content-Security-Policy is added to the production build. Dependencies: `npm audit` reports 0 vulnerabilities (SheetJS is installed from cdn.sheetjs.com, the patched source).

## Deploy free
- **Cloudflare Pages / Netlify**: build command `npm run build`, output `dist`, add the two `VITE_SUPABASE_*` variables.
- **GitHub Pages**: push to GitHub, add the two values as repository secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), enable Pages with "GitHub Actions" (`.github/workflows/deploy.yml`).
