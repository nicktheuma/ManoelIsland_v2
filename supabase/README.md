# Supabase database setup

`supabase db push` fails if the **Supabase CLI is not installed** (common on Windows). Use one of the options below.

---

## Option A — Supabase Dashboard (easiest, no CLI)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project  
2. Go to **SQL Editor** → **New query**  
3. Copy the full contents of each migration file (in order):

   - `supabase/migrations/20250629120000_initial_schema.sql`
   - `supabase/migrations/20250629130000_rate_limiter.sql`
   - `supabase/migrations/20250629140000_rate_limit_settings.sql`
   - `supabase/migrations/20250629150000_admin_operations.sql`

4. Click **Run**

You should see the three tables (`profiles`, `placed_props`, `user_interventions`) under **Table Editor**.

If Realtime fails because the table is already published, you can ignore that line or run:

```sql
alter publication supabase_realtime add table public.placed_props;
```

only once.

---

## Option B — CLI via npm (recommended for ongoing migrations)

From the project root:

```powershell
# 1. Log in (opens browser)
npx supabase login

# 2. Link to your project (ref is in the dashboard URL)
#    https://supabase.com/dashboard/project/<project-ref>
npx supabase link --project-ref YOUR_PROJECT_REF

# 3. Push migrations
npm run db:push
```

Or use the npm scripts after linking:

| Command | Purpose |
|---------|---------|
| `npm run supabase:login` | Authenticate CLI |
| `npm run supabase:link` | Link local repo to remote project |
| `npm run db:push` | Apply migrations to linked project |

---

## Option C — Install CLI globally (optional)

**Scoop (Windows):**

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**npm global:**

```powershell
npm install -g supabase
```

Then `supabase login`, `supabase link`, and `supabase db push` work from anywhere.

---

## Environment variables (Phase 2.3+)

In `.env` (copy from `.env.example`):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Find these under **Project Settings → API** in the dashboard.

When both variables are set, the app uses Supabase for shared props instead of localStorage.

### Enable anonymous auth (required for placing props)

1. Dashboard → **Authentication** → **Providers**
2. Enable **Anonymous sign-ins**

Visitors are signed in anonymously on first load so `auth.uid()` is available for inserts and rate limiting.

### Rate limiter (Phase 2.2)

Migration `20250629130000_rate_limiter.sql` adds:

- `enforce_placed_prop_rate_limit` trigger — max **3 placements per 5 minutes** per user
- `get_rate_limit_cooldown_seconds()` RPC — used by the frontend countdown timer
- Admin users (`profiles.role = 'admin'`) bypass the limit

### Admin access (Phase 3)

1. Dashboard → **Authentication** → **Users** → **Add user** (email + password)
2. Copy the new user's UUID from the users list
3. SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = 'PASTE_USER_UUID_HERE';
```

4. In the app, press **`P`** or **`Ctrl+Shift+A`** → sign in with that email/password

**Development fallback:** expand "Development password" in the login modal and use `VITE_ADMIN_PASSWORD`.

Admin panel → **Map Operations**:

- **Wipe Map Clutter** — deletes all props placed by non-admin users
- **Lock Current Layout** — sets `is_locked` on all props (regular users cannot edit/delete via RLS)

---

## Tables created

| Table | Purpose |
|-------|---------|
| `profiles` | User identity + role (`user` / `admin`) |
| `placed_props` | Canvas prop state (Realtime-enabled) |
| `user_interventions` | Rate-limit audit log (Phase 2.2) |
