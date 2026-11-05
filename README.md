# Repair Shop SaaS – Admin Web Panel

Next.js admin panel for the mobile repair SaaS platform. Super Admin features: shop management, subscription management, and **master data management** so that all dropdown values in the mobile apps are driven from backend APIs.

## Features

- **Dashboard** – Overview and quick links
- **Shop management** – Create shop, activate shop, suspend shop
- **Subscription management** – Assign plans to shops, manage expiry, view payments (and plans list)
- **Master data (CRUD)** – All values consumed by mobile app dropdowns:
  - Mobile brands (`GET /master/brands`)
  - Mobile models by brand (`GET /master/brands/:id/models`)
  - Repair services (`GET /master/repair-services`)
  - RAM options (`GET /master/ram-options`)
  - Storage options (`GET /master/storage-options`)

## Setup

```bash
cd repair-shop-admin
npm install
cp .env.local.example .env.local
# Edit .env.local: set NEXT_PUBLIC_MASTER_DATA_BASE to your Master Data service URL (e.g. https://api.neargfix.com/master)
npm run dev
```

Open [http://localhost:3000/management](http://localhost:3000/management) — the admin
portal login. Sign in with your auth service credentials (SUPER_ADMIN role) and you
land on `/management/dashboard`. The public customer site is at `/`.

## Deployment

Three branches, one environment each. A push deploys; there is no separate release step.

| Branch | Environment | Bucket variable | Purpose |
|---|---|---|---|
| `Preview` | `preview` | `S3_BUCKET_PREVIEW` | test |
| `Development` | `development` | `S3_BUCKET_DEVELOPMENT` | deploy-test |
| `main` | `production` | `S3_BUCKET_PRODUCTION` | LIVE |

`.github/workflows/deploy-s3.yml` resolves the branch to an environment, picks the
bucket by indexing the vars context with that name, builds the static export and
syncs it to S3. Put a required reviewer on the `production` environment so nothing
auto-ships from `main`.

Repository **variables** (shared by all three environments):

- `AWS_REGION`, `S3_BUCKET_PREVIEW`, `S3_BUCKET_DEVELOPMENT`, `S3_BUCKET_PRODUCTION`
- every `NEXT_PUBLIC_*_BASE` from the table below
- optional `CLOUDFRONT_DISTRIBUTION_PREVIEW` / `_DEVELOPMENT` / `_PRODUCTION`
- optional `NEXT_PUBLIC_BASE_PATH` (only for sub-path hosting)

AWS credentials, either one:

- set the `AWS_ROLE_TO_ASSUME` variable to an IAM role ARN trusting the GitHub OIDC
  provider (preferred — no long-lived keys), **or**
- leave it unset and add `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` as repository
  **secrets**. The workflow picks whichever is configured.

### CloudFront must rewrite directory URIs

The buckets are REST origins behind OAC, **not** S3 website endpoints, so CloudFront
does no directory-index lookup — "Default Root Object" maps only `/`. Since
`trailingSlash: true` exports `management/index.html`, a request for `/management/`
asks S3 for the key `management/`, which does not exist. Block Public Access means
S3 answers **AccessDenied**, so the whole site is dead past the home page:

```
GET /                       200
GET /management/            403   <-- every route except "/" is dead
GET /management/index.html  200   <-- the object is there; only the mapping is missing
```

Because the deploy itself succeeds, this reads as "the deploy did not go out" —
it did; CloudFront just cannot map the URL to the object. If instead a custom error
response maps `404 -> /index.html (200)`, the failure inverts and every route renders
the home page with status 200, which reads as an app routing bug. Both are the same
missing rewrite.

Fix, per distribution — [`infra/apply-cloudfront-rewrite.sh`](infra/apply-cloudfront-rewrite.sh)
does all of it, and prints a plan unless given `--apply`:

```bash
infra/apply-cloudfront-rewrite.sh <distribution-id>            # show what would change
infra/apply-cloudfront-rewrite.sh <distribution-id> --apply    # commit it
```

It creates and publishes the function from
[`infra/cloudfront-rewrite-index.js`](infra/cloudfront-rewrite-index.js), attaches it
to the default behavior as **Viewer Request**, and sets `403` **and** `404` to
`/404.html` returning **404** (403 matters here — an OAC'd REST origin reports a miss
as AccessDenied, so mapping only 404 leaves bad URLs broken). Re-running is safe.

Credentials must be for the account that owns the distributions — the frontend
account, **not** the one hosting `api.neargfix.com`.

#### Interim: directory-key aliases

The deploy user (`arn:aws:iam::176202287053:user/github-actions`) currently has S3 and
`CreateInvalidation` only, so it cannot attach the function. Until the policy above is
granted, the deploy publishes each page a **second** time under the exact key the
browser asks for — `out/management/index.html` also goes to the key `management/` —
in the "Publish directory-key aliases" step of `deploy-s3.yml`.

S3 keys are arbitrary strings and may end in `/`, so this serves `/management/`
directly: no redirect, no `/index.html` in the URL, and no CloudFront change. It costs
one extra small object per page (45 today).

This is a workaround, not the fix. It leaves two copies of every page to keep in step,
and it cannot help a route that has no exported page. Attach the policy, run the
rewrite, then delete these keys:

```bash
aws s3api list-objects-v2 --bucket ggfix-frontend-preview-1762 \
  --query 'Contents[?ends_with(Key, `/`)].Key' --output text
```

Once the function is attached the aliases are inert — it rewrites the URI before S3
sees it, so they are simply never read.

Verify once the distribution leaves "Deploying":

```bash
curl -o /dev/null -w '%{http_code}\n' https://<host>/management/   # expect 200
curl -o /dev/null -w '%{http_code}\n' https://<host>/nope-xyz/     # expect 404
```

### CloudFront invalidation permission

The "Invalidate CloudFront" step in each `deploy-*-s3.yml` warns and continues
instead of failing the job when `aws cloudfront create-invalidation` errors — the S3
sync already succeeded by that point, so the build is live either way. But a
warning that persists deploy after deploy means CloudFront is stuck serving cached
assets until the TTL expires.

Seen 2026-09-02 on preview: `arn:aws:iam::176202287053:user/ggfix-frontend-preview-deployment-policy`
got `AccessDenied` calling `cloudfront:CreateInvalidation` on
`arn:aws:cloudfront::176202287053:distribution/EGNJIKCEI3XN`. Fix by attaching a
policy granting `cloudfront:CreateInvalidation` scoped to that distribution ARN to
that IAM user, in the frontend account (`176202287053`), not the one hosting
`api.neargfix.com`. Same check applies to the development/production deploy users
against their own distribution ARNs if their invalidation step ever starts warning.

### One distribution per environment

`preview`, `deploy`, `ggfix.in` and `www` must each resolve to their **own**
distribution whose origin is that environment's bucket. If several hostnames alias
the same distribution they all serve one bucket, and the three-bucket split does
nothing — a preview deploy either does not show up, or overwrites production.

**This is currently broken.** Measured 2026-08-04, all four hostnames return an
identical `ETag` for `/`, and its `Last-Modified` tracks the **Preview** deploy — so
`ggfix.in` and `www` are serving preview builds, and `S3_BUCKET_PRODUCTION` /
`S3_BUCKET_DEVELOPMENT` are not reaching users at all. Check with:

```bash
for h in preview deploy www; do curl -sI "https://$h.ggfix.in/" | grep -i etag; done
curl -sI https://ggfix.in/ | grep -i etag
```

Four different ETags is correct. Identical ones mean the origins still need splitting.

> **Do not split the origins yet — it would take the public site down.** `main` and
> `Development` are both still the empty *Initial commit*; only `Preview` carries the
> app. Pointing `ggfix.in` at `ggfix-frontend` today would swap a working (preview)
> build for a bucket that has never received one. The current state is at least
> fail-safe: a push to `main` fails at `npm ci` long before the S3 sync, so nothing
> can be published over a live bucket by accident.

Order matters. Do these in sequence:

**1. Apply the rewrite** (above). Fixes all routes on whatever serves traffic today,
changes no content, and is independent of everything below.

**2. Give `main` and `Development` the app.** Merge `Preview` → `Development` first and
check `deploy.ggfix.in`, then `Preview` → `main`. Each push builds and syncs to its own
bucket, which is what makes those buckets real. Until this is done the environment
split has nothing to point at.

**3. Then split the origins.** First establish what exists — one command answers it:

```bash
aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{Id:Id,Aliases:Aliases.Items,Origin:Origins.Items[0].DomainName}' \
  --output table
```

- *One distribution holding all four aliases* — create one distribution per
  environment, each with its own bucket as origin, then move `ggfix.in`/`www` and
  `deploy` onto theirs in Route 53. Leave `preview` where it is.
- *Several distributions already pointing at the preview bucket* — just correct each
  one's origin; no new distributions needed.

Either way each new distribution needs its own OAC **and** a matching bucket policy —
the bucket only trusts the distribution named in its policy, so a new distribution
against an untouched bucket serves 403 for everything. Apply the rewrite function to
each new distribution too (step 1's script takes several IDs).

**4. Set the remaining variables.** `CLOUDFRONT_DISTRIBUTION_PRODUCTION` and
`CLOUDFRONT_DISTRIBUTION_DEVELOPMENT`, so each deploy invalidates its own edge cache
rather than warning and skipping. Then re-run the ETag check above and confirm four
distinct values.

Two more things that bite if missed:

- `output: 'export'` bakes `NEXT_PUBLIC_*` in at **build** time. An unset variable does
  not error — `lib/api.js` falls back to `http://localhost:*` and you ship a bundle
  that talks to nothing. The workflow fails the run up front rather than deploy that.
- The buckets have Block Public Access on and are read through CloudFront OAC, so a
  sync alone leaves the previous build live. Set the `CLOUDFRONT_DISTRIBUTION_*`
  variables or the run warns and skips invalidation.

## Environment

Every base is read as a **static** `process.env.NEXT_PUBLIC_*` literal in `src/lib/api.js`
— a dynamic lookup would not be inlined into the client bundle and would silently fall
back to localhost in the browser.

> **Every base ends with its `/<service>` segment — except master-data, which is the
> bare host.** e.g. `NEXT_PUBLIC_AUTH_BASE=https://api.neargfix.com/auth` but
> `NEXT_PUBLIC_MASTER_DATA_BASE=https://api.neargfix.com`.
>
> `src/lib/api.js` already prefixes every call with the service name. For most
> services the name therefore appears **twice** in the wire URL, and that is correct:
> the nginx edge uses a trailing-slash `proxy_pass`
> (`location /auth/ { proxy_pass http://127.0.0.1:8081/; }`), which **strips** the
> first segment before forwarding. One copy is consumed by nginx for routing, the
> other is what the Spring controller is mapped on.
>
> master-data-service is special-cased at the edge so its public path stays clean —
> `location /master/ { proxy_pass http://127.0.0.1:8091/master/; }` keeps the segment
> instead of eating it. Its base is therefore the bare host, and `/master` appears
> once. Media is the wrinkle: the controller is `@RequestMapping("/media")` but the
> edge only exposes it under `/master/media/`, so uploads go through
> `MEDIA_UPLOAD_URL()` in `src/lib/api.js` rather than being spelled out at each
> call site.
>
> Verified against the live edge (nginx/1.30.3) on 2026-08-04:
>
> | Request | Result |
> |---|---|
> | `/master/brands` | 200, JSON — clean, preferred |
> | `/master/master/brands` | 200 — legacy shape, still routed for shipped APKs |
> | `/master/media/ping` | 200 |
> | `/media/ping` | 404 — media exists only under the `/master` prefix |
> | `/auth/auth/shop-owners` | 200, JSON |
> | `POST /auth/auth/login` | 400 — endpoint exists |
>
> Dropping a non-master suffix makes those calls 404. `api.js` normalises the master
> base, stripping a stray trailing `/master`, so an un-updated deploy variable still
> resolves correctly. Note all of this is the opposite of talking to a service
> directly by port (`http://host:8091/master/colors`), where the path is preserved
> and no suffix belongs in the base. Confirm with a curl against whatever edge you
> point at before setting these — under a misconfigured edge a failure can surface in
> the browser as an opaque CORS/`ERR_FAILED` rather than a 404, because the error
> response carries no `Access-Control-Allow-Origin` header.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_MASTER_DATA_BASE` | Master Data service — **bare host**, no `/master` suffix (default `https://api.neargfix.com`) |
| `NEXT_PUBLIC_API_BASE` | Legacy alias for the above; only used if it is unset |
| `NEXT_PUBLIC_AUTH_BASE` | Auth service for login (default `https://api.neargfix.com/auth`) |
| `NEXT_PUBLIC_TICKET_BASE` | Ticket service (default `https://api.neargfix.com/ticket`) |
| `NEXT_PUBLIC_USER_BASE` | User service (default `https://api.neargfix.com/user`) |
| `NEXT_PUBLIC_SHOP_BASE` | Shop service for create/activate/suspend (default `https://api.neargfix.com/shop`) |
| `NEXT_PUBLIC_TECHNICIAN_BASE` | Technician service (default `https://api.neargfix.com/technician`) |
| `NEXT_PUBLIC_INVENTORY_BASE` | Inventory service (default `https://api.neargfix.com/inventory`) |
| `NEXT_PUBLIC_MARKETPLACE_BASE` | Marketplace service (default `https://api.neargfix.com/marketplace`) |
| `NEXT_PUBLIC_PICKUP_BASE` | Pickup service (default `https://api.neargfix.com/pickup`) |
| `NEXT_PUBLIC_NOTIFICATION_BASE` | Notification service (default `https://api.neargfix.com/notification`) |
| `NEXT_PUBLIC_SUBSCRIPTION_BASE` | Subscription service (default `https://api.neargfix.com/subscription`) |
| `NEXT_PUBLIC_ORDER_BASE` | Order service (default `https://api.neargfix.com/order`) |

## Backend

- **Master Data service** – CRUD endpoints were added so the admin can create/update/delete brands, models, repair services, RAM options, and storage options. The same service continues to expose the existing GET endpoints used by the mobile app; no hardcoded dropdown values.
- **Shop service** – Admin expects `GET /shops`, `POST /shops`, `PATCH /shops/:id/status` with body `{ "status": "ACTIVE" \| "SUSPENDED" }`. Implement or stub as needed.
- **Subscription service** – Admin expects `GET /subscriptions`, `GET /plans`, `GET /payments`, `POST /subscriptions` (assign plan), `PATCH /subscriptions/:id` (e.g. expiry). Implement or stub as needed.

## Folder structure

```
src/
├── app/
│   ├── layout.js, globals.css
│   ├── (site)/                     # public customer-facing site
│   └── management/                 # the admin portal, served at /management
│       ├── (login)/page.js         # -> /management  (login; deliberately OUTSIDE
│       │                           #    the portal group so the auth-check layout
│       │                           #    does not wrap it and bounce in a loop)
│       └── (portal)/               # everything below is auth-gated
│           ├── layout.js           # Sidebar + auth check
│           ├── dashboard/page.js   # -> /management/dashboard
│           ├── shops/page.js       # -> /management/shops (+ new, new-owner, view,
│           │                       #    edit, settings — id via ?id= query string)
│           ├── users/page.js
│           ├── subscriptions/page.js
│           ├── models/page.js      # -> /management/models  (master data is FLAT:
│           ├── brands/page.js      #    no /master segment in the URL)
│           ├── series/page.js
│           ├── repair-services/page.js
│           ├── banners/page.js     # customer-app directory (also flat)
│           ├── shop-directory/page.js
│           └── items/page.js       # marketplace

├── components/
│   ├── Sidebar.js
│   └── DataTable.js
└── lib/
    ├── api.js    # masterApi, authApi, shopApi, subscriptionApi
    └── auth.js   # getToken, setToken
```

## CORS

If the admin runs on a different origin (e.g. `http://localhost:3000`) and the backend rejects requests, enable CORS on the Master Data (and other) services for the admin origin, or proxy API calls through Next.js API routes.
