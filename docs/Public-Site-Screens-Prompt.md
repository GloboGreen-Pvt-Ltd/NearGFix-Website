# Public Marketing Site — Current-State Spec (GGFIX-Client)

This documents the public marketing site pages (`src/app/(site)/**`, plus `business/register`) as currently built, as of 2026-09-10. Reference/handoff spec — not a redesign proposal.

## Contents

1. [Home — `(site)/page.js`](#1-home--sitepagejs)
2. [About — `(site)/about/page.js`](#2-about--siteaboutpagejs)
3. [Contact — `(site)/contact/page.js`](#3-contact--sitecontactpagejs)
4. [FAQ — `(site)/faq/page.js`](#4-faq--sitefaqpagejs)
5. [Nearby Shops — `(site)/nearby-shops/page.js`](#5-nearby-shops--sitenearby-shopspagejs)
6. [Pricing — `(site)/pricing/page.js`](#6-pricing--sitepricingpagejs)
7. [Privacy — `(site)/privacy/page.js`](#7-privacy--siteprivacypagejs)
8. [Repair — `(site)/repair/page.js`](#8-repair--siterepairpagejs)
9. [Shop (For Shops) — `(site)/shop/page.js`](#9-shop-for-shops--siteshoppagejs)
10. [Terms — `(site)/terms/page.js`](#10-terms--sitetermspagejs)
11. [Business Register — `business/register/page.js`](#11-business-register--businessregisterpagejs)

---

## 1. Home — `(site)/page.js`

- **Path**: `src/app/(site)/page.js`
- **Route**: `/` (no dynamic segments or query params). Server component; `(site)` is a route group and contributes nothing to the URL.
- **Purpose**: The main marketing landing page — a single-`<h1>` (visually hidden) page built from nine stacked `<Section>`s: hero banner, "Our Services" menu, how-repair-works, sell, buy, why-GGFIX, orders/tracking, an FAQ teaser, and a closing CTA. It is the canonical explainer for all three customer journeys (repair / sell / buy).
- **Entry points**: This is the site root, reached from every `<Link href="/">` (logo in `SiteHeader`/`SiteFooter`/`BusinessRegister` header) and from the "Home" item in `SITE_NAV` (`src/lib/siteContent.js`) rendered by `SiteHeader`. Also the fallback destination after most CTA buttons whose `href="/"`.
- **Exit points / navigation out**:
  - "Our Services" grid (`HOME_MENU_GROUPS`) → `/repair`, `#sell`, `#buy` (same-page anchors for two of the three).
  - `HeroCarousel` — admin-managed banner slider; slides are images, not navigation (no per-slide link).
  - "Read all {N} questions" → `/faq`.
  - Closing `CTABand` — primary `CTA.contact` → `/contact`; secondary `CTA.forShops` → `/shop`.
  - Sell section CTA button `CTA.getApp` → `/contact` (apps aren't published yet, so "Get the app" routes to Contact).
- **Key UI sections** (render order): 1) Hero — `<HeroCarousel exclude={['Repair']} />` banner + sr-only `<h1>`. 2) "Our Services" — 3 image-linked cards (Repair/Sell/Buy) from `HOME_MENU_GROUPS`. 3) "How a repair works" — `StepList` of `REPAIR_STEPS` + a sticky ticket-lifecycle card (`TICKET_LIFECYCLE`). 4) "Sell" (dark section) — 3 feature blurbs + `SELL_STEPS` (10-step list) + `CTA.getApp` button. 5) "Buy" — `BUY_FEATURES` cards + 2 explainer cards. 6) "Why GGFIX" — `CUSTOMER_EXTRAS` cards, 2 security cards, `CUSTOMER_FACTS` stat tiles. 7) "Track everything" (My Orders) — bullet list + a static mock "My Orders" card (`ORDER_TABS`, `ORDER_STATUSES`, first 4 `TICKET_LIFECYCLE` rows) — purely illustrative, not live data. 8) FAQ teaser — first 5 `FAQS` as `<details>` accordions. 9) Closing `CTABand`.
- **State & data**: No local component state in `page.js` itself (it's a server component). All content is static data imported from `src/lib/siteContent.js` (`BRAND`, `HOME_MENU_GROUPS`, `REPAIR_STEPS`, `TICKET_LIFECYCLE`, `SELL_HIGHLIGHT`, `SELL_STEPS`, `BUY_FEATURES`, `CUSTOMER_EXTRAS`, `FAQS`, `CTA`). `HeroCarousel` (a client component it renders) owns its own state — see its entry under Repair below, same component.
- **API calls**: None directly in `page.js`. The one live call on the page is inside `HeroCarousel`: `GET /master/banners` (via `masterApi`) on mount, to refresh the admin-managed slides beyond the bundled `BANNERS` fallback.
- **Notable quirks**:
  - The "My Orders" preview card is entirely fake/static (hardcoded tab highlight, hardcoded "Pending" status highlight) — it illustrates the *shape* of the customer app's Orders screen, not real data, since the site has no customer order backend integration on this page.
  - `SERVICE_IMAGES` are local `/public` PNGs (1254×1254) rather than remote/admin-managed, unlike the hero banners — a deliberate reliability trade-off called out in the source comments.
  - `CategoryRail.js` (`src/components/site/CategoryRail.js`) is dead code: it fetches `/master/categories` and renders a device-category rail, but is not imported by `page.js` or any other file in the app — confirmed via a codebase-wide search for its import. The home page's comments confirm it: "the category tiles that used to fill this section are gone," replaced by the 3-card `HOME_MENU_GROUPS` grid. The file is orphaned but not deleted.
  - `CUSTOMER_FACTS` is deliberately a *separate* dataset from the shared `PLATFORM_FACTS` used on `/about`, per an explicit code comment — to avoid implying the customer app itself is a 15-day trial.

---

## 2. About — `(site)/about/page.js`

- **Path**: `src/app/(site)/about/page.js`
- **Route**: `/about` (static; no params).
- **Purpose**: Company/product explainer — what GGFIX is, the three-sided product model (customer app / shop app / platform), the tech stack, the 12 backend services, four product principles, and "who it's for" (customers, shop owners, technicians).
- **Entry points**: `SITE_NAV` "About" link in `SiteHeader` (desktop nav row + mobile panel); `FOOTER_NAV` "About GGFIX" link in `SiteFooter`; `AccountSidebar` "About Us" link (on `/account/*` pages, out of scope but a real source); the "For shop owners"/"For technicians" cards in this very page link back out then further pages can return; also linked from `siteContent.js`'s search index concept indirectly through nothing extra found.
- **Exit points / navigation out**:
  - Hero: `CTA.forShops` button → `/shop`; `CTA.contact` button → `/contact`.
  - "Who it is for" cards → "For customers" → `/`; "For shop owners" → `/shop`; "For technicians" → `/shop` (same target as shop owners — see quirk below).
  - "Who it is for" section CTA → `CTA.startTrial` → `/contact`.
  - Closing `CTABand` — primary `CTA.contact` → `/contact`; secondary `CTA.seePricing` → `/pricing`.
- **Key UI sections** (render order): 1) Hero — headline/body from `ABOUT` + a brand card with `HERO_POINTS` checklist and `BRAND.appsStatus`. 2) `PLATFORM_FACTS` stat tiles + "A three-sided product" — `THREE_SIDES` feature cards (customer app / shop app / platform). 3) Dark "How the platform is built" — `STACK_LAYERS` (Mobile/Web/Backend) + a "12 backend services" panel listing `SERVICES`. 4) "What we believe" — 4 numbered `PRINCIPLES` cards. 5) "Who it is for" — `AUDIENCES` cards (customers/shop owners/technicians) + `CTA.startTrial` button. 6) Closing `CTABand`.
- **State & data**: No client state — entirely a server component rendering static arrays defined at module scope (`HERO_POINTS`, `THREE_SIDES`, `STACK_LAYERS`, `SERVICES`, `PRINCIPLES`, `AUDIENCES`) plus shared content from `siteContent.js` (`ABOUT`, `BRAND`, `CTA`, `PLATFORM_FACTS`).
- **API calls**: None — static content.
- **Notable quirks**: Both the "For shop owners" and "For technicians" audience cards point to the same `href: '/shop'` — there is no distinct technician-facing landing page, so the "See the technician view" link lands on the shop-owner marketing page instead.

---

## 3. Contact — `(site)/contact/page.js`

- **Path**: `src/app/(site)/contact/page.js` (plus its co-located client component `src/app/(site)/contact/EnquiryForm.js`)
- **Route**: `/contact` (static; the enquiry form section is anchored at `#enquiry`).
- **Purpose**: The site's universal contact/support hub and de facto "signup" destination — direct contact channels (call/WhatsApp/email/website), a routing guide for who should contact support, a client-side enquiry form that composes a mailto/WhatsApp handoff, common support topics, and a shop-owner pitch.
- **Entry points**: Reached from `SITE_NAV` "Contact" (header); `FOOTER_NAV` "Contact us"; and — because `CTA.getApp`, `CTA.startTrial`, `CTA.talkToSales`, and `CTA.contact` in `siteContent.js` **all** resolve to `href: '/contact'` — from nearly every "Get the app", "Start free trial", "Talk to sales", and "Contact us" button across the entire site (home, about, faq, pricing, shop, terms, privacy, nearby-shops). Also `AccountSidebar` "Customer Support" link (`/account/*`, out of scope).
- **Exit points / navigation out**:
  - Hero: "Call" button → `BRAND.phoneHref` (tel:, external); "Chat on WhatsApp" → `BRAND.whatsappHref` (external, new tab).
  - Channels grid (`CHANNELS`): Call (tel:), WhatsApp (external, new tab), Email (mailto:), Website (external, new tab).
  - `EnquiryForm` (client component) — on successful validation, shows a confirmation panel with "Open my email app" (`mailto:` built from form values) and "Send on WhatsApp" (`BRAND.whatsappHref?text=...`); no server submission occurs (see quirk).
  - "For shop owners" band: `CTA.forShops` → `/shop`; `CTA.seePricing` → `/pricing`.
- **Key UI sections** (render order): 1) Hero — heading + phone/WhatsApp buttons + a "Who is asking?" routing card (`ROUTING`: customers/shop owners/technicians). 2) "Four ways to reach us" — `CHANNELS` cards. 3) Enquiry form — a 3-step "how this form works" explainer + `<EnquiryForm />`. 4) "Most things are faster to fix in the app" — `SUPPORT_TOPICS` cards, each optionally annotated with an in-app answer (`IN_THE_APP`). 5) Dark "For shop owners" band with `PARTNER_BENEFITS` list.
- **State & data**: `EnquiryForm` (client component) holds local state: `values` (name/mobile/email/role/shopName/message), `errors`, `handoff` (the composed mailto/WhatsApp payload once submitted), plus `formRef`/`panelRef` for focus management. No context/global store; no cookies/localStorage.
- **API calls**: **None — this is explicitly a static site with no form backend.** `EnquiryForm.handleSubmit` only client-side validates and builds a `mailto:`/WhatsApp deep link (`buildHandoff`); nothing is POSTed anywhere. The page copy states this outright: "This site is a static export with no form inbox behind it."
- **Notable quirks**:
  - The "enquiry form" is not really a form submission — it's a message composer that hands off to the visitor's own email/WhatsApp app. This is the same pattern used by `BusinessRegister` (see §11), and both explicitly document why (no self-service backend exists).
  - Because `CTA.getApp`/`CTA.startTrial`/`CTA.talkToSales`/`CTA.contact` are all aliases for `/contact`, this page is the de facto single conversion funnel for the entire site — there is no distinct "sign up" or "start trial" page/flow anywhere.

---

## 4. FAQ — `(site)/faq/page.js`

- **Path**: `src/app/(site)/faq/page.js` (plus its co-located client component `src/app/(site)/faq/FaqAccordion.js`)
- **Route**: `/faq` (static; the accordion section is anchored at `#questions`).
- **Purpose**: Searchable/filterable FAQ hub covering customer and shop-owner questions, with three headline facts (15-day trial, ₹3,000/yr Basic plan, 20 km radius) and a "talk to a person" support band.
- **Entry points**: `SITE_NAV` "FAQ" (header); `FOOTER_NAV` "FAQ"; `AccountSidebar` "FAQ" (`/account/*`, out of scope); in-page links from `/` ("Read all N questions"), `/pricing` ("Read the full FAQ"), and `/terms` ("Read the FAQ"); also indexed by `SiteSearch`'s FAQ fallback entries (`href: '/faq'`).
- **Exit points / navigation out**:
  - `CTABand` on the dark "Still need help?" section → `CTA.contact` → `/contact`.
  - `SUPPORT_CHANNELS` list — call/email are `tel:`/`mailto:`; any web-based channel opens in a new tab.
  - Closing `CTABand` — primary `CTA.startTrial` → `/contact`; secondary `CTA.seePricing` → `/pricing`.
- **Key UI sections** (render order): 1) Header — heading + `QUICK_FACTS` (3 stat cards: 15-day trial / ₹3,000-yr / 20 km radius). 2) "Find your question" — `<FaqAccordion />`. 3) Dark "Still need help?" — `SUPPORT_TOPICS` cards + a `SUPPORT_CHANNELS` contact panel. 4) Closing `CTABand`.
- **State & data**: `FaqAccordion` (client component) holds: `activeFilter` (one of `all`/`customers`/`shops`/`pricing`/`security`), `query` (search text), `openId` (which single FAQ item is expanded — an accordion, not multi-open). Filtering and search run entirely client-side over the bundled `FAQS` array from `siteContent.js`; `pricing`/`security` filters are derived at runtime via regex over question text (`PRICING_RE`, `SECURITY_RE`), not pre-tagged in the data. No context/store/cookies.
- **API calls**: None — static content, client-side filtering only.
- **Notable quirks**: The "pricing" and "security" quick filters are computed by regex-matching each FAQ's *question* text at render time rather than being a data-level `category` field like `customers`/`shops` — documented in the source as deliberate ("additive, not a re-partition") since a question can belong to both an audience and a topic filter simultaneously.

---

## 5. Nearby Shops — `(site)/nearby-shops/page.js`

- **Path**: `src/app/(site)/nearby-shops/page.js` (server shell) + `src/app/(site)/nearby-shops/NearbyShops.js` (client component doing all the live work)
- **Route**: `/nearby-shops`. No URL query params are read; location comes from a shared client-side geo store (localStorage), not the URL.
- **Purpose**: A public shop directory/store-locator — lists GGFIX repair shops within a 20 km radius of the visitor's shared location (or the whole directory if no location is set / nothing is nearby), sorted by distance, each shown as a photo/address/timings card. Explicitly framed as "find a shop"; actual booking happens in the (not-yet-published) customer app.
- **Entry points**: `SITE_NAV` "Nearby Shops" (header); utility bar "Find nearby shops" link (`SiteHeader`, sm+ only); `FOOTER_NAV` "Shops near you"; `/repair` page's closing CTA ("Find a shop near you" button); `NearbyShops.js`'s own "No shops are listed yet" state links to `/shop` but does not link back to itself.
- **Exit points / navigation out**:
  - Each `ShopCard`: "Call Store" (`tel:`, only if the API/public-detail endpoint supplied a phone) and "Get Directions" (Google Maps deep link, external, built from the shop's lat/lng) and a small "open on map" icon link (same Maps URL, external).
  - Error state buttons: "Try again" (retries the fetch, no navigation) and "Contact us" → `/contact`.
  - Empty-within-radius state: "Show all shops instead" (in-page state toggle, no navigation) and "Contact us" → `/contact`.
  - Whole-directory-empty state: "GGFIX for shops" → `/shop`.
  - Closing `CTABand`: primary `CTA.getApp` → `/contact`; secondary `CTA.contact` → `/contact`.
- **Key UI sections** (render order): 1) Heading (`NEARBY.eyebrow`/`title`) + `<NearbyShops />` live list (skeleton loaders → shop card grid, column count scales 1–4 with result count, or an error/empty state panel). 2) "What you are looking at" — `WHAT_YOU_GET` cards explaining the directory is deliberately thin (no ratings/reviews) + a "Private" badge note about location handling. 3) Closing `CTABand`.
- **State & data**: `NearbyShops` (client) state: `geo`/`hydrated` (read from `geo.js`'s localStorage-backed store, seeded null then hydrated post-mount to avoid SSR mismatch), `status` (`loading`/`ready`/`error`), `shops`, `mode` (`all`/`nearby`), `errorKind` (`network`/`mixed-content`), `showAllAnyway`, `retryCount`. Subscribes to the shared `geo.js` event bus (`subscribe()`) so setting a location in the header's `LocationControl` live-updates this page with no reload/navigation. Location itself lives in `localStorage` key `ggfix_geo`, never in the URL.
- **API calls**:
  - `GET {SHOP_BASE}/shops/nearby?lat=&lng=&radiusKm=20` (when a location is set) or `GET {SHOP_BASE}/shops` (no location, or "show all anyway") — fired via a plain `fetch` (not `shopApi`), on mount and whenever the location/mode changes.
  - `GET {AUTH_BASE}/auth/shops/{id}/public` — one call per shop, in parallel, fired right after the list resolves, to enrich each card with photo/phone/fuller address (fields the list endpoint doesn't return). Never throws; failures just leave that card with list-only fields.
  - Both calls use `credentials: 'omit'` and no Authorization header, deliberately bypassing the shared `shopApi` helper — documented as a fix for a real bug (see quirk).
- **Notable quirks**:
  - Source comments document a real bug workaround: using `shopApi.get(path, { skipAuthRedirect: true })` here would have silently dropped the options argument (since `src/lib/api.js`'s `shopApi.get` is single-arg), causing a stale `admin_token` in localStorage to redirect a public visitor to `/management` on a 401/403 — even though this page needs no auth at all. The fix was to call `fetch` directly with no credentials.
  - The list API (`/shops`, `/shops/nearby`) is deliberately sparse — no ratings, phone, or photo — and the code explicitly refuses to fabricate any of those fields; it only renders phone/photo/timings when a value is actually present, sourced from the separate public-detail endpoint.
  - Detects and messages "mixed content" blocking specifically (HTTPS page calling an HTTP-only shop backend) rather than presenting a generic error.

---

## 6. Pricing — `(site)/pricing/page.js`

- **Path**: `src/app/(site)/pricing/page.js`
- **Route**: `/pricing` (static; in-page anchors `#plans`, `#multi-shop`, `#compare`, `#billing`, `#pricing-faq`).
- **Purpose**: Shop-owner pricing page — the Free Trial vs. Basic plan comparison, the multi-shop discount table, a feature-comparison table, an explanation of manual (non-online) billing, and a pricing-specific FAQ subset.
- **Entry points**: `SITE_NAV`/`FOOTER_NAV` "Pricing"; `CTA.seePricing` buttons used throughout `/about`, `/contact`, `/faq`, `/shop`, `/terms`; `SiteSearch`'s bundled index does not include it directly (only categories/FAQs), but it's reachable via every "See pricing"/"See the full comparison" button site-wide.
- **Exit points / navigation out**:
  - Header: `CTA.startTrial` → `/contact`; `CTA.talkToSales` → `/contact`.
  - Each `PlanCard`: `CTA.startTrial` button → `/contact`.
  - Billing section: `CTA.talkToSales` → `/contact`; WhatsApp button → `BRAND.whatsappHref` (external).
  - Pricing FAQ footer: "Read the full FAQ" → `/faq`.
  - Closing `CTABand`: primary `CTA.startTrial` → `/contact`; secondary `CTA.talkToSales` → `/contact`.
- **Key UI sections** (render order): 1) Header — `HEADLINE_FACTS` stat tiles (15-day trial / ₹3,000 / ₹2,500) + CTA buttons. 2) "Two plans" — side-by-side `PlanCard`s for Free Trial and Basic (from `PLANS`), each showing bullets, exclusions, and "actual limits". 3) Multi-shop pricing table (`MULTI_SHOP_PRICING`) — stacked cards on mobile, a real `<table>` from `sm:` up. 4) Feature-comparison table (`PLAN_COMPARISON`) — tick/cross/"text" cells via `ComparisonCell`. 5) Dark "How activation works" — billing honesty copy (`BILLING_POINTS`) + contact CTAs. 6) Pricing FAQ — a curated subset of `FAQS` pulled by exact question-string match (`findFaq`), plus two hand-written FAQ entries not in the shared `FAQS` array. 7) Closing `CTABand`.
- **State & data**: No client component here — fully server-rendered/static. All figures come from `siteContent.js` (`PLANS`, `MULTI_SHOP_PRICING`, `PLAN_COMPARISON`, `PRICING_NOTE`, `FAQS`).
- **API calls**: None — static content.
- **Notable quirks**:
  - Two of the six `PRICING_FAQS` entries are hardcoded inline in `page.js` rather than sourced from the shared `FAQS` array (via `findFaq`), meaning those two answers exist in exactly one place and could drift from the main `/faq` page's wording if `/faq` is ever regenerated from `FAQS` alone. One of them, "What happens when the 15 days are up?", does not appear on `/faq` at all.
  - Repeatedly and explicitly states there is no online payment gateway — pricing activation is entirely manual/human, reinforcing that `/contact` is the only real conversion path (see the Contact page notes).

---

## 7. Privacy — `(site)/privacy/page.js`

- **Path**: `src/app/(site)/privacy/page.js`
- **Route**: `/privacy` (static; the full-policy body has 16 clause anchors, e.g. `#who-we-are`, `#location`, `#app-lock`, driven by the `SECTIONS` array).
- **Purpose**: The platform's Privacy Policy — data categories collected, three explicit "we will not do this" promises, and 16 numbered legal clauses (scope, collection, usage, sharing, location, photos/audio, biometric App Lock, auth, employee attendance geofencing, retention, rights, children, security, changes, contact).
- **Entry points**: `FOOTER_NAV` "Privacy Policy" (footer legal row, and also under the "Legal" column); linked from `/terms` ("Please read our Privacy Policy as well"), from `EnquiryForm`/`BusinessRegister` consent checkboxes ("Privacy Policy" link), and from `LoginModal`'s consent checkbox.
- **Exit points / navigation out**:
  - In-page TOC (`SECTIONS`) — anchor jumps only, no page navigation.
  - Body text link: "Terms of Service" → `/terms` (inline, clause 2).
  - Closing sections: `SUPPORT_CHANNELS` cards (`tel:`/`mailto:`/external website link) and a `CTABand` — primary `CTA.contact` → `/contact`; secondary → `/terms` (inline `{ label: 'Terms of Service', href: '/terms' }`).
- **Key UI sections** (render order): 1) Hero — badge + heading + `LEGAL_UPDATED` date. 2) "The ten things GGFIX collects" — `DATA_CATEGORIES` cards. 3) Dark "Three things we will not do" — `PROMISES` cards (biometric data never leaves device / no background location / we don't sell data). 4) Full policy — sticky TOC nav (`SECTIONS`) + `<Prose>` body with 16 numbered `PolicySection`s. 5) Contact channels grid + closing `CTABand`.
- **State & data**: No client state — a fully static/server-rendered page built from `siteContent.js` (`BRAND`, `LEGAL_UPDATED`, `SUPPORT_CHANNELS`) plus inline JSX content for the clauses themselves.
- **API calls**: None — static content.
- **Notable quirks**: The policy explicitly documents a real third-party data flow that's easy to miss: the site's `LocationControl` sends the visitor's raw coordinates to BigDataCloud (a third-party reverse-geocoding service) for the "Set location" navbar feature — disclosed here in clause 6, with a note that this specific page's disclosure must be kept in sync if that geocoding call is ever changed or removed.

---

## 8. Repair — `(site)/repair/page.js`

- **Path**: `src/app/(site)/repair/page.js`, backed by `src/components/site/RepairFlow.js` (the multi-step device/service/booking wizard, ~2,900 lines), `src/components/site/RepairBreadcrumb.js`, `src/components/site/RepairExtras.js`, `src/components/site/HeroCarousel.js`, `src/components/site/StoreBadges.js`, and (deeper in the flow) `src/components/site/LoginModal.js`.
- **Route**: `/repair` (also written `/repair/` — trailing slash). Entirely query-param driven, no path segments: `?category=`, `&brand=`, `&brandName=`, `&model=`, `&modelName=`, then a booking chain of `&service=1`, `&report=1&services=<ids>`, `&options=1`, `&shops=1&via=pickup|walkin`, `&shop=<id>`, `&address=1`, `&addr=<id>&slot=1`, `&date=&start=&end=`, `&review=1`. Every step transition is a `<Link>` so Back/forward and shareable URLs work.
- **Purpose**: A public, no-login-required "pick your device" wizard (Category → Brand → Product) mirroring the customer app's device picker, that — once a customer logs in via OTP — extends into a full repair-service selection, condition report (with photo upload), shop selection, address, pickup-slot, and review/booking-confirmation flow. Booking is fully functional against live backend services (not just a lead-gen form, unlike Contact/BusinessRegister).
- **Entry points**: `SITE_NAV` "Repair" (rendered as `RepairNavMenu`, a hover/click dropdown of device categories, each deep-linking to `/repair?category=<code>`); the "Our Services" grid's "Repair" card on `/`; `HOME_MENU_GROUPS`'s repair entry (`href: '/repair'`); `SiteSearch`'s bundled category index entries actually point to `/#repair` (home page anchor), not `/repair` — see quirk.
- **Exit points / navigation out**:
  - Category/Brand/Product steps: each tile is a `<Link scroll={false}>` advancing the URL to the next step (never `router.push`).
  - Service step ("Select a repair service"): "Continue" gates on `isLoggedIn()` — if signed out, opens `<LoginModal>`; on success (or if already logged in) calls `router.push(reportHref)`.
  - Deeper booking-chain steps (address/slot/review) use `router.push` to advance (see API calls below for what each step also does over the network).
  - Closing CTA (category step only, via `RepairExtras`): "Find a shop near you" → `/nearby-shops`.
  - `EmptyState` panels (e.g. no brands/products/services available) → "Continue in the GGFIX app" → `/contact`.
- **Key UI sections** (render order): 1) Breadcrumb (`<RepairBreadcrumb>`, wrapped in `Suspense`) — single unified trail, e.g. Home › Repair › Categories › Mobile › iPhone 15 › …, growing with the URL. 2) Hero banner (`<HeroCarousel title="Repair">`) — shown only on the bare category step (hidden by `<RepairExtras>` once `?category=` is set). 3) `<RepairFlow>` — the step body itself: Category grid → Brand grid → Product grid → Device summary → Repair-service accordion (login-gated) → View Report (device + services + front/back photo upload) → Service Options → Choose Shop → Shop Detail → Address → Slot → Review/Confirm. 4) "How a repair works" + closing CTA band (category step only, via `RepairExtras`) — same `REPAIR_STEPS`/`TICKET_LIFECYCLE` content as the home page's `#repair` section, kept intentionally in sync.
- **State & data**: All wizard state lives in the URL query string (read via `useSearchParams`), not React state — deliberate, for shareable/back-button-correct steps. Local component state layered on top: `categories`/`idByCode` (seeded from bundled `DEVICE_CATEGORIES`, refreshed from master-data), `brands`, `allModels`/`series` (fetched per category+brand), `q` (search filter) and `selSeriesId` (reset on category/brand change), `selected` services (a `Set`, in `ServiceStep`), `photos` (front/back upload state, persisted to `sessionStorage` keyed by model id via `savePhotos`/`readPhotos` in `repairBooking.js` — so it survives step navigation but not a closed tab), `addresses`/selection (in `AddressStep`), pickup slot fields (`date`/`start`/`end`, in `SlotStep`). Reads `isLoggedIn()`/`readCustomer()` from `src/lib/customerAuth.js` (localStorage-backed) to gate the service step and to attach a Bearer token to authenticated calls. Also reads/writes shared `geo.js` location state during the shop-selection steps.
- **API calls** (extensive — this is the most functionally "real" page in the public site):
  - `GET /master/device-categories`, `GET /master/categories/by-code/{code}/brands`, `GET /master/brands/{brandId}/models`, `GET /master/categories/by-code/{code}/brands/{brandId}/series` (all via `masterApi`) — device picker steps.
  - `GET /master/repair-services`, `GET /master/repair-categories` (via `masterApi`) — service-selection step.
  - `POST {MEDIA_UPLOAD_URL}` (multipart, Bearer token) — device front/back photo upload in the Report step.
  - `GET {AUTH_BASE}/auth/shops/{id}/public`, `GET {SHOP_BASE}/shops/{id}` (plain `fetch`) — shop detail step.
  - `GET {SHOP_BASE}/shops/{id}/pickup-slots` (`getPickupSlots`, public) — slot step.
  - `GET {USER_BASE}/customer/addresses` / `POST {USER_BASE}/customer/addresses` (`listAddresses`/`createAddress`, Bearer) — address step.
  - `POST {ORDER_BASE}/repair-bookings` (`createRepairBooking`, Bearer) — final booking submission on Review/Confirm.
- **Notable quirks**:
  - This is the only public-site page with a real, working, authenticated write path (address creation and booking creation) — everything else that looks like a "submit" elsewhere on the site (Contact's enquiry form, Business Register) is actually a client-side mailto/WhatsApp composer with no backend call.
  - `SiteSearch`'s bundled category index (`fallbackIndex()` in `SiteSearch.js`) links device categories to `/#repair` (the home page's anchor section) rather than to `/repair?category=...` — an inconsistency with `RepairNavMenu`, which correctly deep-links into the wizard's actual category step.
  - Colour-name-to-hex resolution (`colorHex`/`COLOR_WORDS`/`DEVICE_COLORS`) is a substantial piece of bespoke logic just to render a coloured dot next to marketing colour names like "Diamond Black" — generated from the same color-name list the mobile app uses, with a hand-maintained fallback word list for anything the generated map misses.

---

## 9. Shop (For Shops) — `(site)/shop/page.js`

- **Path**: `src/app/(site)/shop/page.js`
- **Route**: `/shop` (static; in-page anchors `#free-trial`, `#features`, `#pipeline`, `#intake`, `#growth`, `#pricing`, `#getting-started`).
- **Purpose**: The B2B landing page pitching the shop-owner app — free trial terms, the 12 shop-app capability groups, the 6-stage ticket lifecycle, the intake wizard, pickup/marketplace growth features, a pricing snapshot, and a 5-step "getting started" guide.
- **Entry points**: `SITE_NAV`/`FOOTER_NAV` "For Shops"; `CTA.forShops` buttons used on `/`, `/about` (twice — once for "shop owners", once mistakenly for "technicians"), `/contact`; the utility-bar has no direct link but `SiteHeader`'s "Business Login" (`CTA.businessLogin`) goes to `/shopmanagement`, a separate door, not this marketing page.
- **Exit points / navigation out**:
  - Hero: `CTA.startTrial` → `/contact`; `CTA.seePricing` → `/pricing`.
  - Free-trial section: `CTA.startTrial` → `/contact`; `CTA.talkToSales` (ghost button) → `/contact`.
  - Pricing snapshot: each `PlanCard`-equivalent's `plan.cta` button → `/contact` (both plans' CTAs resolve to `/contact` per `PLANS` data); "See the full comparison" → `/pricing`; "Talk to sales" → `/contact`.
  - Getting-started section: plain `mailto:` link (`BRAND.emailHref`), no page link.
  - Closing `CTABand`: primary `CTA.startTrial` → `/contact`; secondary `CTA.talkToSales` → `/contact`.
- **Key UI sections** (render order): 1) Hero — headline + `PARTNER_BENEFITS` checklist + a static "shop app sketch" mock panel (`SHOP_DASHBOARD_STATS`, `SHOP_QUICK_ACTIONS`, `SHOP_TABS` — illustrative only, no live data). 2) Free-trial callout — `TRIAL_POINTS` cards + `SHOP_FACTS` stat tiles. 3) "Everything in one app" — `SHOP_FEATURES` cards (12 capability groups). 4) Dark "booking pipeline" — `TICKET_LIFECYCLE` stages + a "Work Pending" side-note badge. 5) "Intake in under a minute" — `INTAKE_STEPS` (9-step New Booking wizard walkthrough). 6) "Grow with pickup + marketplace" — `GROWTH_CARDS` (pickup jobs / sell quotations / marketplace-inventory). 7) Pricing snapshot — `PLANS` cards + `MULTI_SHOP_PRICING` mini-table. 8) "Getting started" — `GETTING_STARTED` 5-step list + a KYC-documents note. 9) Closing `CTABand`.
- **State & data**: No client component — fully static/server-rendered from `siteContent.js` (`PLANS`, `MULTI_SHOP_PRICING`, `PARTNER_BENEFITS`, `PRICING_NOTE`, `SHOP_DASHBOARD_STATS`, `SHOP_FEATURES`, `SHOP_QUICK_ACTIONS`, `SHOP_TABS`, `TICKET_LIFECYCLE`) plus page-local constants (`SHOP_FACTS`, `TRIAL_POINTS`, `INTAKE_STEPS`, `GROWTH_CARDS`, `GETTING_STARTED`).
- **API calls**: None — static content.
- **Notable quirks**: The "shop app sketch" hero panel is explicitly commented as "labels only, no invented numbers" — the stat tiles show label/hint text, not real dashboard figures, to avoid implying live data on a marketing mockup. `SHOP_FACTS` is a third, page-specific stats dataset (distinct from both `PLATFORM_FACTS` on `/about` and `CUSTOMER_FACTS` on `/`), per the same "don't imply the wrong audience" reasoning documented in its source comment.

---

## 10. Terms — `(site)/terms/page.js`

- **Path**: `src/app/(site)/terms/page.js`
- **Route**: `/terms` (static; 18 clause anchors driven by `SECTIONS`, e.g. `#acceptance`, `#quotations`, `#subscriptions`, `#kyc`, `#liability`, `#governing-law`).
- **Purpose**: Terms & Conditions covering accounts, customer/shop responsibilities, quotations, device data/backup, device-security PINs, doorstep pickup, selling/buying, shop subscriptions & billing, KYC, acceptable use, IP, liability limits, and governing law.
- **Entry points**: `FOOTER_NAV` "Terms of Service" (legal row + Legal column); `AccountSidebar` "Terms & Conditions" (`/account/*`, out of scope); linked inline from `/privacy` ("Terms of Service"), and from consent checkboxes in `EnquiryForm`, `BusinessRegister`, and `LoginModal`.
- **Exit points / navigation out**:
  - In-page TOC (`SECTIONS`) — anchor jumps only.
  - Body text links: `/contact` (contact page), `/privacy` (Privacy Policy) — both inline in the final clause.
  - Dark "Talk to us before you sign anything" band: `CTA.contact` → `/contact`; "Read the FAQ" → `/faq`.
  - Closing `CTABand`: primary `CTA.startTrial` → `/contact`; secondary `CTA.seePricing` → `/pricing`.
- **Key UI sections** (render order): 1) Hero — heading + `LEGAL_UPDATED` badge, section-count badge, "Governed by Indian law" badge, and a "this is a general template" warning callout. 2) "In plain English" — `SUMMARY` (4 cards: platform-not-repairer, estimates-are-estimates, back-up-your-phone, shops-subscribe-customers-dont). 3) Sticky TOC + `<Prose>` body with 18 numbered clauses (`Clause` component keyed off `SECTIONS`/`INDEX`). 4) Dark contact band — `CONTACT_TILES` (email/phone/WhatsApp) + 3 small assurance chips. 5) Closing `CTABand`.
- **State & data**: No client state — fully static/server-rendered. Content from `siteContent.js` (`BRAND`, `CTA`, `LEGAL_UPDATED`) plus page-local constants (`SECTIONS`, `INDEX`, `SUMMARY`, `CONTACT_TILES`) and inline JSX for every clause body.
- **API calls**: None — static content.
- **Notable quirks**: A source comment on the dark band's secondary button flags a real, deliberate-but-imperfect styling bug: a `variant="ghost"` override plus a `text-white` className loses the cascade fight against later-emitted `.text-brand-700`/`.hover\:bg-brand-soft` utility classes, so the button renders low-contrast brand-on-dark (~1.6:1) instead of white-on-dark — noted as "the same transparent-on-dark pattern as the secondary buttons on /pricing and /contact," i.e. a known, repeated visual defect across at least three pages.

---

## 11. Business Register — `business/register/page.js`

- **Path**: `src/app/business/register/page.js`, rendering `src/components/site/BusinessRegister.js` (client component).
- **Route**: `/business/register`. Deliberately placed **outside** the `(site)` route group — it has its own slim custom header (logo + location control + "Business Login" link) rather than the shared `SiteHeader`/`SiteFooter` chrome, to avoid double-wrapping.
- **Purpose**: A shop-owner "sign-up interest" capture form. Collects only a 10-digit mobile number, validates it, and — because there is no self-service shop-registration backend endpoint anywhere in the codebase — composes a mailto:/WhatsApp handoff message (to `BRAND.email`/WhatsApp) asking the GGFIX team to follow up and complete onboarding manually (KYC, shop details, bank account). The benefits/requirements panels next to the form are informational only; none of those fields are actually collected or submitted.
- **Entry points**: The only real path in from the public site is indirect: `SiteHeader`'s "Business Login" (`CTA.businessLogin.href = '/shopmanagement'`) → the shop-owner login page renders `shoplogin.js`, whose "Register your business" link (`<Link href="/business/register">`) is the sole `<Link>`/`href` reference to this route anywhere in `src/`. No page in the `(site)` route group (home, about, shop, pricing, etc.) links here directly — a visitor only reaches it by first opening the Business Login screen and clicking through.
- **Exit points / navigation out**:
  - Header: logo → `/`; "Business Login" → `/shopmanagement`.
  - On submit (valid 10-digit mobile): shows a confirmation panel with "Open my email app" (`mailto:` built by `buildHandoff`) and "Send on WhatsApp" (`BRAND.whatsappHref?text=...`) — both external handoffs, no server call. "Edit mobile number" resets back to the form (no navigation).
  - Footer consent text: "Terms & Conditions" → `/terms`; "Privacy Policy" → `/privacy`.
- **Key UI sections** (render order): 1) Slim custom header (logo, `LocationControl` on sm+, "Business Login" link). 2) Left column — heading + mobile-number form card (or, post-submit, the confirmation/handoff panel). 3) Right column — `BENEFITS` cards (4: customers reach, pan-India, sell & manage, repair services), then "Everything you need to start" — `REQUIREMENTS` groups (business details, identity verification, bank account, shop information) presented as informational checklist only, plus a custom inline SVG illustration (`BusinessIllustration`).
- **State & data**: Local component state only: `mobile`, `error`, `handoff` (the composed mailto/WhatsApp payload once submitted). No context/store; no cookies/localStorage; no URL params read.
- **API calls**: **None.** Exactly like the Contact page's enquiry form, this validates client-side and builds `mailto:`/WhatsApp links — nothing is POSTed to any backend. The extensive source-code comment block at the top of `BusinessRegister.js` explains this explicitly: the only real account-creation endpoint in the codebase (`POST /auth/shop-owner`) is staff-authenticated (used by the management portal's "new owner" screen), not public, so building a working OTP/verification flow here would mean fabricating a nonexistent backend.
- **Notable quirks**:
  - This page has effectively no discoverable entry point from the marketing site itself — it is reachable only by drilling into Business Login (`/shopmanagement`) first. A visitor following the normal "For Shops" → pricing/about/contact → "Start free trial" path never lands here at all; that path always terminates at `/contact` instead (see §3, §6, §9).
  - Despite the page/route implying self-service "create your business account," the form neither creates an account nor verifies the phone number — it is a lead-capture form with the same mailto/WhatsApp-handoff mechanism as `/contact`'s `EnquiryForm`, just narrower (mobile number only).
