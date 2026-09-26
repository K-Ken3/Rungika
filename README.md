# Rungika Business Management SaaS

Rungika is a multi-tenant business management platform. Business owners onboard a
business, structure units, invite people, build custom tables and records, and
manage a simple monthly subscription. A separate, server-enforced Super Admin
area reviews payments, controls subscription states, and audits activity.

## Stack

- Next.js 16 (App Router, React 19, TypeScript)
- PostgreSQL with Prisma ORM
- Tailwind CSS 4 for styling
- Opaque server-managed sessions stored in PostgreSQL, bcrypt password hashing
- Zod validation, per-action rate limiting, private on-disk upload storage

## Requirements

- Node.js 20 or newer
- PostgreSQL 14 or newer (a local Docker service is provided)
- Optional: an email provider for verification, password reset, and notification email

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL:

```bash
docker compose up -d db
```

3. Create the environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

4. Create the schema and seed baseline data:

```bash
npm run db:migrate
npm run db:seed
```

The seed synchronizes the business permission catalog, creates the default
`PlatformSetting` and `Plan` rows, and creates a Super Admin account when
`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` are set. The password must be at
least 12 characters. Leaving those variables unset never disables a role or
grants access by default.

5. Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string used by Prisma |
| `NEXT_PUBLIC_APP_URL` | recommended | Canonical application origin used in verification and reset links |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | recommended | Contact address rendered on public pages |
| `CRON_SECRET` | production | Bearer token required by `GET /api/cron/billing` |
| `PRIVATE_UPLOAD_DIR` | optional | Absolute directory for private payment proof files. Defaults to `var/uploads` |
| `EMAIL_PROVIDER` | optional | `resend`, `webhook`, or `smtp` |
| `EMAIL_API_KEY` | optional | API key for the selected email provider |
| `RESEND_API_KEY` | optional | Alias used when `EMAIL_PROVIDER=resend` |
| `EMAIL_FROM` | optional | Sender address used for transactional email |
| `EMAIL_PROVIDER_URL` | optional | Webhook endpoint when `EMAIL_PROVIDER=webhook` |
| `SMTP_HOST` | optional | SMTP host when `EMAIL_PROVIDER=smtp`, for example `smtp.gmail.com` |
| `SMTP_PORT` | optional | SMTP port, defaults to `587`. Use `465` for implicit TLS |
| `SMTP_SECURE` | optional | Set to `true` for implicit TLS. Enabled automatically on port `465` |
| `SMTP_USER` | optional | SMTP username. Gmail requires the full address |
| `SMTP_PASSWORD` | optional | SMTP password. Gmail requires a Google App password |
| `SUPER_ADMIN_EMAIL` | seed only | Email for the seeded Super Admin |
| `SUPER_ADMIN_NAME` | seed only | Display name for the seeded Super Admin |
| `SUPER_ADMIN_PASSWORD` | seed only | Password for the seeded Super Admin |

All transactional email goes through one sender in `src/lib/email/send.ts`, which
speaks Resend, a JSON webhook, or SMTP. To use Gmail, create an App password in
Google Account, Security, App passwords, then set:

```bash
EMAIL_PROVIDER="smtp"
EMAIL_FROM="Rungika <your-address@gmail.com>"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-address@gmail.com"
SMTP_PASSWORD="your 16 character app password"
```

Gmail App passwords are credentials. Never commit them, never paste them into
tracked files, and revoke and replace one that has been shared anywhere.

### TLS interception

Certificate verification is on by default and must stay on in production. If
SMTP delivery fails with `self-signed certificate in certificate chain` or
`unable to verify the first certificate`, something between the server and your
mail provider is rewriting TLS. That is a proxy, an ISP, or HTTPS-scanning
antivirus, and it can read mail content and credentials.

Do not solve that by disabling verification. Install the intercepting
certificate instead and point Node at it:

```bash
NODE_EXTRA_CA_CERTS="/path/to/company-ca.pem"
```

`SMTP_TLS_REJECT_UNAUTHORIZED="false"` exists only for local debugging against a
trusted interception proxy. It disables certificate checking for SMTP, so anyone
on the path can read the connection, including the app password. Never set it in
production.

Three messages depend on email delivery: account verification, password reset,
and team invitations. Without a configured provider the application still runs.
Accounts cannot be verified, so sign-in is intentionally refused with a message
asking the user to configure email delivery or contact support. Nothing is
auto-verified, and invitations that cannot be delivered are closed instead of
being left pending.

### Email deliverability and the primary inbox

An SMTP server accepting a message only proves the provider took custody of it.
It does not mean the message reached the recipient's primary inbox, and it is
usually reported as `sent` even when the message is later filtered as spam.

Ranked by how much they actually improve placement:

1. **Serve the app from a real HTTPS domain.** This is the single biggest
   factor. Every email embeds a link built from `NEXT_PUBLIC_APP_URL`. While
   that value is `http://localhost:3000`, every verification, reset, and
   invitation link points at `localhost` over plain HTTP, which spam filters
   treat as a strong negative signal. This is the most likely reason a valid,
   accepted message lands in spam during local testing. Set `NEXT_PUBLIC_APP_URL`
   to the public `https://` origin before judging deliverability.
2. **Authenticate the sending domain with SPF, DKIM, and DMARC.** Publish these
   DNS records for the domain in `EMAIL_FROM`:
   - SPF authorising exactly the provider you send through, and nothing else.
   - DKIM at the selector your provider gives you.
   - DMARC starting at `p=none`, then tightening to `quarantine` and
     `reject` once reports look clean.
   Receiving providers require all three to align for a bulk-sender reputation.
3. **Send from a dedicated subdomain**, for example `mail.example.com`, rather
   than a personal mailbox, so reputation for one sender cannot damage the
   primary domain.
4. **Keep the From address stable and consistent** with the authenticated
   domain. `EMAIL_FROM` should be a branded name at that subdomain, for example
   `Rungika <no-reply@mail.example.com>`. A rotating or mismatched From address
   is a direct reputation hit.
5. **Set `EMAIL_REPLY_TO`** to a monitored mailbox. A working `Reply-To` and
   real human replies are positive engagement signals.
6. **Do not send to seeded or purchased lists.** Bulk and cold-address sending
   cannot reach a primary inbox by configuration alone, and attempting it risks
   the domain.

Gmail will still occasionally filter a legitimate transactional message. Keep
`SPF_TLS_REJECT_UNAUTHORIZED` honest, and make sure the verification, reset, and
invitation flows tell users to check spam, which they now do.

For transactional mail, a dedicated provider on a verified domain delivers far
more predictably than a personal Gmail account using an app password. Resend is
the supported option and needs no application code changes.

### Switching to Resend

1. Add the sending domain in the Resend dashboard, for example
   `mail.example.com`. Resend then shows the exact DNS records it expects.
2. Publish the records Resend gives you. The important ones are:
   - DKIM, usually a `CNAME` at `resend._domainkey.mail.example.com`
   - SPF, either the record Resend provides or
     `TXT @ "v=spf1 include:amazonses.com -all"`
   - DMARC, at `_dmarc.mail.example.com`, starting as
     `v=DMARC1; p=none; rua=mailto:dmarc@example.com`
3. Confirm the domain shows as **Verified** in Resend before sending. Resend
   rejects mail from unverified domains.
4. Set the environment variables:

   ```bash
   EMAIL_PROVIDER="resend"
   RESEND_API_KEY="re_xxxxxxxx"
   EMAIL_FROM="Rungika <no-reply@mail.example.com>"
   EMAIL_REPLY_TO="support@example.com"
   ```

5. Remove the now unused `SMTP_*` and `EMAIL_API_KEY` values, and re-enable
   certificate verification. The `SMTP_TLS_REJECT_UNAUTHORIZED` override exists
   only for the local interception proxy and must not ship to production.

Keep `EMAIL_FROM` on the same verified domain for the life of the deployment.
Rotating the From address resets the reputation you built.

Set `NEXT_PUBLIC_APP_URL` to the public HTTPS origin at the same time. Resend
delivers to the primary inbox reliably, but a `localhost` link inside the
message still causes it to be filtered.

## Billing model

- Default plan: `Business`, `US$3.00` per month, stored as integer minor units.
- **A new business starts with a free first month.** `PlatformSetting.trialDays`
  defaults to `30` (`DEFAULT_TRIAL_DAYS` in `src/lib/billing.ts`). Registering a
  business creates a `PENDING_PAYMENT` subscription whose `currentPeriodEnd` is
  set to now plus the trial, plus an open invoice whose due date is that same
  date. Nothing is charged during the trial.
- `hasPaidOperationalAccess` in `src/components/business/rules.ts` grants full
  workspace access while the trial is running, because the subscription and
  business are both `PENDING_PAYMENT` but `trialEndsAt` is still in the future.
  Once the trial lapses, paid access stops and the business falls through to the
  normal restricted view and the manual Mobile Money confirmation flow.
- Change the trial length, price, or currency in Super Admin under Platform
  settings. Setting `trialDays` to `0` disables the trial and requires payment
  before activation.
- Mobile Money is a manual flow. Owners submit a claim with a transaction
  reference and optional proof file; a Super Admin confirms or rejects it.
  Proof uploads are evidence only and never confirm a payment automatically.
- Confirming a claim records an immutable `Payment`, extends the billing period,
  generates the next invoice, and writes subscription status history.
- Rejections require a reason and remain visible to the owner.
- `ACTIVE` and `GRACE_PERIOD` businesses may use the workspace. `PENDING_PAYMENT`,
  `PAUSED`, `CANCELLED`, expired, or admin-held businesses see a restricted view.
- Amounts, exchange rates, and payment instructions come from `PlatformSetting`.
  The application never invents exchange rates.

## Scheduled billing work

Subscription transitions and payment reminders run from
`GET /api/cron/billing`, which requires `Authorization: Bearer $CRON_SECRET`.
`vercel.json` schedules it hourly. On other platforms, call the same endpoint
from your scheduler of choice.

## Remote database latency

`createBusinessWithDefaults` runs one serializable transaction that creates the
business, subscription, invoice, four roles, their permissions, the owner
membership, an audit entry, and a notification. That is a lot of sequential
round trips inside a single transaction.

Prisma's default interactive transaction limits are 2 seconds to acquire a
connection and 5 seconds to run, which is fine locally but fails against a
distant managed database such as a regional Supabase pooler. The failure surfaces
as `Transaction not found. Transaction ID is invalid`, and it would break
onboarding for real users rather than just in tests.

`src/lib/data/business.ts` therefore sets `maxWait` to 20 seconds and `timeout`
to 60 seconds for this transaction. Keep those values generous. If business
creation still times out, the fix is to place the application in the same region
as the database rather than to raise the limits further.

## Health check

`GET /api/health` runs a `SELECT 1` against the database and returns `200` with
`{"status":"healthy"}` or `503` when the database is unreachable. Point your
platform health check at this route.

## Private file storage

Payment proof uploads are validated by size, declared type, and detected content
type before they are stored. The filename is always a generated UUID plus an
extension derived from the verified MIME type, so a caller can never choose a
path. Downloads are streamed only after the requester is authorized for the
claim's business, and the storage key is never returned by any API. Uploads are
capped at 5 MB and limited to PNG, JPEG, PDF, and WebP.

There are two storage drivers behind one interface, `src/lib/storage/private-upload.ts`:

| Driver | Selected when | Used by |
| --- | --- | --- |
| Supabase Storage | `SUPABASE_STORAGE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set | Production on Vercel |
| Local filesystem | Those two are absent | Local development only |

Set up Supabase storage for any deployment without a persistent disk:

1. Create a bucket in the Supabase dashboard with **Public bucket turned off**.
   Rungika serves every proof through an authorization check, so the bucket must
   stay private.
2. Set `SUPABASE_STORAGE_URL` to `https://YOUR_PROJECT_REF.supabase.co`,
   `SUPABASE_SERVICE_ROLE_KEY` to the project's `service_role` key, and
   `SUPABASE_STORAGE_BUCKET` to the bucket name (`payment-proofs` by default).

The service role key bypasses row level security, so it is server-only. It is
read inside a `"server-only"` module and is never sent to the browser. Never
prefix it with `NEXT_PUBLIC_` and never commit it.

Supabase is deprecating the JWT `service_role` key in favour of secret keys
(`sb_secret_...`), and the legacy key can no longer be rotated in the dashboard.
The driver handles both formats, because they authenticate differently:

| Key format | Headers sent |
| --- | --- |
| Legacy `service_role` JWT (starts `eyJ`) | `apikey` and `Authorization: Bearer` |
| New `sb_secret_...` | `apikey` only |

Neither is interchangeable with the other. A legacy key sent as `apikey` alone is
rejected with a 400, and a secret key sent as `Authorization: Bearer` is
rejected as an invalid JWT. `src/lib/storage/supabase-storage.ts` picks the right
shape from the key prefix, so a secret key is a drop-in replacement. Once you
have switched, deactivate the legacy key under Settings -> API Keys; that step is
what actually revokes a leaked one.

Cloudflare caches responses from the storage API, including authenticated reads.
A proof that had been downloaded once was therefore still served from the edge
after it had been deleted. Every read now appends a unique `?v=` value so the
edge is forced to ask the origin, and a deleted proof genuinely stops resolving.
Do not remove that parameter: the download route's own `Cache-Control:
private, no-store` only protects the user's browser, not this layer.

The local driver writes to `PRIVATE_UPLOAD_DIR` (default `var/uploads`) with
`0o600` file permissions and a `0o700` root directory, and refuses symbolic
links and any path that escapes the root. It is a development convenience only:
serverless filesystems are ephemeral, so a proof uploaded on one instance would
be invisible on the next, and it would be lost on redeploy.

## Security model

- Every business query and action is scoped by both `userId` and `businessId`.
- Module access comes from database role permissions, never from a role name or a
  client-side check.
- Custom table fields can be restricted. A field with no restriction is visible to
  every member who can open the table; a restricted field is only rendered,
  searchable, editable, and exported for members whose role holds at least one of
  the permissions chosen on that field. Hidden values are stripped server-side and
  are preserved unchanged when a record is updated by someone who cannot see them.
- Super Admin access is server-enforced, there is no public registration, and
  there is no public Super Admin listing endpoint.
- Support cases are readable only by their reporter in the business app.
- Sensitive operations write `AuditLog` rows.
- Rate limits cover authentication, invitations, payment submission, exports,
  email delivery, and admin actions.
- Sessions are opaque, revocable, stored server-side, and never trusted from the
  client.
- Internal admin notes are stored separately and are never exposed to owners.

## Backup and restore

Back up the database and the private upload directory together so proof records
stay consistent with their files.

```bash
pg_dump "$DATABASE_URL" --format=custom --file rungika.dump
pg_restore --clean --if-exists --dbname "$DATABASE_URL" rungika.dump
```

Practice restores on a copy of the database before relying on them. Backups must
be encrypted at rest and access-limited, and retention should follow the
privacy policy published on `/privacy`.

## Data retention

Accounts and businesses are disabled or archived rather than silently deleted
when historical billing or audit references exist. A payment proof is deleted
immediately if its claim row cannot be written, so failed submissions do not
leave orphaned files. Proofs attached to rejected or cancelled claims are kept
with the claim so the review history stays auditable; purge them on a retention
schedule once the retention period in the privacy policy expires. In-app
notifications are operational records and are kept for the life of the business.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run verify` runs all four in order.

## Deployment notes

- Apply migrations during deployment with `npm run db:deploy` before serving
  traffic, then run `npm run db:seed` once to ensure the permission catalog and
  platform settings exist.
- Set every variable from the table above in the hosting environment. Do not
  commit `.env`.
- Configure the cron schedule and `CRON_SECRET`.
- Mount persistent storage for `PRIVATE_UPLOAD_DIR`, or switch the storage
  module to object storage behind the same interface.
- `next build` prints a non-fatal "Dynamic filesystem access causes tracing of the
  whole project" warning from `src/lib/storage/local-private-upload.ts`. It
  appears because the local proof directory is resolved at runtime from
  `PRIVATE_UPLOAD_DIR`. The code is split so this module is loaded with a dynamic
  import and is never reached when Supabase storage is configured, but the
  bundler still analyses it statically. It is a build-size concern rather than a
  correctness one. If a deployment ever rejects the bundle for size, delete the
  local driver and its `PRIVATE_UPLOAD_DIR` support entirely and keep only the
  Supabase path.
- Keep `NEXT_PUBLIC_APP_URL` pointing at the public origin so verification and
  password-reset links resolve correctly.

## Production domain and DNS

The production host is `rungika.site`, served at `https://www.rungika.site`.

`NEXT_PUBLIC_APP_URL` must be the `https://` origin. Never point it at `http://`
or at `localhost`: every verification, password-reset, and invitation link is
built from this value, and plain-HTTP or non-public links are a strong reason
mail providers filter a message into spam.

Required DNS records, all managed at the domain registrar:

| Type | Name | Value | Purpose |
| --- | --- | --- | --- |
| `A` or `CNAME` | `www` | the hosting target | Serves the application. **This record must exist** or the apex redirect dead-ends. |
| `URL redirect` | `@` | `https://www.rungika.site/` | Sends the apex to the canonical host. |
| `TXT` | `mail` | `v=spf1 include:amazonses.com -all` | SPF for the sending subdomain. |
| `CNAME` | `resend._domainkey.mail` | value from the Resend dashboard | DKIM signing. |
| `TXT` | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:dmarc@rungika.site` | DMARC, tightened to `quarantine` then `reject` once reports are clean. |

Verify the records before deploying:

```bash
nslookup -type=A www.rungika.site
nslookup -type=CNAME resend._domainkey.mail.rungika.site
```

In the Resend dashboard the sending domain `mail.rungika.site` must show as
**Verified** before any mail is sent, because Resend rejects unverified
senders. Once it is verified and `https://www.rungika.site` loads, set
`NEXT_PUBLIC_APP_URL="https://www.rungika.site"` in the hosting environment and
send a test verification to confirm primary-inbox placement.

