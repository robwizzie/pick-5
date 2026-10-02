# Deploying Pick 5 to Cloudflare Workers

The app runs on Cloudflare Workers through the official adapter
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Nothing else changes for users:
same URLs, same Google login, same MongoDB Atlas database, same emails and push notifications.

> Dashboard labels below are the ones in use when this was written. If one has moved, the
> Cloudflare docs page for that feature will have the current path.

## What is in the repo

| File | Purpose |
| --- | --- |
| `wrangler.jsonc` | Worker config: name `pick-5`, `nodejs_compat`, static assets, the two cron schedules |
| `open-next.config.ts` | OpenNext config. Prerendered pages are served from Workers Static Assets (no R2/KV needed) |
| `cloudflare/worker.ts` | Worker entry: the generated Next.js worker, a `scheduled` handler for cron, and closing each request's MongoDB connection |
| `src/lib/db.ts` | On Workers each request gets its own MongoDB connection. On Node.js and Vercel it works as before |
| `.dev.vars.example` | Template for local `npm run preview` secrets |

`vercel.json` is unchanged, so the app still builds and runs on Vercel.

## Before you start: the free-plan limits

The Workers **Free** plan allows **10 ms of CPU time per invocation** (Cron Triggers included),
**100,000 requests/day** and a **3 MiB gzipped** Worker.

- **Size:** the Worker is about 2.3 MiB gzipped, so it fits.
- **CPU, pages:** the landing, login and other prerendered pages are served from static assets
  and stay well under the CPU limit.
- **CPU, API routes:** routes that use the database are likely to exceed 10 ms. Measured locally,
  a warm database route costs about 7–10 ms of CPU, and opening the per-request MongoDB
  connection adds about 7 ms (TLS and auth not included). Requests that go over the limit fail
  with error **1102**.
- **CPU, bcrypt:** creating a league with a password, or joining one, runs bcrypt (about
  80–100 ms of CPU). These requests will fail on the Free plan.
- **CPU, cron:** the weekly cron jobs render one email per user (about 6 ms each, plus about
  60 ms the first time). These will also exceed 10 ms on the Free plan.

**Recommendation:** deploy on the Free plan and watch the Worker's Observability logs for
`exceededCpu` / error 1102 outcomes. If they appear, upgrade to **Workers Paid** ($5/month,
30 s CPU per request and 10M requests/month). Upgrading needs no code changes.

## 1. Create the Worker from GitHub (Workers Builds)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → pick
   `robwizzie/pick-5`.
2. The project/Worker name **must be `pick-5`**, the same as `"name"` in `wrangler.jsonc`.
   Workers Builds fails if the two differ, and the `WORKER_SELF_REFERENCE` binding uses this
   name.
3. Build settings:
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
     (do *not* use plain `wrangler deploy`: the OpenNext deploy step also uploads the
     prerendered-page cache, and without it every page is re-rendered on every request)
   - **Non-production branch deploy command (optional):** `npx opennextjs-cloudflare upload`
   - **Root directory:** `/` (repo root)
   - Build variables: none required. Optionally set `NODE_VERSION=22`.
4. Production branch: `main`. Pushes to `main` then build and deploy automatically.

Deploying from your own machine instead:

```bash
npm ci
npx wrangler login
npm run deploy        # = opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

## 2. Variables and secrets (runtime)

Set these in the Worker → **Settings** → **Variables and Secrets** (choose type *Secret* for
secrets), or from a terminal with `npx wrangler secret put NAME`. `wrangler.jsonc` sets
`keep_vars: true`, so deploys don't wipe plain variables set in the dashboard.

None of these are needed at **build** time. The code reads all of them at runtime.

| Variable | Secret? | Required | Notes |
| --- | --- | --- | --- |
| `MONGODB_URI` | **secret** | yes | Atlas connection string (`mongodb+srv://…`) |
| `NEXTAUTH_SECRET` | **secret** | yes | Copy the value from Vercel, or existing sessions are logged out |
| `NEXTAUTH_URL` | plain | yes | Canonical site URL, e.g. `https://sportspick5.com` (use whichever host Vercel used today). Also used for invite links and as the cron request origin |
| `GOOGLE_ID` | plain (secret ok) | yes | Google OAuth client ID |
| `GOOGLE_SECRET` | **secret** | yes | Google OAuth client secret |
| `CRON_SECRET` | **secret** | yes | Protects `/api/cron/*`. The scheduled handler sends it as `Authorization: Bearer …` |
| `RESEND_API_KEY` | **secret** | yes (emails) | |
| `VAPID_PUBLIC_KEY` | plain | yes (push) | Public by design (served by `/api/push/vapid-public-key`) |
| `VAPID_PRIVATE_KEY` | **secret** | yes (push) | Must be the same pair as on Vercel, or existing push subscriptions stop working |
| `VAPID_SUBJECT` | plain | optional | Defaults to `mailto:noreply@sportspick5.com` |
| `ODDS_API_KEY` | **secret** | yes (odds) | New name. The old `NEXT_PUBLIC_ODDS_API_KEY` is still read as a fallback. The key is only used server-side |
| `NEXT_PUBLIC_BASE_URL` | plain | optional | Used only in email links. Defaults to `https://www.sportspick5.com` |

Don't set `NODE_ENV`. The build sets it to `production`, which is what makes the cron routes
require `CRON_SECRET`.

## 3. Cron Triggers

Nothing to click: `wrangler.jsonc` declares the same two UTC schedules as `vercel.json`:

- `0 9 * * 0` (Sunday 09:00 UTC)
- `0 14 * * 1,2,4,5,6` (Mon/Tue/Thu/Fri/Sat 14:00 UTC)

Both run the `scheduled` handler in `cloudflare/worker.ts`. It calls `GET /api/cron/master`
in-process with `Authorization: Bearer $CRON_SECRET`, so the route's own auth check still gates
the job, and the route decides what to do from the day of the week (as on Vercel). After the
first deploy, the Worker's **Settings → Trigger Events** should list both crons. Past runs and
their logs are on the Worker's cron/observability views. Cron runs count against the same
Free-plan CPU limit (see above).

Run cron locally: `npm run preview`, then
`curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+14+*+*+1,2,4,5,6"`.

## 4. Test on the workers.dev URL first

After the first deploy the Worker is reachable at `https://pick-5.<your-subdomain>.workers.dev`.
To test Google login there before moving the domain:

1. Temporarily set `NEXTAUTH_URL` to that workers.dev URL.
2. In Google Cloud Console → APIs & Services → Credentials → your OAuth client, add
   `https://pick-5.<your-subdomain>.workers.dev/api/auth/callback/google` to **Authorized
   redirect URIs**.
3. Test login, the dashboard, making picks and a league page. Then set `NEXTAUTH_URL` back to
   the real domain.

## 5. Move sportspick5.com (and www) from Vercel to the Worker

A Worker Custom Domain needs the domain's DNS on Cloudflare.

1. **Add the domain to Cloudflare** (Free plan) if it isn't there yet. Then, **before changing
   nameservers**, copy every existing DNS record from wherever DNS is hosted today (Vercel or
   your registrar). This matters most for **Resend's records** (SPF/DKIM `TXT`, the `MX` on
   the bounce subdomain) and any `MX` for mailboxes. Missing them breaks email sending. Leave out
   the records that point the website at Vercel (`A 76.76.21.21` / `CNAME cname.vercel-dns.com`).
2. Change nameservers at your registrar to the two Cloudflare nameservers and wait until
   Cloudflare shows the zone as active.
3. Worker → **Settings → Domains & Routes → Add → Custom domain**: add `sportspick5.com`, then
   add `www.sportspick5.com`. Cloudflare creates the DNS records and certificates.
4. Pick one canonical host (the same one as `NEXTAUTH_URL`) and redirect the other one to it,
   so login cookies and callbacks always use one host. One way is a free Redirect Rule in the
   zone (**Rules → Redirect Rules**, e.g. `www.sportspick5.com/*` → `https://sportspick5.com/${1}`,
   301, keep the query string). If you go this route, `www` only needs a proxied DNS record for
   the rule to catch it, not a Custom Domain.
5. Google Cloud Console → OAuth client:
   - **Authorized redirect URIs:** `https://sportspick5.com/api/auth/callback/google`, plus the
     `www` variant if it is the canonical host.
   - **Authorized JavaScript origins:** `https://sportspick5.com`, plus `www` if used.
6. Once the site loads from Cloudflare, remove the domains from Vercel (Project → Settings →
   Domains → Remove). Then disable the Vercel crons, or delete or pause the Vercel project, so
   the cron jobs don't run twice if Vercel comes back.

## 6. MongoDB Atlas network access

Workers don't connect from fixed IP addresses, so an Atlas IP allow-list can't name them. In
Atlas → **Network Access** → **IP Access List**, allow `0.0.0.0/0`. If it's already there for
Vercel, nothing changes.

That makes the cluster reachable from anywhere, and the credentials become the only protection.
To keep the risk low:

- Use a dedicated database user with a long random password (32+ characters), limited to
  `readWrite` on this app's database only (not `atlasAdmin` / any-database roles).
- Keep TLS on (Atlas enforces it, and the `mongodb+srv` string turns it on).
- Rotate the password if it might have leaked, and update the `MONGODB_URI` secret.

Connection notes for Workers:

- `mongodb+srv://` strings need DNS SRV/TXT lookups. Workers do these over DNS-over-HTTPS. If
  connections fail with `querySrv` errors, use Atlas's non-SRV ("standard") connection string
  instead.
- Each request opens and closes its own MongoDB connection. That's a Workers rule, since
  sockets can't be shared between requests. It adds a little latency (a TLS handshake to
  Atlas) per database request. The free Atlas tier allows 500 concurrent connections, which is
  plenty at this app's traffic.

## 7. Request budget (Free plan: 100,000/day)

Static files (`/_next/static/*`, images, fonts) are served by Workers Static Assets and are not
counted. Everything else (pages, `/api/*`) counts. The client polls:

| Poller | Interval | Requests per poll |
| --- | --- | --- |
| League page recap check | 2 min, always | 1 |
| Leaderboard / Results / SeasonStats (active tab) | 2 min during game windows, else 5 min | 1–3 |
| WeeklyPicks | same, only while games are live | ~1–2 |
| `useGameNotificationPolling` (every page, signed-in users) | 5 min during game windows | 1 |

One league tab left open costs about **55 requests/hour** outside game windows and about
**100/hour** during games, which is roughly **1,300–2,400 requests/day**. Background tabs keep
polling (browsers only throttle them). So about 40–75 tabs left open all day would use up the
daily budget, before counting normal page loads (~5–10 requests each). Past the limit, requests
fail until the daily reset (00:00 UTC).

To get more headroom, pause polling while `document.visibilityState === 'hidden'`.

## 8. Local preview in the Workers runtime

```bash
cp .dev.vars.example .dev.vars   # fill in values
npm run preview                  # builds, then serves the Worker locally (workerd)
```

`npm run dev` (plain `next dev`) still works for day-to-day development and reads `.env.local`.

## Rolling back

Vercel still works as before. To roll back, point the domain at Vercel again and unpause the
Vercel project. Cloudflare also keeps previous Worker versions (Worker → Deployments) for a
one-click rollback.
