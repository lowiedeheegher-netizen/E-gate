# E-gate v1.1.0 — Render Free + Supabase Free

No Render Persistent Disk needed. Supabase stores everything.

## 1. Supabase — create project & run SQL

Create a new Supabase project, then open:
`Supabase → SQL Editor → New query`

Paste the contents of `SUPABASE_SETUP.sql` and click **Run**.

This creates:
- `public.gates` (with `is_active` column)
- `public.submissions` (with email index)
- Atomic counter RPC functions
- Storage bucket `egate`

### Upgrading from v1.0?
Run only this line in the SQL editor:
```sql
alter table public.gates add column if not exists is_active boolean not null default true;
```
Then re-run the `create or replace function` blocks from the SQL file.

## 2. Supabase keys

`Supabase → Project Settings → API`

Copy:
- **Project URL**
- **`service_role` key** (never expose this in browser code)

## 3. Render environment variables

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://your-ref.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
| `SUPABASE_BUCKET` | `egate` |
| `ADMIN_EMAIL` | your login email |
| `ADMIN_PASSWORD` | strong password |
| `ADMIN_NAME` | your artist name |
| `JWT_SECRET` | long random string |

### Optional: email notifications
Receive an email whenever someone downloads a track.

| Variable | Example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `you@gmail.com` |
| `SMTP_PASS` | Gmail App Password |
| `SMTP_FROM` | `E-gate <you@gmail.com>` |
| `NOTIFY_EMAIL` | email to receive alerts (defaults to ADMIN_EMAIL) |

For Gmail: use an [App Password](https://myaccount.google.com/apppasswords), not your regular password.

## 4. Deploy

Push to GitHub → Render picks it up automatically.

After deploy, check:
```
/api/health
```

Expected response:
```json
{
  "ok": true,
  "version": "1.1.0",
  "storage": "supabase",
  "emailNotifications": true
}
```

## What's new in v1.1.0

- **Secure downloads** — a one-hour JWT token is issued after the gate is completed. Direct `/download/:slug` links without a token are rejected.
- **No race conditions** — view and download counters use atomic SQL RPCs instead of read+write.
- **Duplicate prevention** — the same email can't spam your mailing list for the same gate.
- **Rate limiting** — max 5 gate submissions per IP per 10 minutes.
- **Gate on/off switch** — pause a gate from the dashboard without deleting it. Visitors see a "gate is closed" page.
- **Email alerts** — optional: get notified immediately when someone downloads.
- **Streaming downloads** — large WAV files stream directly from Supabase Storage instead of being fully buffered in memory.
- **30-day chart** — stats page now shows a bar chart of daily downloads.
- **Drag-to-reorder** — custom steps in the builder can be reordered by dragging.
