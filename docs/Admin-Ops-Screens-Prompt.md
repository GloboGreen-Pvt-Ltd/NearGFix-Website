# Admin Portal — Shops, Users & Operations Screens — Current-State Spec (GGFIX-Client)

This documents the admin/management portal's shop, user, and operational-content pages (`src/app/management/**`, excluding catalog/master-data pages covered elsewhere) as currently built, as of 2026-09-10. Reference/handoff spec — not a redesign proposal.

## Contents

1. Layout & auth guard — `(login)` route group
2. Layout & auth guard — `(portal)` route group
3. `(login)/page.js` — Management Login
4. `(portal)/dashboard/page.js` — Admin Dashboard
5. `(portal)/shops/page.js` — Shop Owner List
6. `(portal)/shops/new/page.js` — Create Shop (orphaned)
7. `(portal)/shops/new-owner/page.js` — Create Shop Owner
8. `(portal)/shops/edit/page.js` (+ `EditClient.js`) — Edit Shop Owner
9. `(portal)/shops/view/page.js` (+ `ViewClient.js`) — Shop Owner Details
10. `(portal)/shops/settings/page.js` (+ `SettingsClient.js`) — Shop Settings (orphaned)
11. `(portal)/shop-directory/page.js` — Shop Directory (orphaned in nav)
12. `(portal)/users/page.js` — Shop Staff
13. `(portal)/user-management/page.js` — User Management (owners & market persons)
14. `(portal)/subscriptions/page.js` — Subscription Management
15. `(portal)/support-contacts/page.js` — Support Contacts
16. `(portal)/banners/page.js` — Banners
17. `(portal)/app-content/page.js` — App Content
18. `(portal)/faq-items/page.js` — FAQ Items

---

## Layout & auth guard — `(login)` route group

- **Path**: `src/app/management/(login)/page.js`
- **Route**: `/management` (the route group segment `(login)` does not appear in the URL). No dedicated `layout.js` exists for this group — the page renders standalone (full-bleed background, no sidebar/header chrome).
- **Purpose**: This route group has exactly one page — the login screen itself (see section 3 below for its full behavior). There is no shared layout file to describe separately; the page owns its own `<div>` shell.
- **Notable quirks**: Because there's no group layout, if more pages were ever added under `(login)` they would each need their own background/shell markup — none currently exist besides `page.js`.

## Layout & auth guard — `(portal)` route group

- **Path**: `src/app/management/(portal)/layout.js`
- **Purpose**: Wraps every portal page (`dashboard`, `shops/**`, `users`, `user-management`, `subscriptions`, `support-contacts`, `banners`, `app-content`, `faq-items`, `shop-directory`, plus all master-data pages covered elsewhere) in the admin chrome: a left `Sidebar` (`src/components/Sidebar.js`) and a top header bar, and enforces the auth guard for the whole group.
- **Auth guard**: On mount, `useEffect` checks `getToken()` (from `src/lib/auth.js`, which reads `localStorage.getItem('admin_token')`). If there is no token, it calls `router.replace('/management')` — bouncing to the login page. Until `mounted` is true and a token is confirmed present, the layout renders a bare "Loading…" screen instead of the real chrome (this also avoids an SSR/CSR hydration mismatch on `localStorage`). This is a **client-side-only** guard — there is no middleware or server check; anyone who can inject a token string into `localStorage` bypasses it (though every API call is still separately authorized server-side by `src/lib/api.js`'s `request()`, which redirects to `/management` on any 401).
- **Header title derivation**: `deriveSection(pathname)` takes the second path segment (e.g. `shops`, `user-management`) and looks it up in a `SECTION_BY_SLUG` map to produce a human title ("Shop Management", "Customer App Directory", "User Management", "Subscriptions", "Shop Staff" for `users`, etc.) shown in the header `<h1>`. Unmapped slugs fall back to "Dashboard". Note `shop-directory` **is** present in this map (labeled "Customer App Directory") even though it has no Sidebar nav entry (see section 11).
- **Avatar initial**: `initialFromToken()` base64-decodes the JWT payload (`getToken().split('.')[1]`) and takes the first letter of `payload.email || payload.sub`, with no dedicated "current user" API call.
- **Logout**: The header's account area has no explicit logout button in the header itself — logout lives at the bottom of `Sidebar` (`onLogout` prop, wired to `handleLogout` in the layout), which calls `setToken(null)`, `setRole(null)`, then `router.replace('/management')`.
- **Sidebar** (`src/components/Sidebar.js`): Static nav array with flat top-level links (Dashboard, Shop Management → `/management/shops`, User Management → `/management/user-management`, Shop Staff → `/management/users`) plus four collapsible groups (Master Data, Customer App Directory, Sell Flow Master Data, Marketplace) and a standalone Subscriptions link. The "Customer App Directory" group's children are exactly: Home Banners, Support Contacts, FAQ, App Content — **`shop-directory` is not linked anywhere in this sidebar**, despite having a route and a header-title mapping. One dynamic sub-menu exists (Model Compatibility's part types, fetched from `/master/model-compatibility-types`) — not relevant to this doc's scope but shares the file.
- **Notable quirks**:
  - Two different nav entries are both plausibly "user management": `/management/user-management` ("User Management" — shop owners & market persons, platform-wide) and `/management/users` ("Shop Staff" — one shop's employee list). The Sidebar carries an explanatory code comment about exactly this ambiguity.
  - `shop-directory` is reachable only by typing the URL directly or via a bookmark/old link — it has no discoverable entry point in the UI.

---

## `(login)/page.js`

- **Path**: `src/app/management/(login)/page.js`
- **Route**: `/management`, reads `?returnTo=` (must match `^/management/.+` or it's ignored — prevents bouncing back to the login page itself).
- **Purpose**: Email + OTP login for admin/back-office staff (SUPER_ADMIN and MARKET_PERSON accounts only). Two-step flow: enter email → receive OTP → enter 6-digit code → redirected into the portal.
- **Entry points**: This is the root of `/management`; the `(portal)` layout's auth guard redirects here (`router.replace('/management')`) whenever `getToken()` is falsy, and `src/lib/api.js`'s shared `request()` redirects here (`window.location.assign('/management/?returnTo=...')`) on any 401 from an authenticated call. No other page links to it explicitly.
- **Exit points / navigation out**: On successful OTP verification, `router.replace(dest)` where `dest` is the sanitized `returnTo` or `/management/dashboard`. No cancel/back button (it's the entry screen).
- **Key UI sections**: Full-bleed background image (top-anchored) → centered card with GGFIX logo + "Management Login" title → **Step 1 (EMAIL)**: email input, "Send OTP" button, inline validation/error banner → **Step 2 (OTP)**: "OTP sent to {target}" banner, "Change email" link back to step 1, six individual auto-advancing OTP digit boxes (paste-aware, arrow-key navigation, backspace-to-previous), resend countdown (30s) / "Resend OTP" link, "Verify & Sign In" button, footer security note.
- **State & data**: All local `useState` — `step` ('EMAIL'|'OTP'), `email`, `emailError`, `sendingOtp`, `sendError`, `sentTarget`, `otp` (array of 6 chars), `otpError`, `verifying`, `resendSeconds`, `shakeKey` (retrigger CSS shake animation on error). Two `useRef` guards (`sendingRef`, `verifyingRef`) exist specifically because state alone is not synchronous enough to block a genuine double-click/double-submit — a code comment explains the race explicitly.
- **Auth/session storage**: On success, the JWT (`res.accessToken || res.token`) is stored via `setToken(token)` → `localStorage.setItem('admin_token', ...)`. The `loginType` from the response is stored via `setRole(loginType)` → `localStorage.setItem('admin_role', ...)`. No cookies, no React context — `src/lib/auth.js` is a thin `localStorage` wrapper (`getToken`/`setToken`/`getRole`/`setRole`/`isAuthenticated`/`isAdmin`).
- **API calls**:
  - `authApi.post('/auth/otp/send', { email })` — fires on "Send OTP" submit and on "Resend OTP" (resend also clears the OTP boxes and resets the 30s timer).
  - `authApi.post('/auth/login', { email, otp })` — fires on "Verify & Sign In" submit. On success: checks `res.loginType`; if it's `SHOP_OWNER`/`SHOP_LOGIN` or anything else non-staff, it **discards the token** (never stores it) and shows a role-specific rejection message ("Shop accounts must sign in through the GGfix mobile app." / "Employee accounts must sign in through the employee app.") rather than logging them in. Only `SUPER_ADMIN` and `MARKET_PERSON` proceed to `setToken`/`setRole`/redirect.
- **Notable quirks**:
  - A 401 from `/auth/login` is deliberately remapped from the generic "session expired" message (which `request()` attaches to every 401) to "Invalid OTP. Please check the code and try again." — a code comment flags this as an intentional override specific to this page.
  - Role-gating happens **client-side only** after a successful login call — the backend already authenticated the OTP; the frontend then decides whether to keep or discard the resulting token based on `loginType`.
  - Background image is hosted externally (`https://media.ggfix.in/admin/background-2.png`), not bundled.

---

## `(portal)/dashboard/page.js`

- **Path**: `src/app/management/(portal)/dashboard/page.js`
- **Route**: `/management/dashboard`. No query params.
- **Purpose**: Landing page after login — shop count overview, master-data counts, a shops active/inactive donut, top-5 categories by model count, and a quick-actions list. Read-only; no create/edit actions live here directly (they're links out).
- **Entry points**: Login page redirects here by default after successful auth (`/management/dashboard`). Sidebar's "Dashboard" link. No other pages link here explicitly.
- **Exit points / navigation out**: All via `<Link>`, no imperative redirects: Overview cards → `/management/shops` (Total/Active/Inactive Shops all point to the same shops list). Master Data cards → `/management/device-categories`, `/management/brands`, `/management/models`. "Shops Summary" card → `/management/shops`. "Top Categories" card action → `/management/device-categories`. "Quick Actions" list → `/management/shops/new` (Add Shop — see quirk below), `/management/brands`, `/management/models`, `/management/user-management`.
- **Key UI sections** (render order): Greeting header ("Welcome back, {name}!", derived from the JWT) → optional error banner if any load failed → "Shops Overview" section (3 `OverviewCard`s: Total/Active/Inactive) → "Master Data" section (3 `MasterDataCard`s: Categories/Brands/Models, Models card has a Retry button on failure) → 3-column summary row: "Shops Summary" (custom SVG donut built from two stroke-dashed circles, no chart library, plus a legend and "View all shops" link), "Top Categories" (horizontal bar list, top 5 by model count, colored per fixed category-id→hue map), "Quick Actions" (icon list: Add Shop, Add Brand, Add Model, Manage Users).
- **State & data**: `name` (derived from JWT email/sub, first-letter-capitalized), `stats` object (`shopsTotal/shopsActive/shopsInactive/categoriesCount/brandsCount/error`), `categories` (raw device-categories list, used only for the top-categories color map), `modelRows` (`{ rows, loading, failed }` — kept separate from `stats` because it loads independently and on its own retry cycle). All local `useState`; no global store.
- **API calls**:
  - `authApi.get('/auth/shops')` — used for shop counts because it (unlike the shop-service `/shops`) carries `isActive`/`status`.
  - `masterApi.get('/master/device-categories')` and `masterApi.get('/master/brands')` — counts only.
  - All three of the above fire together via `Promise.allSettled` on mount; a failure in any one sets `stats.error` but doesn't block the others.
  - `masterApi.get('/master/models')` — fires separately on mount (`loadModels`), feeding both the Models count tile and the Top Categories breakdown (client-side group-by on `categoryId`). A large code comment explains this used to be a manual "Count" button because pulling full model lists with embedded images previously exhausted the master-data service's heap; `/master/models` is now a stripped projection safe to auto-load.
- **Notable quirks**:
  - No backend activity/audit log exists yet, so "Quick Actions" deliberately replaces what would otherwise be a "Recent Activity" feed — documented in a code comment.
  - "Add Shop" in Quick Actions links to `/management/shops/new`, which (see section 6) is an orphaned page that posts to a different backend resource (`/auth/shops`) than the one actually used to create shops from the shops list page (`/auth/shop-owner` via `new-owner`). Clicking "Add Shop" from the dashboard reaches a working-but-effectively-unused create-shop form, not the shop-owner flow the rest of the product uses.

---

## `(portal)/shops/page.js`

- **Path**: `src/app/management/(portal)/shops/page.js`
- **Route**: `/management/shops`. No query params read (the list itself is client-filtered).
- **Purpose**: Primary "Shop Management" screen — lists all shop **owners** (not shop-service `/shops` rows) with avatar, contact info, role, created-by, email verification, profile-completion progress, active/inactive dates, and an admin-only active/inactive toggle. Entry point into view/edit/create-owner flows.
- **Entry points**: Sidebar "Shop Management" link. Dashboard's three Shops Overview cards and "Shops Summary" card. `EditClient.js`'s "← Cancel"/back links. `ViewClient.js`'s "← Back" link. `SettingsClient.js`'s "View all shops" link. `NewShopPage`'s and `NewShopOwnerPage`'s "Cancel"/back links.
- **Exit points / navigation out**:
  - "+ Add Shop Owner" button → `/management/shops/new-owner`.
  - Per-row "View" icon → `/management/shops/view/?id={ownerId}` (also writes `sessionStorage.setItem('ggfix.ownerId', id)` as a fallback for static-hosting query-string loss — see quirk below).
  - Per-row "Edit" icon → `/management/shops/edit/?id={ownerId}` (same sessionStorage write).
  - Per-row "Delete" opens an in-page confirm modal (no navigation) that calls the delete API and reloads the list.
- **Key UI sections**: Header (title + subtitle + Refresh button + "+ Add Shop Owner" link) → search bar (filters name/email/phone/personalAddress client-side) with a live "Total: N" count → table (S.No, Avatar via `SafeImage`, Name, Mobile, Email, Role badge, Created By/Person, Created Date, Email Status badge, Profile Progress bar, Active Date, Inactive Date, Account Status toggle, Action icons: view/edit/delete) → `TablePagination` footer → delete-confirmation modal (conditional).
- **State & data**: `list`, `loading`, `error`, `query`, `page`/`pageSize` (via shared `pageBounds` helper), `confirmingDelete` (row pending delete confirmation), `canManageStatus` (resolved post-mount from `isAdmin()` in `src/lib/auth.js`, to avoid an SSR/client hydration mismatch on `localStorage`).
- **API calls**:
  - `authApi.get('/auth/shop-owners')` on mount and on "Refresh".
  - `authApi.patch('/auth/shop-owners/{id}/status', { active })` — the toggle; UI hides the control for non-admins, but the code comment notes the backend independently re-checks the role and 403s regardless, so hiding is presentation-only.
  - `authApi.delete('/auth/shop-owners/{id}')` — on confirmed delete.
- **Notable quirks**:
  - This page's data model (`/auth/shop-owners`) is entirely separate from `shop-directory`'s (`/shops` via `shopApi`) and from `shops/settings`'s per-shop-id records — three different "shop" concepts coexist in the codebase.
  - The View/Edit links persist the id into `sessionStorage.ggfix.ownerId` specifically because (per comments in `EditClient.js`/`ViewClient.js`) the static S3 export's trailing-slash 302 redirect drops query strings, so a hard refresh or pasted link on the view/edit page would otherwise lose `?id=`.

---

## `(portal)/shops/new/page.js`

- **Path**: `src/app/management/(portal)/shops/new/page.js`
- **Route**: `/management/shops/new`. No query params.
- **Purpose**: A minimal "Create shop" form (Name, Slug, optional Address) that posts directly to `/auth/shops`. Functionally complete but not part of the shop-owner-centric flow the rest of the admin UI uses.
- **Entry points**: Dashboard's "Add Shop" Quick Action (`/management/shops/new`) is the **only** in-app link to this page. It is not reachable from the Shops list page or the Sidebar.
- **Exit points / navigation out**: "Cancel" link → `/management/shops`. On successful submit → `router.push('/management/shops')`.
- **Key UI sections**: Back-link header ("← Shops" + "Create shop" title) → single card form: Name (required), Slug (required, auto-lowercased/dashed), Address (optional textarea), inline error banner, Cancel/Create buttons.
- **State & data**: Local `useState` only — `name`, `slug`, `address`, `error`, `submitting`.
- **API calls**: `authApi.post('/auth/shops', { name, slug, address })` on submit.
- **Notable quirks**:
  - **Effectively orphaned/dead**: the Shops list page's create action goes to `/management/shops/new-owner` instead, which posts to a completely different endpoint (`/auth/shop-owner`) and produces the owner+locations records the rest of the admin UI (list/view/edit) actually reads. A shop created here via `/auth/shops` would not show up in the Shop Owner List at all, since that list reads `/auth/shop-owners`.
  - No KYC, documents, location, or owner-account fields — this form only captures what a bare shop record needs, which is a much smaller surface than `new-owner`.

---

## `(portal)/shops/new-owner/page.js`

- **Path**: `src/app/management/(portal)/shops/new-owner/page.js`
- **Route**: `/management/shops/new-owner`. No query params.
- **Purpose**: The real "create a shop" flow used in practice — creates a shop-owner account (name/email/password/KYC docs) together with one or more business locations (address, GST, working hours, shop photos) in a single submit.
- **Entry points**: Shops list page's "+ Add Shop Owner" button is the only in-app link.
- **Exit points / navigation out**: "← Back to shops" link → `/management/shops`. "← Cancel" (sticky footer) → `/management/shops`. On successful submit → `router.push('/management/shops')`.
- **Key UI sections**: Header (title + subtitle + back link) → 2-column top row: "Basic Information" card (name/email/mobile/secondary mobile/password/OTP code, plus a "Personal Address" sub-section with state/district/taluk/area/street/pincode/address-note) and "Personal Profile & Documents" card (avatar + Aadhar front/back + PAN uploads via `UploadCard`) → "Business Locations" card: repeatable location blocks (add/remove), each with a shop-name field that live-searches OpenStreetMap Nominatim (debounced 350ms, with a smart fallback to trailing tokens when the full query has no hits) and populates street/area/taluk/district/state/pincode/lat/lng from the picked suggestion, plus mobile/GST/pincode/state/district/taluk/area/street/address/lat/lng/working-days/opening/closing-time fields, "Clear Address", "Find on Google Maps" (opens a maps search in a new tab), "Get Current Location" (browser geolocation with typed error messages for denied/unavailable/timeout/unsupported), and a document-upload grid (Shop Front, Banner, GST Certificate, Udyam Certificate) → sticky footer with Cancel/Save.
- **State & data**: `owner` object (name/email/phone/secondaryMobile/password/otpCode/personalAddress/addr fields/avatarUrl/aadhar*/panUrl), `locations` array of location objects (one per business location), `submitting`, `error`, `uploading` (per-field busy map), `autoCoords` (captured once via browser geolocation on mount), `locatingIdx` (which location card is fetching geolocation), `suggestions`/`searched`/`searching` (per-location-index maps for the Nominatim autocomplete), `searchTimers` ref (per-index debounce timers).
- **API calls**:
  - `uploadMedia()` (from `src/lib/api.js`, aliased `uploadFile`) → `POST {MEDIA_UPLOAD_URL}` for every document/photo upload (owner avatar/Aadhar/PAN, and per-location front/banner/GST/Udyam), bearer-token-authenticated.
  - External `fetch` to `https://nominatim.openstreetmap.org/search` for address autocomplete (no API key; not routed through `src/lib/api.js`).
  - `authApi.post('/auth/shop-owner', payload)` on final submit — the payload nests all `locations[]` with per-location `latitude`/`longitude` falling back to the once-captured `autoCoords` if the admin left them blank, and `timezone` auto-detected via `Intl.DateTimeFormat`.
- **Notable quirks**:
  - Endpoint is singular `/auth/shop-owner` (create) vs. the list/detail endpoints' plural `/auth/shop-owners` — an inconsistent naming convention between this page and `edit`/`view`.
  - Nearly identical Nominatim/geolocation/upload logic is duplicated three times in the codebase: here, in `EditClient.js`'s inline location handling (superseded — see below), and again inside `src/components/BusinessLocationsManager.js`'s `LocationModal`. `new-owner`'s own copy has no shared module; it's a self-contained duplicate of the `BusinessLocationsManager` logic used by `edit`/`view`.
  - OTP code defaults to `123456` server-side if left blank (per the field's inline hint), meaning a real OTP-send/verify loop isn't required to provision an owner from here.

---

## `(portal)/shops/edit/page.js` (+ `EditClient.js`)

- **Path**: `src/app/management/(portal)/shops/edit/page.js` (wraps `EditClient.js` in `<Suspense>`, required because `useSearchParams()` needs a Suspense boundary under static export); actual logic in `src/app/management/(portal)/shops/edit/EditClient.js`.
- **Route**: `/management/shops/edit/?id={ownerId}` — id is read via `useSearchParams().get('id')`, with a `sessionStorage.getItem('ggfix.ownerId')` fallback if the query string arrives empty (see quirk in section 5).
- **Purpose**: Edit a shop owner's basic profile, personal address, KYC documents, and (via the embedded `BusinessLocationsManager`) manage that owner's business locations inline — add/edit/delete/view locations without leaving the page.
- **Entry points**: Shops list page's per-row "Edit" icon (`/management/shops/edit/?id={id}`). `ViewClient.js`'s "Edit" button (`/management/shops/edit/?id={id}`).
- **Exit points / navigation out**: "← Back to view" header link and "← Cancel" footer link both go to `/management/shops/view/?id={id}`. On successful submit → `router.push('/management/shops/view/?id={id}')`.
- **Key UI sections**: Header (title/subtitle + back-to-view link) → 2-column top row: "Basic Information" card (name/email/mobile/secondary mobile, "New Password"/"OTP Code" fields explicitly labeled as optional/blank-preserves-current, "Personal Address" sub-section) and "Personal Profile & Documents" card (avatar/Aadhar front/back/PAN uploads, pre-populated from the loaded owner) → `BusinessLocationsManager` (full table: location name, mobile, address, GST, document chips, progress, KYC-verified badge, view/edit/delete actions, "+ Add Business Location" opens a modal) → sticky Cancel/Save footer.
- **State & data**: `id`/`idResolved` (resolved once from query-or-sessionStorage), `owner` (form fields), `loading`, `submitting`, `error`, `uploading` (per-field map), `locations`, `kycDocument`. Notably, saving a location via `BusinessLocationsManager` triggers `reloadLocations()` which re-fetches only the locations/KYC slice of the owner record — deliberately **not** a full reload, so it never clobbers unsaved edits in the Basic Information form above it (explained in a code comment).
- **API calls**:
  - `authApi.get('/auth/shop-owners/{id}')` on mount (hydrates both the owner form and, indirectly, `locations`/`kycDocument`).
  - `uploadMedia()` for avatar/Aadhar/PAN replacement uploads.
  - `authApi.patch('/auth/shop-owners/{id}', payload)` on submit — payload omits `password`/`otpCode`/each KYC-doc URL entirely unless the admin actually changed them (to avoid accidentally clearing stored values or bumping KYC status back to `PENDING_REVIEW`, per an inline comment).
  - Location CRUD is delegated to `BusinessLocationsManager`, which itself calls `authApi.post/patch/delete '/auth/shop-owners/{ownerId}/locations[/...]'`.
- **Notable quirks**:
  - If no id is resolvable from either the query string or `sessionStorage`, the page renders a "No shop owner selected" message with a link back to `/management/shops` rather than hanging on a permanent loading state — this fallback state is explicitly coded for the static-export query-loss scenario.
  - Shares almost all of its address/upload/location UI conventions with `new-owner`'s page (same `Field`/`SectionHeader`/`UploadCard` local components, re-implemented rather than imported from a shared file) — the two pages have near-duplicate but independently maintained form chrome.

---

## `(portal)/shops/view/page.js` (+ `ViewClient.js`)

- **Path**: `src/app/management/(portal)/shops/view/page.js` (Suspense wrapper); logic in `src/app/management/(portal)/shops/view/ViewClient.js`.
- **Route**: `/management/shops/view/?id={ownerId}` — same query/`sessionStorage` fallback pattern as `edit`.
- **Purpose**: Read-mostly detail page for one shop owner: profile, address, subscription snapshot, owner KYC review (approve/reject), and the same embedded `BusinessLocationsManager` for that owner's business locations. The one non-read action embedded here is owner KYC review and email verification.
- **Entry points**: Shops list page's per-row "View" icon (`/management/shops/view/?id={id}`). `EditClient.js`'s "← Back to view" and footer "Cancel" links both land here after edits.
- **Exit points / navigation out**: "← Back" header button → `/management/shops`. "Edit" header button → `/management/shops/edit/?id={id}`. No other navigation (KYC review and email verification are modal/inline actions that reload data on this same page).
- **Key UI sections**: Header (title/subtitle + Back/Edit buttons) → header card (avatar via `SafeImage`, name, badges: email-verified/pending, active/inactive, location count, profile-%, subscription-plan badge, "Verify Email" button if unverified) → 3-column detail row: "Personal Details", "Personal Address", "Profile & Documents" (avatar preview + created-on date) → "Subscription" card (plan/active-date/inactive-date/days-left/shops/amount/shop-limit/employee-limit/sell-limit/pickup, or an italic "no subscription — 15-day free trial created automatically" note) → "Owner KYC Verification" card (Aadhar front/back + PAN doc previews, a single approve/under-review toggle switch that flips **all** documents at once, and a "Reject" button that prompts for a reason via `window.prompt`) → `BusinessLocationsManager` (same component as Edit) → conditional `VerifyEmailModal` (send-OTP → confirm-OTP two-step, shows a dev-mode OTP inline when the backend returns one because SMTP isn't wired).
- **State & data**: `id`/`idResolved` (query/sessionStorage), `data` (the owner record, doubling as "the shop" — a code comment notes explicitly that this page's `data` IS the owner, ShopOwnerView), `sub` (subscription snapshot, fetched separately and allowed to fail silently), `kycBusy`, `loading`, `error`, `showVerify` (email-verify modal toggle).
- **API calls**:
  - `authApi.get('/auth/shop-owners/{id}')` and `subscriptionApi.get('/subscriptions/owner/{id}')` fired together via `Promise.all`, with the subscription call individually `.catch(() => null)`'d so an unreachable subscription service degrades gracefully rather than failing the whole page.
  - `authApi.patch('/auth/shop-owners/{id}/kyc-status', { status, rejectReason })` — the approve/reject toggle and reject button.
  - `authApi.post('/auth/email-verify/send', { email })` and `authApi.post('/auth/email-verify/confirm', { email, otp })` inside `VerifyEmailModal`.
  - Location CRUD again via the shared `BusinessLocationsManager` (`/auth/shop-owners/{ownerId}/locations[/...]`).
- **Notable quirks**:
  - The KYC approve toggle is all-or-nothing per owner (there's no per-document approve/reject — Aadhar front, Aadhar back, and PAN share one status field).
  - "Reject" uses a native `window.prompt()` for the reject reason rather than an in-page form field — the only spot in this page that breaks from the app's modal-based UI pattern.

---

## `(portal)/shops/settings/page.js` (+ `SettingsClient.js`)

- **Path**: `src/app/management/(portal)/shops/settings/page.js` (Suspense wrapper); logic in `src/app/management/(portal)/shops/settings/SettingsClient.js`.
- **Route**: `/management/shops/settings/?id={shopId}` — id read via `useSearchParams().get('id')` with **no** `sessionStorage` fallback (unlike `edit`/`view`), so a query-string loss on this page shows "Invalid shop id." with no recovery path.
- **Purpose**: Edit a shop's basic profile (name/slug/email/phone/address/timezone/active-status), KYC status (Pending/Approved/Rejected), and pickup-window/distance options, all against `/auth/shops/{shopId}` (falling back to `shopApi` for the pickup-options save).
- **Entry points**: **None found anywhere in the codebase.** No `<Link>`, `href`, or `router.push`/`replace` targets `/management/shops/settings` from any page or from the Sidebar.
- **Exit points / navigation out**: "← Back" button calls `router.back()` (browser history, not a fixed route). No other navigation.
- **Key UI sections**: Header (title/subtitle + "← Back" button) → error banner (if any) → "Basic Shop Profile" section (name/slug/email/phone/address/timezone/status select, "View all shops" link to `/management/shops`, its own Save button) → "KYC status" section (Pending/Approved/Rejected select + Save button) → "Pickup options" section (From Time/To Time/Distance-KM inputs + Save button).
- **State & data**: `loading`, `saving`, `error`, plus one `useState` per field: `name`, `slug`, `email`, `phone`, `address`, `timezone`, `isActive`, `kycStatus`, `pickupFromTime`, `pickupToTime`, `pickupDistanceKm`. Each of the three sections is its own `<form>` with its own submit handler.
- **API calls**:
  - `authApi.get('/auth/shops/{shopId}')` on mount — note this hits `/auth/shops/{id}`, a **different** id space than `/auth/shop-owners/{id}` used everywhere else in the shops flow (this page's `shopId` looks like a shop/location id, not an owner id, based on the field shape it expects: `name`/`shopName`, `slug`, `kycStatus`, `pickupFromTime`, etc.).
  - `authApi.patch('/auth/shops/{shopId}', {...})` — used for both the basic-profile save and the KYC-status save (same endpoint, different partial body).
  - Pickup options: tries `shopApi.patch('/shops/{shopId}/pickup-options', {...})` first (shop-service), and if that call rejects, falls back to `authApi.patch('/auth/shops/{shopId}', { pickupFromTime, pickupToTime, pickupDistanceKm })` — a try/fallback pattern unique to this form, per an inline comment noting no dedicated pickup-service endpoint is confirmed to exist yet.
- **Notable quirks**:
  - **Effectively orphaned/dead**: no in-app entry point exists. Given the id shape mismatch above, it's also unclear whether the id this page expects (`shopId`) is ever actually produced anywhere the admin can copy from — the Shops list page and its View/Edit pages only ever expose **owner** ids, not this page's shop/location ids, in their links.
  - Two of its three sections write to the exact same endpoint (`PATCH /auth/shops/{shopId}`) with different bodies rather than being merged into a single form/save — the split appears to be presentational only.

---

## `(portal)/shop-directory/page.js`

- **Path**: `src/app/management/(portal)/shop-directory/page.js`
- **Route**: `/management/shop-directory`. No query params.
- **Purpose**: Full CRUD admin for shop-service's `/shops` resource — a different, apparently customer/marketplace-facing "shop" record (name, slug, email, phone, address/city/state/pincode, lat/lng, rating, hours text, hero image, description, isActive) distinct from the shop-owner + business-location model used throughout `shops/**`. Also manages per-shop "services" (REPAIR/BUY/SELL/PICKUP/SMART_EXCHANGE tags) and pickup time-slots (day/start/end/capacity) inline in the edit modal.
- **Entry points**: **None in the Sidebar** (the "Customer App Directory" group's children are banners/support-contacts/faq-items/app-content only — `shop-directory` is omitted despite `layout.js`'s `SECTION_BY_SLUG` map having an entry for it). No other page links here. Reachable only by direct URL.
- **Exit points / navigation out**: None — this is a single-page CRUD screen; "Close" on the modal just clears local state (`setModal(null)`), no route changes anywhere in the file.
- **Key UI sections**: Header ("Shops" title, "Activate all" button, "Add shop" button) → helper text ("Shop directory (GET /shops)...") → error banner → `DataTable` (ID/Name/Slug/City/Phone/Rating/Active-toggle-button columns, with built-in search+pagination+edit/delete row actions) → modal (conditional): shop form (name/slug/email/phone, address with paste-a-Google-Maps-URL-to-autofill-coords, city/state/pincode, lat/lng + "📍 Geocode address" button via Nominatim, rating, hours text, hero image URL, description, Active checkbox) and, only in edit mode, two extra inline sections below the form: "Services" (chip list + add-service select/button) and "Pickup slots" (list + add-slot day/start/end/capacity form).
- **State & data**: `list`, `loading`, `error`, `modal` (`{type:'create'|'edit', item}` or null), one `useState` per shop form field (`name`/`slug`/`email`/`phone`/`address`/`city`/`state`/`pincode`/`latitude`/`longitude`/`rating`/`hoursText`/`heroImageUrl`/`description`/`isActive`), `submitting`, `geocoding`, plus edit-only sub-data: `services`, `newServiceCode`, `pickupSlots`, `slotDay`/`slotStart`/`slotEnd`/`slotCapacity`.
- **API calls**:
  - `shopApi.get('/shops')` on mount; `shopApi.get('/shops/{id}/services')` and `shopApi.get('/shops/{id}/pickup-slots')` when opening the edit modal (`loadShopExtras`).
  - Create: `shopApi.post('/shops', body)`, then immediately reopens the newly created shop in edit mode.
  - Edit: `shopApi.put('/shops/{id}', {...body, isActive: undefined})` for everything except `isActive`, plus a separate `shopApi.patch('/shops/{id}/status?active={bool}')` call **only if** `isActive` actually changed — a code comment explains this split exists because Jackson's bean introspection strips the `is` prefix from `isActive` and silently fails to bind it via the PUT body, so status must go through a dedicated query-param PATCH endpoint instead.
  - Delete: `shopApi.delete('/shops/{id}')` (native `confirm()` dialog, not a styled modal).
  - Toggle-active (table button) and "Activate all" (bulk, loops sequentially over every inactive row, stopping and reporting on the first failure) both use the same `PATCH /shops/{id}/status?active=...` endpoint.
  - Services: `shopApi.post('/shops/{id}/services', {serviceCode})`, `shopApi.delete('/shops/{id}/services/{code}')`.
  - Pickup slots: `shopApi.post('/shops/{id}/pickup-slots', {...})`, `shopApi.delete('/shops/{id}/pickup-slots/{slotId}')`.
  - External `fetch` to Nominatim for the "Geocode address" button (separate implementation from the shop-owner pages' address autocomplete — this one is a one-shot geocode-on-click, not a live-typing autocomplete).
- **Notable quirks**:
  - Uses `window.alert()`/`window.confirm()` (native browser dialogs) for save-confirmation and delete-confirmation, unlike every other CRUD page in this doc which uses styled in-page modals — a visibly different, older interaction pattern.
  - This page's `/shops` resource is entirely separate from the shop-owner/business-location model that `shops/page.js`, `edit`, `view`, and `new-owner` operate on — an admin could easily assume "Shop Directory" manages the same shops seen in "Shop Management" and be wrong.
  - No nav entry despite being a fully-built, non-trivial CRUD screen with sub-resource management (services, pickup slots) — the most functionally complete "orphan" of the three found in this audit.

---

## `(portal)/users/page.js`

- **Path**: `src/app/management/(portal)/users/page.js`
- **Route**: `/management/users`. No query params (shop selection is in-memory only).
- **Purpose**: Pick one shop from a dropdown and view that shop's staff/users list (email, name, role, active). Labeled "Shop Staff" in the Sidebar to distinguish it from `user-management`.
- **Entry points**: Sidebar "Shop Staff" link only.
- **Exit points / navigation out**: None — no links or redirects anywhere in the file.
- **Key UI sections**: Header ("User Management" — note: the on-page `<h1>` text does **not** match the Sidebar label "Shop Staff", see quirk) → helper text → shop `<select>` dropdown (auto-selects the first shop on load) → error banner → conditional "Users — {shopName}" heading + `DataTable` (email/name/role/active columns, no row actions) → a static dev-note footer box listing seeded test logins ("Shop Alpha — login: shop1 / test", "Shop Beta — login: shop2 / test").
- **State & data**: `shops`, `selectedShopId`, `users`, `loadingShops`, `loadingUsers`, `error`. Selecting a shop triggers a `useEffect` on `selectedShopId` to reload `users`.
- **API calls**: `authApi.get('/auth/shops')` on mount (populates the dropdown); `authApi.get('/auth/shops/{selectedShopId}/users')` whenever the selected shop changes.
- **Notable quirks**:
  - The exported component is literally named `UserManagementPage` — the **same identifier** as the component exported from `(portal)/user-management/page.js` (section 13). Since each lives in its own Next.js route module this doesn't collide at runtime, but it's a naming trap for anyone grepping the codebase for "UserManagementPage" expecting one hit.
  - The in-page `<h1>` says "User Management" while the Sidebar link is labeled "Shop Staff" for the same route — the page's own heading doesn't match how it's introduced in nav.
  - Hardcoded dev-only seed-account hint text ("password: test") is shipped directly in the page's JSX, not gated behind an environment check.

---

## `(portal)/user-management/page.js`

- **Path**: `src/app/management/(portal)/user-management/page.js`
- **Route**: `/management/user-management`. No query params.
- **Purpose**: Platform-wide account administration — lists every "managed user" (shop owners and market persons together), lets an admin (SUPER_ADMIN/ADMIN only) activate/deactivate accounts and (re)assign a shop owner's responsible market person, and lets an admin create new Market Person accounts.
- **Entry points**: Sidebar "User Management" link. Dashboard's "Manage Users" Quick Action.
- **Exit points / navigation out**: None — purely in-page (table + two modals), no route navigation anywhere in the file.
- **Key UI sections**: Header (title, role-aware subtitle text, Refresh button, "+ Add Market Person" button shown only if `canManage`) → search bar with live total count → error/notice banners → table (S.No, User Name, Mobile, Email, Role badge, Active Role, "Active Person" — an assignment `<select>` of market persons shown only to admins for SHOP_OWNER rows, Created By, Created Person, Created Date, Account Status with an admin-only Activate/Deactivate button) → conditional `CreateMarketPersonModal` (name/email/phone/optional-password form).
- **State & data**: `list` (managed users), `marketPersons` (loaded only if `canManage`), `loading`, `error`, `notice`, `query`, `busyId` (row currently mid-action, disables its controls), `showCreate`, `canManage` (resolved post-mount from `isAdmin()`, same hydration-safety pattern as the Shops list page).
- **API calls**:
  - `authApi.get('/auth/managed-users')` on mount/Refresh.
  - `authApi.get('/auth/market-persons')` — only attempted if `canManage` is true; a non-admin simply gets an empty list rather than a 403 error banner (checked client-side before the call, per a code comment).
  - `authApi.patch('/auth/shop-owners/{id}/status', { active })` — the activate/deactivate toggle (same endpoint as the Shops list page's toggle, since both operate on the shop-owners table).
  - `authApi.patch('/auth/shop-owners/{id}/active-person', { marketPersonId })` — the market-person (re)assignment dropdown.
  - `authApi.post('/auth/market-persons', { name, email, phone, password })` — inside `CreateMarketPersonModal`; deliberately omits `createdBy`/`createdPersonId`/`isActive` etc. since the backend derives them from the authenticated caller (per an explicit code comment on the modal).
- **Notable quirks**:
  - Shares the exact same account-status endpoint (`PATCH /auth/shop-owners/{id}/status`) as the Shops list page — this page is effectively a superset view (owners **and** market persons together) over largely the same underlying accounts, with an added market-person-assignment feature the Shops list page doesn't have.
  - Component name collision with `(portal)/users/page.js` — both are named `UserManagementPage` (see section 12's quirk).
  - New market-person accounts can be created with **no password** ("Optional — they can sign in with OTP 123456" placeholder hint), mirroring the dev-friendly OTP default seen on `new-owner`.

---

## `(portal)/subscriptions/page.js`

- **Path**: `src/app/management/(portal)/subscriptions/page.js`
- **Route**: `/management/subscriptions`. No query params (tab state is in-memory only, not reflected in the URL).
- **Purpose**: Three-tab subscription admin: a read-only Subscriptions table, a Plans tab (plan cards + a multi-shop pricing reference table + a manual "Activate Basic" tool), and a read-only Payments table.
- **Entry points**: Sidebar "Subscriptions" link only.
- **Exit points / navigation out**: None — no links/redirects in the file.
- **Key UI sections**: `PageHeader` (breadcrumb "Admin / Subscriptions", title, subtitle, "Refresh" button) → error banner → tab bar (Subscriptions/Plans/Payments, each with an icon) → **Subscriptions tab**: `DataTable` (owner/shop id shortened to 8 chars, type, status badge, active/inactive dates, days-left, shop-count, amount) → **Plans tab**: `PlanCard`s for Free Trial and Basic (highlighted) plus any others, a static `PricingTable` (1 shop = ₹3,000; 2+ shops = N×₹2,500, hardcoded for n=1..5), and an `ActivateBasic` panel (shop-count input, owner-user-ID input, live quote preview, Activate button) → **Payments tab**: `DataTable` (payment id, owner id, amount, status, paid-at).
- **State & data**: `subscriptions`, `plans`, `payments`, `tab`, `loading`, `error` at the page level. `ActivateBasic` has its own local state: `shopCount`, `ownerUserId`, `quote` (live-fetched preview), `quoting`, `submitting`, `err`, `ok`.
- **API calls**:
  - `subscriptionApi.get('/subscriptions')`, `.get('/subscriptions/plans')`, `.get('/subscriptions/payments')` — all three fired together via `Promise.allSettled` on mount/Refresh; each tab renders whichever of the three actually resolved, and the first rejection's message is surfaced as the page error.
  - `subscriptionApi.get('/subscriptions/quote?shops={n}')` — debounced-by-effect live quote as the admin types a shop count in `ActivateBasic`; falls back to a local calculation (`n===1 ? 3000 : n*2500`) if the quote call fails or hasn't resolved yet.
  - `subscriptionApi.post('/subscriptions/activate', { ownerUserId, shopCount })` — the manual "Activate" button; on success clears the owner-id field and calls the passed-in `onActivated` (page-level `load()`) to refresh the Subscriptions tab.
- **Notable quirks**:
  - "Activate Basic" requires the admin to paste in a raw owner **user ID** (UUID) by hand — there's no shop/owner picker or autocomplete wired to this form, unlike every owner-facing field elsewhere in the portal which resolves names via a dropdown or table row.
  - The multi-shop pricing table is a hardcoded local array (`multiShopRows()`, n=1..5) rather than derived from the `/subscriptions/quote` endpoint it sits right next to — the two pricing displays (static table vs. live quote) could in principle disagree if the backend's pricing rule ever changes without this array being updated too.

---

## `(portal)/support-contacts/page.js`

- **Path**: `src/app/management/(portal)/support-contacts/page.js`
- **Route**: `/management/support-contacts`. No query params.
- **Purpose**: CRUD for the customer-app's support contact list (label, email, phone, image, sort order, active flag).
- **Entry points**: Sidebar → Customer App Directory → "Support Contacts".
- **Exit points / navigation out**: None — in-page modal CRUD only.
- **Key UI sections**: Header ("Support Contacts" + "Add contact" button) → helper text (`GET /api/master/support-contacts`) → error banner → `DataTable` (Image thumbnail via plain `<img>`, Label, Email, Phone, Sort, Active) with edit/delete row actions → modal (conditional): Label/Email/Phone/Image URL/Sort order fields + Active checkbox, Cancel/Save.
- **State & data**: `list`, `loading`, `error`, `modal`, plus one field per form input: `label`, `email`, `phone`, `imageUrl`, `sortOrder`, `isActive`, `submitting`.
- **API calls**: `masterApi.get('/master/support-contacts')` on mount; `masterApi.post('/master/support-contacts', body)` (create) or `masterApi.put('/master/support-contacts/{id}', body)` (edit) on submit; `masterApi.delete('/master/support-contacts/{id}')` on delete (native `confirm()`).
- **Notable quirks**:
  - Image is a raw URL text field, not an upload widget (contrast with `banners`, which uses `S3ImageUpload` — see section 16) — there is no way to upload a support-contact photo from this page, only paste an already-hosted URL.
  - Uses native `confirm()` for delete, unlike the shop-owner pages which use styled confirm modals — consistent within the "simple master-data CRUD" pages (support-contacts/banners/app-content/faq-items/shop-directory) but a different pattern from the shops/user pages.

---

## `(portal)/banners/page.js`

- **Path**: `src/app/management/(portal)/banners/page.js`
- **Route**: `/management/banners`. No query params.
- **Purpose**: CRUD for the customer-app home-screen promotional banner carousel (title, image, sort order, active flag), with a proper S3 image-upload widget rather than a bare URL field.
- **Entry points**: Sidebar → Customer App Directory → "Home Banners".
- **Exit points / navigation out**: None — in-page modal CRUD only.
- **Key UI sections**: Header ("Banners" + "Add banner" button) → helper text (`GET /api/master/banners`) → error banner → success `notice` banner (shown after an image replacement, since the modal itself closes before the upload notice would otherwise be visible) → `DataTable` (image thumbnail, title, sort, active) with edit/delete → modal: Title field, `S3ImageUpload` widget (staged file, not uploaded until save), Sort order, Active checkbox, Cancel/Save.
- **State & data**: `list`, `loading`, `error`, `notice`, `modal`, `title`, `imageUrl`, `imageFile` (staged File object, deliberately reset to `null` on `openEdit` so a previously-staged file from another banner's still-open modal session can never leak onto this one), `sortOrder`, `isActive`, `submitting`.
- **API calls**:
  - `masterApi.get('/master/banners')` on mount.
  - On submit: **save-then-upload** sequencing — `masterApi.post('/master/banners', body)` (create) or `masterApi.put('/master/banners/{id}', body)` (edit) happens first, then (only if a file was staged) `uploadBannerImage(bannerId, imageFile)` (from `src/lib/modelMedia.js`) uploads to a key derived from the banner's stored title/id, followed by `imageReplacementNotice(...)` building the on-page notice text.
  - `masterApi.delete('/master/banners/{id}')` on delete.
- **Notable quirks**:
  - The comment in the file explicitly flags that this upload endpoint's object key is *derived from the banner's title*, which is why the image can only be uploaded **after** the banner row exists (create) or already exists (edit) — a create flow that also stages an image is a two-network-call sequence rather than one atomic save.
  - Replacing an image deletes the old file from the bucket server-side; the `notice` banner exists specifically to surface that side effect in words since the modal that triggered it has already closed by the time it happens.

---

## `(portal)/app-content/page.js`

- **Path**: `src/app/management/(portal)/app-content/page.js`
- **Route**: `/management/app-content`. No query params.
- **Purpose**: CRUD for static mobile-app content blocks keyed by a free-text `code` (e.g. ABOUT_US, TERMS, PRIVACY, SUPPORT), each with a title and a long-form body.
- **Entry points**: Sidebar → Customer App Directory → "App Content (About/Terms)".
- **Exit points / navigation out**: None — in-page modal CRUD only.
- **Key UI sections**: Header ("App Content" + "Add content" button) → helper text (`GET /api/master/app-content`) → error banner → `DataTable` (Code, Title, Body — truncated to 80 chars with an ellipsis) with edit/delete → modal (wider, `max-w-2xl`): Code text input (placeholder suggesting known codes), Title input, Body `<textarea>` (14 rows, monospace font), Cancel/Save. No Active/sort-order fields (unlike the other three directory CRUD pages).
- **State & data**: `list`, `loading`, `error`, `modal`, `code`, `title`, `body`, `submitting`.
- **API calls**: `masterApi.get('/master/app-content')` on mount; `masterApi.post('/master/app-content', payload)` (create) or `masterApi.put('/master/app-content/{id}', payload)` (edit) on submit; `masterApi.delete('/master/app-content/{id}')` on delete (native `confirm()`).
- **Notable quirks**:
  - `code` is a completely free-text field with no dropdown/enum enforcement client-side — nothing stops an admin from creating a duplicate or misspelled code (e.g. `ABOUT_US` vs `About_Us`) that the mobile app's lookup-by-code logic would then simply fail to find.
  - No `isActive`/`sortOrder` fields at all, making this the simplest of the four "directory" CRUD pages in both form and table.

---

## `(portal)/faq-items/page.js`

- **Path**: `src/app/management/(portal)/faq-items/page.js`
- **Route**: `/management/faq-items`. No query params.
- **Purpose**: CRUD for the customer-app FAQ list (question, answer, sort order, active flag).
- **Entry points**: Sidebar → Customer App Directory → "FAQ".
- **Exit points / navigation out**: None — in-page modal CRUD only.
- **Key UI sections**: Header ("FAQ Items" + "Add FAQ" button) → helper text (`GET /api/master/faq-items`) → error banner → `DataTable` (Question, Answer truncated to 80 chars, Sort, Active) with edit/delete → modal: Question `<textarea>` (4 rows, required), Answer `<textarea>` (6 rows, required), Sort order number input, Active checkbox, Cancel/Save.
- **State & data**: `list`, `loading`, `error`, `modal`, `question`, `answer`, `sortOrder`, `isActive`, `submitting`.
- **API calls**: `masterApi.get('/master/faq-items')` on mount; `masterApi.post('/master/faq-items', body)` (create) or `masterApi.put('/master/faq-items/{id}', body)` (edit) on submit; `masterApi.delete('/master/faq-items/{id}')` on delete (native `confirm()`).
- **Notable quirks**:
  - Structurally almost identical to `support-contacts` and `banners` (same modal/table/CRUD shape, same `masterApi` conventions, same native-`confirm()` delete) — of the four "Customer App Directory" pages, this one and `support-contacts` are the closest to interchangeable boilerplate, differing only in field names.
  - Both Question and Answer are required `<textarea>`s with no rich-text/markdown support — the mobile app presumably renders these as plain text.

---

### Cross-page observations

- **Three distinct "shop" data models coexist**: (1) shop-owner + business-location records under `/auth/shop-owners[/...]`, driving `shops/page.js`, `new-owner`, `edit`, `view`, and `BusinessLocationsManager`; (2) shop-service `/shops[/...]` records driving `shop-directory` (services, pickup-slots) and referenced again by `shop-directory`'s and `shops/settings`'s different id space; (3) a third, barely-used `/auth/shops` resource that only `shops/new` (create) and `shops/settings` (read/update) touch. Nothing in the UI cross-links these three, and two of the three touchpoints (`shops/new`, `shops/settings`) have no discoverable entry point at all.
- **Orphaned pages**: `shops/new` (linked only from the Dashboard's "Add Shop" quick action, but not from the Shops list's own "add" button), `shops/settings` (no in-app link whatsoever), and `shop-directory` (has a `layout.js` header-title mapping but no Sidebar entry and no other in-app link) — three of the sixteen pages in scope are unreachable or nearly unreachable through normal navigation.
- **Address/geocoding logic is implemented independently at least three times**: `shops/new-owner/page.js`, `components/BusinessLocationsManager.js` (used by `edit`/`view`), and `shop-directory/page.js` each have their own Nominatim-calling code, with no shared helper module despite very similar behavior.
- **Two components are both named `UserManagementPage`** — one in `(portal)/users/page.js` (title "User Management", Sidebar label "Shop Staff") and one in `(portal)/user-management/page.js` (title and Sidebar label both "User Management") — a naming collision that only doesn't break anything because each lives in its own route file.
- **Auth is entirely client-side and localStorage-based**: `admin_token`/`admin_role` in `localStorage`, no cookies, no server middleware, no React context provider — every page/component that needs the token or role calls `getToken()`/`getRole()`/`isAdmin()` directly from `src/lib/auth.js`.
