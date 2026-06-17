'use strict';

const express = require('express');

This version does **not** need a Render Persistent Disk.

Render runs the Node.js app. Supabase stores:

- gates
- downloaders / mailing list submissions
- uploaded tracks
- cover images
- view and download stats

## 1. Create Supabase project

Create a new Supabase project.

Then open:

`Supabase → SQL Editor → New query`

Paste the contents of `SUPABASE_SETUP.sql` and click **Run**.

This creates:

- `public.gates`
- `public.submissions`
- private Storage bucket `egate`

## 2. Get Supabase keys

Open:

`Supabase → Project Settings → API`

Copy:

- Project URL
- `service_role` key

Important: use the **service_role** key only on Render as an environment variable. Never place it in frontend/browser code.

## 3. Render settings

On Render, set:

### Build Command

```txt
npm install
```

### Start Command

```txt
npm start
```

### Environment Variables

```txt
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_BUCKET=egate
ADMIN_EMAIL=your-login-email@example.com
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_NAME=Low E
JWT_SECRET=make-this-long-and-random
```

You do **not** need to mount `/var/data` anymore.

## 4. Deploy

Upload this zip or push this project to GitHub and deploy it on Render.

After deploy, test:

```txt
/api/health
```

It should show:

```json
{
  "ok": true,
  "version": "1.0.0-supabase",
  "storage": "supabase",
  "bucket": "egate"
}
```

## Notes

- Existing gates from the old SQLite/local-upload version are not automatically migrated.
- New gates created with this version are stored in Supabase and survive Render sleep/redeploys.
- Large WAV files may upload slower on free hosting. MP3 or WAV masters with reasonable file sizes are safer.
