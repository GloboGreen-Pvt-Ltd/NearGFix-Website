# Shop Owner Web Portal — Current-State Spec (GGFIX-Client)

This documents the shop-owner-facing web portal (`src/app/shopmanagement`, `src/app/shop-home/**`) as currently built, as of 2026-09-10. Reference/handoff spec — not a redesign proposal.

## Contents

1. [Layout & Auth Guard — `src/app/shop-home/layout.js` (`DashboardShell`)](#layout--auth-guard--srcappshop-homelayoutjs-dashboardshell)
2. [`shopmanagement/page.js` — Business Login](#shopmanagementpagejs)
3. [`shop-home/page.js` — Partner Dashboard](#shop-homepagejs)
4. [`shop-home/[...slug]/page.js` — Nav Stub / "Coming soon" catch-all](#shop-homeslugpagejs)
5. [`shop-home/account/business-profile/page.js` — Business Profile](#shop-homeaccountbusiness-profilepagejs)
6. [`shop-home/account/profile/page.js` — My Profile](#shop-homeaccountprofilepagejs)
7. [`shop-home/account/settings/page.js` — Account Settings](#shop-homeaccountsettingspagejs)
8. [`shop-home/services/book-service/page.js` — Book Service](#shop-homeservicesbook-servicepagejs)

---

## Layout & Auth Guard — `src/app/shop-home/layout.js` (`DashboardShell`)

- **Path**: `src/app/shop-home/layout.js` (wraps `src/components/shop-dashboard/DashboardShell.js`, which composes `Sidebar.js` + `TopNavbar.js` + `Breadcrumbs.js` + `ProfileDropdown.js`)
- **Route**: applies to every route under `/shop-home/*`
- **Purpose**: Provides the shared Partner Dashboard chrome (collapsible sidebar, top navbar with breadcrumbs/search/profile menu) and — more importantly — the single auth guard for the entire `shop-home` tree. The guard used to be duplicated inside `shop-home/page.js` itself; it was moved up here so every dashboard route is protected once instead of ~30 pages each re-implementing the check.
- **Entry points**: Not directly linked — it's a Next.js layout, implicitly applied to all `shop-home/*` navigations.
- **Exit points / navigation out**: `router.replace('/shopmanagement')` (via `next/navigation`'s `useRouter`) whenever `isLoggedIn()` (from `src/lib/shopAuth.js`) is false, checked in a `useEffect` right after mount. Until `mounted && isLoggedIn()`, it renders a full-screen centered spinner instead of children — so a logged-out user briefly sees a spinner, then gets bounced to `/shopmanagement`.
- **Key UI sections**: `Sidebar` (desktop fixed / mobile slide-in drawer, driven by `src/lib/partnerNav.js`'s `PARTNER_NAV` + `DASHBOARD_ITEM`) → `TopNavbar` (mobile hamburger, page title + `Breadcrumbs`, a non-functional search input, help/notification icon buttons, `ProfileDropdown`) → a desktop-only sidebar collapse toggle tab → `<main>` containing `{children}`.
- **State & data**: `mounted`, `shopOwner` (read via `readShopOwner()` + `subscribe()` from `shopAuth.js`), `collapsed` (sidebar icon-only mode), `mobileOpen` (drawer). All local component state, no Redux/Context store.
- **API calls**: None directly — reads only from `localStorage` via `shopAuth.js`.
- **Notable quirks**:
  - The guard is purely client-side (`'use client'`, checked in `useEffect`) — there is no middleware/SSR redirect, consistent with this app running under `output: 'export'` (a static export, confirmed by the `[...slug]/generateStaticParams()` comment in the catch-all page).
  - `ProfileDropdown`'s menu only links to Business Profile and Account Settings — `/shop-home/account/profile` ("My Profile") is not linked from anywhere in the shell (see that page's section below).
  - `TopNavbar`'s search field is a real controlled input but wired to nothing — explicitly documented in its own header comment as intentional (no backend search endpoint exists yet).

---

## `shopmanagement/page.js`

- **Path**: `src/app/shopmanagement/page.js` (renders `src/components/site/shoplogin.js`'s `ShopLogin` component)
- **Route**: `/shopmanagement`
- **Purpose**: The shop-owner "Business Login" screen — mobile number + OTP sign-in that, on success, lands the owner in the Partner Dashboard at `/shop-home`. Deliberately lives outside the `(site)` route group: per the page's own code comment, this page has its own full-screen chrome (the centered login card), not the marketing `SiteHeader`/`SiteFooter` — nesting it under `(site)` would wrap it in both and double the header, same reasoning applied to `shop-home/page.js` and `business/register/page.js`.
- **Entry points**:
  - `src/components/site/SiteHeader.js` — three separate "Business Login" links, all pointing at `CTA.businessLogin.href` (`src/lib/siteContent.js` → `/shopmanagement`): a mobile icon-only button (`<Store>` icon, `lg:hidden`), a desktop outline button (`hidden lg:inline-flex`), and a mobile nav-panel button. Explicitly kept as a separate control from the customer `HeaderAccount` sign-in, never merged into one dropdown, per an inline code comment.
  - `src/components/site/BusinessRegister.js` (the `/business/register` page's own header) — a "Business Login" link/button next to "Already have a business account?", also targeting `/shopmanagement`.
  - `src/components/shop-dashboard/DashboardShell.js` — redirects here (`router.replace`) when an unauthenticated visitor hits any `/shop-home/*` route (the auth-guard exit described above).
  - `src/components/shop-dashboard/ProfileDropdown.js` — redirects here after "Logout".
- **Exit points / navigation out**: Inside `ShopLogin` itself: on OTP verification success, `writeSession(result.session)` is called, then after a 900ms delay (to let the "Verified successfully" checkmark show) `router.replace('/shop-home')`. Also a static `<Link href="/business/register">Register your business</Link>` under the card ("New to GGFIX Business?").
- **Key UI sections**: Decorative background glow blobs → brand header (store icon, "Business Login" title, subtitle) → white card containing either the mobile-number step (country-code-prefixed input, "Send OTP" submit) or the OTP step (masked mobile number display, "Change number" link, 6-box `OtpBoxes` input with auto-verify-on-6th-digit, resend countdown/button, "Verify & Sign In" button, a "Verified successfully" checkmark state) → "Register your business" link → a small "protected with OTP verification" trust row.
- **State & data**: All local component state inside `ShopLogin`: `step` ('mobile'|'otp'), `mobile`, `mobileError`, `sending`, `otp` (array of 6 digits), `otpError`, `verifying`, `verified`, `shake`, `resendSeconds`, `resending`, plus two refs (`attemptedOtpRef`, `verifyLockRef`) used to guard against the OTP auto-verify effect double-firing on a failed attempt. On success, session is persisted via `writeSession()` into `localStorage` under `ggfix_shop_token` / `ggfix_shop_owner` (`src/lib/shopAuth.js`) — a storage key and mechanism entirely separate from the staff admin portal's `admin_token` (`src/lib/auth.js`) and the customer site's `ggfix_customer_token` (`src/lib/customerAuth.js`), so the three account types can coexist in one browser without clobbering each other.
- **API calls**:
  - `POST {AUTH_BASE}/auth/shop-login/request-otp { mobile }` — fired on "Send OTP" and "Resend OTP" (`sendMobileOtp()` in `src/lib/shopMobileAuth.js`). A `400 "No shop registered for that mobile number"` response is treated as a soft pass (the number may still be a real owner's personal phone, verified by the next call) rather than a hard failure.
  - `POST {AUTH_BASE}/auth/login { email: <mobile digits>, otp }` — fired on OTP verification (`verifyMobileOtp()`), auto-triggered the instant the 6th digit is typed/pasted, or via the "Verify & Sign In" button. The field is literally named `email` in the shared `LoginRequest` DTO even though a bare mobile number is sent — the backend's `AuthService.login()` resolves it against `users.phone` first, then `shops.mobile`.
- **Notable quirks**:
  - OTP delivery is dev-mode only on the backend — a shop's OTP is a static stored value (commonly `123456`), not actually sent by SMS. This is called out as a real, known backend limitation in both `shoplogin.js`'s and `shopMobileAuth.js`'s header comments, not something fixable from this page.
  - `src/lib/shopAuth.js` also contains an older, still-exported `login({ email, password, otp })` function (email + password/OTP against the same `/auth/login` endpoint) — this appears to be legacy/unused by the current `ShopLogin` component, which only calls `shopMobileAuth.js`'s mobile-number flow. `shopAuth.js`'s own header comment frames the mobile-OTP path as "a third real path" layered on top of that older login(), suggesting the password-based flow predates this OTP-only redesign and was left in place rather than deleted.
  - The `attemptedOtpRef`/`verifyLockRef` guards exist specifically to fix a documented bug: without them, a wrong OTP would reset `verifying` to false, which re-satisfied the auto-verify effect's dependency array and caused an infinite retry loop against `/auth/login`. Worth knowing if touching this file.

---

## `shop-home/page.js`

- **Path**: `src/app/shop-home/page.js`
- **Route**: `/shop-home`
- **Purpose**: The Partner Dashboard home/landing page — a KPI/analytics overview (today's bookings, pending pickups, active repairs, ready-for-delivery, today's revenue, open enquiries), plus weekly booking chart, pickup reminder, team activity, completion-rate gauge, quick actions, and a recent-bookings list. Per its own header comment, every tile is real data aggregated client-side (no single backend endpoint provides "today's KPIs" for a shop) — see `src/lib/shopDashboard.js`.
- **Entry points**:
  - `Sidebar.js`'s `DashboardLink` (always the first sidebar item, from `DASHBOARD_ITEM` in `partnerNav.js`) → `/shop-home`.
  - `Breadcrumbs.js`'s "Home" crumb, present on every `shop-home/*` page → `/shop-home`.
  - `ShopLogin`'s post-login redirect (`router.replace('/shop-home')`).
- **Exit points / navigation out**: All via `next/link` `<Link>` (no imperative `router.push`), all to other `shop-home` destinations (most of which currently resolve to the `[...slug]` "Coming soon" stub since no real page exists yet):
  - 6 KPI `StatCard`s → `/shop-home/services/bookings`, `/shop-home/services/pickups`, `/shop-home/services/service-status`, `/shop-home/services/delivery`, `/shop-home/reports/revenue`, `/shop-home/services/enquiries`.
  - `ReminderCard`'s "View Pickup" button → `/shop-home/services/pickups`.
  - `TaskListCard`'s "New" pill and `TeamActivityCard`'s "View Team" → `/shop-home/employee/tasks`, `/shop-home/employee/team`.
  - 6 `QuickAction` tiles → Book Service (`/shop-home/services/book-service` — the one real destination), Create Pickup, Add Customer, New Enquiry, View Deliveries, Assign Task.
  - "Recent Bookings" section's "View all" → `/shop-home/services/bookings`.
- **Key UI sections** (render order): `PageHeader` (time-of-day greeting + owner name, via `deriveDisplayName()`) → 6-tile KPI grid → 3-column row (`WeeklyBookingsChart` bar chart / `ReminderCard` / `TaskListCard`, the last an honest empty state since there's no task-management backend concept) → 2-column row (`TeamActivityCard` list / `CompletionGauge` circular SVG gauge) → "Quick Actions" 6-tile grid → "Recent Bookings" list card.
- **State & data**: `shopOwner` (from `readShopOwner()` + `subscribe()`, `shopAuth.js`), `data` (`{ bookings, counts, chats, technicians, tickets }`, fetched once via `Promise.allSettled` — a failed individual call degrades to an empty array/object rather than blocking the rest), `loading`. All local `useState`; derived KPI values (`bookingsToday`, `pending`, `revenueToday`, `enquiries`, etc.) are computed inline from `data` each render using pure helpers from `src/lib/shopDashboard.js`.
- **API calls** (all via `shopRequest()` in `src/lib/shopApi.js`, signed with the shop-owner's own bearer token, fired together in one `Promise.allSettled` on mount):
  - `GET {ORDER_BASE}/repair-bookings/shop` (`fetchShopBookings`)
  - `GET {TICKET_BASE}/tickets/counts` (`fetchTicketCounts`)
  - `GET {MARKETPLACE_BASE}/shop/chats` (`fetchShopChats`)
  - `GET {TICKET_BASE}/technicians` (`fetchTechnicians`)
  - `GET {TICKET_BASE}/tickets?page=&size=` paged up to 10 pages of 200 (`fetchTicketsPaged`, used to compute "today's/yesterday's revenue" client-side since there's no date-filtered revenue endpoint)
- **Notable quirks**:
  - None of these backend calls take a date-range parameter, so "today", "yesterday" and "last 7 days" are all computed in the browser from each row's `createdAt` in local time — an explicit, documented trade-off, not a bug.
  - "Today's Tasks" is intentionally a plain empty state rather than fabricated sample data, because no task-tracking concept exists anywhere in the schema (bookings, tickets, technicians, chat) — called out directly in the file's header comment.
  - Of the 6 Quick Actions and 6 KPI-card destinations, only `/shop-home/services/book-service` currently has a real page; the rest fall through to the `[...slug]` "Coming soon" stub.

---

## `shop-home/[...slug]/page.js`

- **Path**: `src/app/shop-home/[...slug]/page.js`
- **Route**: `/shop-home/*` (catch-all) — resolves any path segment array that matches a known nav item's `slug` in `src/lib/partnerNav.js` (`PARTNER_NAV_FLAT` sidebar items or `ACCOUNT_ITEMS_WITH_HREF`) to an honest `ComingSoon` placeholder (same icon/label/description as the sidebar entry). Any other path (typo, stale link, arbitrary URL) calls `notFound()` instead of pretending every URL is valid.
- **Purpose**: Placeholder for every real sidebar/account destination that doesn't have a built page yet (the large majority — Requote, Pickups, Bookings, Customers, Enquiries, Model Compatibility, Service Status, Delivery, Warranty/Rework, and the entire Employee and Reports sections). Not dead links or fake data — a real route that plainly states "Coming soon".
- **Route resolution detail**: `generateStaticParams()` pre-renders one static page per slug in `ALL_STUB_SLUGS` (required because the app builds under `output: 'export'`). At runtime, `findNavItemBySlug(params.slug)` joins the slug array back into a `/`-delimited string and looks it up in `PARTNER_NAV_FLAT` then `ACCOUNT_ITEMS_WITH_HREF`; no match → `notFound()`. When a real page.js is later added at one of these paths (e.g. `services/bookings`), Next.js's routing gives the real page priority automatically and this catch-all is never consulted for that exact path again — already true today for `account/business-profile`, `account/profile`, `account/settings`, and `services/book-service`.
- **Entry points**: Every unbuilt `Sidebar` link and every unbuilt Dashboard KPI/Quick-Action link (see `shop-home/page.js` above) — i.e. most of the sidebar.
- **Exit points / navigation out**: None — `ComingSoon` (`src/components/shop-dashboard/ComingSoon.js`) renders a static icon, title, description and a "Coming soon" badge with no links or buttons.
- **Key UI sections**: Single centered card: icon badge → title (nav item label) → description → "Coming soon" pill.
- **State & data**: None — fully static per the matched nav item's data.
- **API calls**: None.
- **Notable quirks**:
  - This is effectively the majority state of the `shop-home` IA today: of ~30 sidebar destinations defined in `partnerNav.js`, only Book Service, Business Profile, Account Settings, and (orphaned) My Profile have real pages — everything else in Services/Employee/Reports is this stub.

---

## `shop-home/account/business-profile/page.js`

- **Path**: `src/app/shop-home/account/business-profile/page.js`
- **Route**: `/shop-home/account/business-profile`
- **Purpose**: "Business Profile" — a card-grid CRUD view of every business location on the signed-in owner's account (add/edit/delete/view), mirroring the admin's Business Locations table (`src/components/BusinessLocationsManager.js`) but as cards and signed with the owner's own token instead of `admin_token`.
- **Entry points**: `ProfileDropdown.js`'s account menu — "Business Profile" item (with a `Store` icon) → `/shop-home/account/business-profile`. Not present in the main sidebar (per `partnerNav.js`, account-menu destinations are deliberately excluded from the sidebar).
- **Exit points / navigation out**: No `<Link>`/`router.push` calls in this file — all interaction is in-page modal state (`LocationFormModal` for add/edit, `LocationDetailModal` for view, a local `ConfirmDeleteDialog` for delete). Closing any modal just clears local state; nothing navigates away.
- **Key UI sections**: `PageHeader` ("Business Profile" + "Add Business Location" button) → loading skeleton (3 pulsing placeholder cards) OR empty state (Store icon, "No business locations yet", CTA) OR a responsive grid of `BusinessLocationCard`s (first card flagged `isMain`) → conditionally rendered `LocationFormModal` (add/edit) / `LocationDetailModal` (view) / `ConfirmDeleteDialog` (delete confirmation).
- **State & data**: `profile` (full `GET /auth/me` response, refetched after every add/edit/delete so the grid never goes stale), `loading`, `loadError`, `formState` (`{mode:'add'|'edit', initial}` or `null`), `viewingLoc`, `deletingLoc`, `deleting`, `deleteError` — all local `useState`, no global store.
- **API calls** (all via `shopRequest()`, owner's bearer token):
  - `GET {AUTH_BASE}/auth/me` (`fetchMyProfile`, `src/lib/shopProfile.js`) — loads `profile.locations[]`; refetched after every mutation.
  - `POST {AUTH_BASE}/auth/shop-owners/{ownerId}/locations` (`addShopLocation`)
  - `PATCH {AUTH_BASE}/auth/shop-owners/{ownerId}/locations/{id}` (`updateShopLocation`)
  - `DELETE {AUTH_BASE}/auth/shop-owners/{ownerId}/locations/{id}` (`deleteShopLocation`)
  - (all three defined in `src/lib/shopLocations.js`)
- **Notable quirks**:
  - `ownerId` is always taken fresh from `fetchMyProfile()`'s response (`profile.id`), never from the cached `shopAuth` session — documented in `shopLocations.js` because the older email/password `login()` path never stores a `userId` in the session; only the mobile-OTP path does.
  - `shopLocations.js`'s header comment flags a subtle routing gotcha it already worked around: `AUTH_BASE()` already ends in `/auth`, and these paths repeat `/auth/...` again (intentionally) because nginx strips exactly one `/auth/` prefix before proxying to the Spring controller (itself `@RequestMapping("/auth")`) — a single-`/auth` path would 403 in a way that looks like an ownership rejection but is really a mis-routed path.
  - Location pickup-window fields (`pickupEnabled`/`pickupFromTime`/`pickupToTime`/`pickupDistanceKm`) written here are the same fields the "Pickup Service" tab on Account Settings edits — two different UIs over the same location record.

---

## `shop-home/account/profile/page.js`

- **Path**: `src/app/shop-home/account/profile/page.js`
- **Route**: `/shop-home/account/profile`
- **Purpose**: "My Profile" — a read-only display of the signed-in owner's name, shop name, email and mobile number, pulled straight from the `shopAuth` session (no live fetch).
- **Entry points**: **None found.** Grepping the whole `src/` tree for `account/profile` turns up no `<Link>`/`href`/`router.push` targeting this exact route anywhere in the current codebase — not in the sidebar, not in `ProfileDropdown`'s menu, not in the Dashboard. It is reachable only by typing the URL directly (or an old bookmark). `partnerNav.js`'s own comment confirms this: "My Profile" (`account/profile`) used to be a third `ACCOUNT_ITEMS` entry alongside Business Profile/Account Settings but was removed as redundant once Account Settings' "Personal Information" tab gained its own avatar upload — the page.js file itself was simply never deleted.
- **Exit points / navigation out**: One "Edit Profile" `<Link>` in the `PageHeader` action slot → `/shop-home/account/settings`.
- **Key UI sections**: `PageHeader` ("My Profile" + "Edit Profile" link) → gradient identity banner (avatar-initials circle, name, role label, email/shop-name inline chips) → "Personal Information" field grid (Full Name, Email Address, Mobile Number, Business, Role — each rendered only `if (value)`, so missing fields are simply omitted rather than shown blank) → a green "Your information is safe with us" privacy note.
- **State & data**: `shopOwner`, read via `readShopOwner()` + `subscribe()` (`shopAuth.js`) — purely a display of whatever the current session object already contains; no independent fetch of its own.
- **API calls**: None.
- **Notable quirks**:
  - This page is dead/orphaned code in the navigation sense — real, working, but unreachable from any UI control. It still functions correctly if visited directly, since it takes routing priority over the `[...slug]` catch-all automatically (a real `page.js` always wins over a catch-all for an exact-matching path).
  - Its own header comment is candid about this: it explicitly says the reference design this was styled after also showed Location/Department/Joined-date/Timezone fields that don't exist in this session shape, and were left out rather than faked.
  - Its "Edit Profile" link is somewhat misleading — Account Settings' Personal Information tab is a live editable form (name, email, mobile, avatar, address), whereas this page itself is pure display, so "Edit Profile" more accurately means "go somewhere else to edit."

---

## `shop-home/account/settings/page.js`

- **Path**: `src/app/shop-home/account/settings/page.js`
- **Route**: `/shop-home/account/settings`
- **Purpose**: "Account Settings" — a 6-tab hub (Personal Information, KYC Document, Subscription, My QR Code, Pickup Service, My Orders) covering everything an owner can view/edit about their own account, each tab backed by a real endpoint already used elsewhere in the app.
- **Entry points**: `ProfileDropdown.js`'s account menu — "Account Settings" item (`Settings` icon). Also linked *to* from within the app: `shop-home/account/profile/page.js`'s "Edit Profile" button, and the Dashboard/My-Orders "View all" links effectively duplicate its My Orders tab's "View all" → `/shop-home/services/bookings` (a stub).
- **Exit points / navigation out**: "My Orders" tab → "View all" `<Link>` → `/shop-home/services/bookings` (stub). "Subscription" tab → "Upgrade to BASIC" is a `mailto:support@ggfix.in?subject=...` link, not an in-app navigation (deliberately not wired to the record-only `/subscriptions/activate` endpoint, which would mark the account paid with no payment actually collected). Every other action (avatar upload, name/email/mobile edits, KYC upload/submit, pickup save) is an in-place async call with no navigation.
- **Key UI sections** (tab bar, `activeTab` state, one tab body rendered at a time):
  1. **Personal Information** — avatar (upload via hidden file input, PNG/JPG ≤1MB), `EditableNameField` (direct save), `EditableContactField` ×2 for email/mobile (two-step: enter new value → send OTP → verify OTP → save, since these double as login identifiers), read-only Business field, then a separate `AddressSection` card (one edit toggle for the whole 7-field residential address).
  2. **KYC Document** — status badge (Verified/Rejected/Under Review/Not submitted), a rejection-reason banner if applicable, 3 upload tiles (Aadhar Front/Back, PAN), "Submit for Review" button (disabled until at least one file is staged).
  3. **Subscription** — current-plan card (name, days remaining, expiry date) + an "Upgrade to BASIC" mailto CTA + a 3-stat row (price/shops/employees) when a BASIC plan exists in the catalog.
  4. **My QR Code** — a client-generated QR code (via the `qrcode` package) encoding a Google Maps search URL for the owner's first location, with Download and Copy-link buttons.
  5. **Pickup Service** — per-location selector (if >1 location), an on/off toggle switch, From/To time fields, a pickup-radius (km) field, "Save Changes".
  6. **My Orders** — a read-only recent-bookings list (reuses the Dashboard's booking-card layout/status badges) + "View all".
- **State & data**: Page-level `activeTab`, `profile` (from `fetchMyProfile()`), `loading`, `loadError`. Each tab additionally manages its own local state (e.g. `KycDocumentTab`'s `kyc`/`urls`/`uploading`; `SubscriptionTab`'s `sub`/`plans`; `PickupServiceTab`'s per-field `form`). Saves that touch identity fields (name/email/mobile/avatar) call `updateShopOwnerSession()` (`shopAuth.js`) to keep the shared session — and therefore the sidebar/navbar avatar — in sync everywhere via its `subscribe()` broadcast.
- **API calls** (all via `shopRequest()` unless noted, owner's bearer token):
  - `GET {AUTH_BASE}/auth/me` — page-level profile load (`fetchMyProfile`).
  - `POST {AUTH_BASE}/auth/me/kyc-documents/upload` (type=avatar) → `PUT {AUTH_BASE}/auth/me/avatar` — two-step avatar upload/save (`uploadMyAvatar`/`saveMyAvatar`, raw `fetch` for the multipart upload).
  - `PATCH {AUTH_BASE}/auth/me` — name save and address save (`updateMyProfile`).
  - `POST {AUTH_BASE}/auth/me/email/otp/send` / `POST {AUTH_BASE}/auth/me/email/otp/verify` — email change (`sendChangeEmailOtp`/`verifyChangeEmailOtp`).
  - `POST {AUTH_BASE}/auth/me/mobile/otp/send` / `POST {AUTH_BASE}/auth/me/mobile/otp/verify` — mobile change (`sendChangeMobileOtp`/`verifyChangeMobileOtp`).
  - `GET {AUTH_BASE}/auth/me/kyc-documents`, `POST {AUTH_BASE}/auth/me/kyc-documents`, `POST {AUTH_BASE}/auth/me/kyc-documents/upload` (type=aadhaar-front|aadhaar-back|pan) — KYC tab (`fetchMyKyc`/`saveMyKyc`/`uploadMyKycFile`, `src/lib/shopKyc.js`).
  - `GET {SUBSCRIPTION_BASE}/subscriptions/owner/{ownerId}`, `GET {SUBSCRIPTION_BASE}/subscriptions/plans` — Subscription tab (`fetchMySubscription`/`fetchSubscriptionPlans`, `src/lib/shopSubscription.js`).
  - `PATCH {AUTH_BASE}/auth/shop-owners/{ownerId}/locations/{id}` — Pickup Service save (`updateShopLocation`, `src/lib/shopLocations.js`, the same call Business Profile's edit form uses).
  - `GET {ORDER_BASE}/repair-bookings/shop` — My Orders tab (`fetchShopBookings`, same call/mapping as the Dashboard's Recent Bookings).
- **Notable quirks**:
  - This page absorbed the avatar-upload responsibility that used to belong to `/shop-home/account/profile` ("My Profile") after that page was removed from navigation — its own header comment says so explicitly.
  - Mobile-change OTP is always `123456` (no SMS gateway anywhere in the codebase); email-change OTP is a real emailed code — an inconsistency inherited from the backend, not introduced here.
  - The Subscription tab has a special case for `FREE_TRIAL`: since the plan catalog (`GET /subscriptions/plans`) only lists purchasable plans (e.g. BASIC), a trial subscription would otherwise render its raw enum spelling; the code explicitly checks `subscriptionType`/`status`/`planCode` for trial-ness before falling back to a catalog lookup.
  - "My QR Code" doesn't encode an actual public shop-profile URL (none exists yet) — it encodes a Google Maps search link for the shop's address, reusing the exact URL-building logic `BusinessLocationsManager.js`'s "Find on Google Maps" already uses. "Share your shop" today effectively means "share directions to it."

---

## `shop-home/services/book-service/page.js`

- **Path**: `src/app/shop-home/services/book-service/page.js`
- **Route**: `/shop-home/services/book-service`
- **Purpose**: "Book Service" (Create Booking) — lets a shop create a repair booking on behalf of a walk-in/pickup/doorstep customer: Customer → Device → Problem/Service Type → Photos → Pickup/Address → Preferred Date & Time → Estimated Price → Confirm Booking.
- **Entry points**:
  - `Sidebar.js` — "Book Service" item under the "Services" section (`/shop-home/services/book-service`, from `partnerNav.js`).
  - `shop-home/page.js`'s "Quick Actions" grid — "Book Service" tile (the only Quick Action pointing at a real page rather than a stub).
- **Exit points / navigation out**: After a successful "Confirm Booking", the page swaps to a confirmation view showing booking number/customer/model, service method, schedule, estimated total and status, with two actions: "Create another booking" (resets local form state, no navigation) and a `<Link href="/shop-home/services/bookings">View bookings</Link>` (currently resolves to the `[...slug]` stub).
- **Key UI sections** (render order): `PageHeader` → optional profile-load error banner → `CardShell`s in sequence: Customer Details (name/mobile/alt-mobile/email) → Device Details (cascading Category → Brand → Model selects hitting `masterApi`, plus conditional Color/Variant selects populated from the selected model's `colors`/`ramStorage`) → Problem & Service Type (service-category select → multi-select service-type checkboxes → device-condition select → free-text problem description) → Device Photos (Front/Back/Damage required tiles + unlimited "Additional" tiles, each an upload-in-place tile) → Pickup / Service Method (Walk-in/Pickup/Doorstep select; address fields shown only for non-walk-in) → Preferred Date & Time (7-day horizontal day-picker + time-slot buttons, sourced from the shop's real pickup slots or a hardcoded 5-slot fallback) → Estimated Price (6 manual charge fields + live subtotal/tax/total) → a sticky bottom bar showing running total and "Confirm Booking".
- **State & data**: `profile` (for `shopId`), a single `form` object (`EMPTY_FORM` — ~25 fields covering customer/device/service/address/pricing), `categories`/`brands`/`models` (+ loading flags) for the device cascade, `repairCategories`/`repairServices` for the problem/service-type step, `photos` (`{front, back, damage, additional[]}`) + per-slot `photoUploading`, `slots`/`slotsLoading`/`days`/`dayIdx` for the date/time picker, `totals` (derived via `estimateTotal(form)`), and submit-flow state (`submitting`, `submitError`, `confirmed`). All local `useState`/`useMemo`, no global store.
- **API calls**:
  - `GET {AUTH_BASE}/auth/me` (`fetchMyProfile`) — to obtain the shop's location/`shopId`.
  - `GET /master/device-categories`, `GET /master/categories/by-code/{code}/brands`, `GET /master/brands/{brandId}/models`, `GET /master/repair-categories`, `GET /master/repair-services` (all via `masterApi`, the same master-data calls the public `/repair` flow's `RepairFlow.js` uses) — device and service-type lookups.
  - Pickup slots via `getPickupSlots(shopId)` (`src/lib/repairBooking.js`, same pattern the public repair flow uses), with a hardcoded `FALLBACK_SLOTS` (5 two-hour windows) if none are configured.
  - `uploadShopDevicePhoto(file, slot)` → real upload to the shared media-upload service (`MEDIA_UPLOAD_URL()`), signed with the shop owner's own bearer token instead of a customer's (`src/lib/shopBooking.js`).
  - `createShopBooking(payload)` — **a stub**: it does not call any backend endpoint. It `await`s a fixed 600ms delay and returns a locally-fabricated object (`{ id: 'local-' + Date.now(), bookingNumber: 'GG' + random 6 digits, status: 'CREATED', createdAt: now, ...payload }`).
- **Notable quirks**:
  - The booking-creation step is explicitly fake data, unlike everything else on this page — `shopBooking.js`'s header comment explains why: no backend endpoint exists yet for a shop to create a booking on a walk-in customer's behalf (the only `POST /repair-bookings` in the codebase requires a *customer* bearer token and is only called from the public `/repair` flow). The comment even sketches the exact `shopRequest(... POST /repair-bookings ...)` call to drop in once that endpoint ships — everything the form already collects is shaped to match `RepairBookingRequest` plus the extra walk-in fields.
  - So the "Confirm Booking" success screen and its data are real-looking but entirely client-fabricated; nothing is actually persisted server-side yet, and the booking will not appear in the Dashboard's "Recent Bookings" or in "My Orders" (both of which read real `GET /repair-bookings/shop` data).
  - Device photo upload, master-data lookups, and the shop's pickup-slot lookup are all genuinely live/real calls — only the final submit is mocked, which is easy to miss since the UI gives no visual indication that "Confirm Booking" doesn't actually reach the backend.

---

## Cross-cutting notes

- **Auth mechanism vs. the admin portal**: The shop-owner session (`ggfix_shop_token` / `ggfix_shop_owner` in `localStorage`, managed by `src/lib/shopAuth.js`) hits the *same* backend endpoint the staff admin portal's login (`src/app/management/(login)/page.js`) uses — `POST {AUTH_BASE}/auth/login` — but the two are mutually exclusive gates on the same endpoint: `shopAuth.js` accepts only `SHOP_OWNER`/`SHOP_LOGIN` `loginType`s and rejects staff types with "Staff accounts must sign in through the Admin Portal"; the admin login does the mirror-image rejection. Sessions are stored under separate `localStorage` keys from both the admin (`admin_token`) and the customer site (`ggfix_customer_token`), so all three can be logged in simultaneously in one browser without clobbering each other.
- **Relationship to a mobile "Partner"/owner app**: Multiple `lib/shop*.js` files' header comments describe their endpoints as "the same ... the mobile app's KYC upload screen uses" (`shopKyc.js`) or reference an owner mobile app's existing screens for KYC/avatar flows — indicating this web portal is a parallel, second front door onto the same shop-owner account and backend surface as an existing mobile Partner app, not a standalone product. The web portal appears newer/less complete: most of its own sidebar (`partnerNav.js`) is still `[...slug]` "Coming soon" stubs, while the mobile app (per these comments) already has working KYC/profile screens against the same endpoints.
- **Static export constraint**: The presence of `generateStaticParams()` in the `[...slug]` catch-all (required "under `output:'export'`", per its own comment) means this whole app builds as a static export — consistent with every auth guard here being client-side-only (no server middleware redirect is possible under that build mode).
