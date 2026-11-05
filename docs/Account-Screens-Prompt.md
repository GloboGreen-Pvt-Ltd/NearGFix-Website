# Customer Account Screens — Current-State Spec (GGFIX-Client)

This documents the customer-facing account portal (`src/app/(site)/account/**`) as currently built, as of 2026-09-10. Reference/handoff spec — not a redesign proposal.

## Contents

1. [Account layout (`account/layout.js`)](#account-layout-accountlayoutjs)
2. [AccountPage (`account/page.js`)](#accountpage-accountpagejs)
3. [AccountProfilePage (`account/profile/page.js`)](#accountprofilepage-accountprofilepagejs)
4. [MyOrdersPage / OrdersExperience (`account/orders/page.js`)](#myorderspage--ordersexperience-accountordersspagejs)
5. [MyCartPage (`account/cart/page.js`)](#mycartpage-accountcartpagejs)
6. [ManageDevicePage (`account/devices/page.js`)](#managedevicepage-accountdevicespagejs)
7. [ManageAddressPage (`account/addresses/page.js`)](#manageaddresspage-accountaddressespagejs)

No `[id]`/`[...slug]` dynamic sub-routes exist under `account/**` — a directory scan (`Glob` for `[[]*[]]` folders) turned up nothing, and the order-detail experience is a client-side drawer/modal inside `/account/orders` rather than its own route.

---

## Account layout (`account/layout.js`)

- **Path**: `src/app/(site)/account/layout.js`
- **Route**: applies to every route under `/account/**`; no params of its own.
- **Purpose**: Route-guards the whole account area on a customer session (localStorage-backed, read via `@/lib/customerAuth`) and renders the persistent two-column shell (left `AccountSidebar` + page content) once signed in.
- **Entry points**: Not directly linked to (it's a layout, not a page) — it wraps every account page listed below.
- **Exit points / navigation out**: None itself; delegates to `AccountSidebar` (nav links, logout) and `AccountGate` (opens `LoginModal`).
- **Key UI sections**, in render order:
  1. Pre-mount loader (`Loader2` spinner, centered) — shown until the first client-side effect runs, since server render cannot see localStorage.
  2. If no `customer` after mount → `<AccountGate />` (full sign-in prompt, replaces the whole area — no sidebar).
  3. If signed in → `Section`/`Container` grid: `AccountSidebar` (left rail, sticky on `lg+`) + `{children}` (the active account page) in a `16rem_1fr` grid.
- **State & data**:
  - `mounted` (bool) and `customer` (object|null) — both local `useState`.
  - Reads session via `readCustomer()` from `@/lib/customerAuth` (localStorage keys `ggfix_customer_token` / `ggfix_customer`).
  - Subscribes to `subscribe()` (a `window` `CustomEvent('ggfix:customer')` + `storage` event listener) so login/logout from the header, `AccountGate`, another tab, or the sidebar's "Log out" button all re-render this layout without a page reload.
- **API calls**: None directly — session is purely a local-storage read, no network round-trip in the layout itself.
- **Notable quirks**:
  - This is a **client-only auth guard** — there's no middleware/server-side redirect. A user can technically see the pre-mount loader flash before the gate/content resolves, and a determined user with JS disabled would see nothing render at all past the loader.
  - The comment block documents the hydration-mismatch reasoning explicitly: the "before mount" branch exists purely so SSR output matches first client render.
  - Children pages don't receive `customer` as a prop; each page independently calls `readCustomer()`/`getCustomerProfile()` etc. for anything session-related, which duplicates the read but keeps pages decoupled from the layout.

---

## AccountPage (`account/page.js`)

- **Path**: `src/app/(site)/account/page.js`
- **Route**: `/account` (no params).
- **Purpose**: Pure compatibility redirect — the account "landing" action is Personal Information, so `/account` immediately forwards there. Exists only for older links that point at the bare `/account` path.
- **Entry points**: Grepped the whole `src/` tree for literal `/account` (not `/account/...`) hrefs/pushes — none found. Nothing in this codebase currently links to bare `/account`; the header, sidebar, and cart/order flows all target the specific sub-routes directly (`/account/profile`, `/account/orders`, etc.). This route is a safety net for external/legacy links, not an internal navigation target.
- **Exit points / navigation out**: `router.replace('/account/profile')` inside a `useEffect`, unconditionally, on every mount.
- **Key UI sections**: A single centered `Loader2` spinner (`aria-label="Opening personal information"`) shown for the instant before the replace fires.
- **State & data**: None beyond the `useRouter()` instance.
- **API calls**: None.
- **Notable quirks**:
  - Uses `router.replace` (not `push`) specifically so `/account` doesn't linger in browser history — confirmed by reading the code (no back-button trap back to the loader).
  - Because this redirect fires from the child, it runs *after* `AccountLayout` has already resolved the auth gate/sidebar for `/account` — so a signed-out visitor to `/account` briefly sees the `AccountGate` (or its own loader) before ever reaching this component's effect, since the layout gate mounts first.

---

## AccountProfilePage (`account/profile/page.js`)

- **Path**: `src/app/(site)/account/profile/page.js`
- **Route**: `/account/profile` (no path/query params read).
- **Purpose**: "Personal Information" screen — view and edit the signed-in customer's name, email, mobile, alternate mobile, and avatar. This is the account area's de facto landing page (both `/account` and the header's "My Account" link point here).
- **Entry points**:
  - `src/app/(site)/account/page.js` — `router.replace('/account/profile')`, unconditional redirect.
  - `src/components/site/HeaderAccount.js` line 137 — icon-variant header control, `<Link href="/account/profile">` shown when signed in (avatar button).
  - `src/components/site/HeaderAccount.js` line 50 (`MENU_LINKS`) — "My Account" entry in both the desktop dropdown and mobile disclosure menu.
  - `src/components/site/account/AccountSidebar.js` line 40 (`NAV`) — "Personal Information" sidebar link, present on every account page.
- **Exit points / navigation out**: None — this page has no outbound navigation; "Cancel editing" just resets local form state, it doesn't route anywhere.
- **Key UI sections**, in render order:
  1. `AccountPageHeader` — eyebrow "My Account", title "Personal Information", right-aligned "Edit details"/"Cancel editing" toggle button.
  2. Inline `AccountError` banner (only when an error exists and the form is *not* in edit mode).
  3. `Panel` containing:
     - Header strip: `ProfileAvatar` (image or initials), name + "Verified customer" badge, hidden file `<input>` + "Upload/Change avatar" button (disabled while uploading).
     - `<form>`: success `notice` banner, inline `error` banner (edit mode), then a 2-column grid of `Field`s — First Name, Last Name, Email, Mobile, Alternate Mobile (all read-only unless `editing`).
     - "Save Changes"/"Cancel" buttons, shown only while editing.
- **State & data**:
  - Local: `form`, `savedForm`, `loading`, `editing`, `saving`, `avatarUploading`, `error`, `notice`, plus an `inputRef` for the hidden file input.
  - Reads `readCustomer()` (session) as a fallback/seed while `getCustomerProfile()` loads live data; on success calls `updateCustomerSession(live)` to heal the stored session (keeps header/sidebar name+avatar in sync).
  - No redux/zustand — state is entirely local `useState` plus the shared `customerAuth` module as the session source of truth.
- **API calls** (all via `@/lib/customerAccount`, Bearer auth attached automatically):
  - `GET {USER_BASE}/customer/profile` (`getCustomerProfile()`) — on mount, via `load()`.
  - `PUT {USER_BASE}/customer/profile` (`updateCustomerProfile()`) — on Save, with `{ fullName, email, mobile, alternateMobile, profileImageUrl }`.
  - Avatar upload: `POST {MEDIA_UPLOAD_URL}` (`uploadCustomerAvatar()`, `multipart/form-data` with `folder: 'customers/avatars'`) — fires as soon as a valid file is chosen, independent of Save; only the returned HTTPS URL is staged into `form.profileImageUrl` until Save persists it.
  - Auth: every one of these helpers reads `readCustomer().token` and sends `Authorization: Bearer <token>` (see `authHeaders()` in `customerAccount.js`); no cookies are used (`credentials: 'omit'` on every fetch).
- **Notable quirks**:
  - Avatar upload and profile save are **two independent network round-trips** — uploading an avatar does not save the profile; the user must also click "Save Changes" (a `notice` message explicitly tells them this: "Avatar uploaded. Save changes to apply it to your profile.").
  - Mobile number normalization silently strips a leading country code: `digitsOnly()` will convert a pasted `+91 98765 43210` down to the bare 10-digit form, but only when it detects exactly 12 digits starting with `91` — a 12-digit number starting with anything else is left as invalid-length and rejected by validation.
  - If the live profile fetch fails, the form still renders using only the locally-cached session (`fallback`), so the page always looks "usable" even when the backend is down — but an error banner is shown alongside stale data rather than blocking the view.

---

## MyOrdersPage / OrdersExperience (`account/orders/page.js`)

- **Path**: `src/app/(site)/account/orders/page.js` (thin wrapper) + `src/components/site/account/OrdersExperience.js` (all real logic/UI, ~1500 lines).
- **Route**: `/account/orders` (no URL params/query — tab and status filters are pure client state, not reflected in the URL).
- **Purpose**: Unified "My Orders" experience across five order kinds (Service/Repair, Pickup, Buy, Sell, Enquiry): list + filter orders, then drill into a detail drawer with type-specific views (booking details, service-ticket details, sell-request details, generic order, live timeline, receipt, tax invoice, pickup reschedule).
- **Entry points**:
  - `src/components/site/SiteHeader.js` line 308 — "Track Order" link in the thin top utility bar (`<Link href="/account/orders">`).
  - `src/components/site/SiteHeader.js` line 401 — desktop "Orders" icon shortcut (`Package` icon) next to the cart icon, `lg+` only.
  - `src/components/site/HeaderAccount.js` line 51 (`MENU_LINKS`) — "My Orders" entry in the account dropdown/mobile menu.
  - `src/components/site/account/AccountSidebar.js` line 41 (`NAV`) — "My Orders" sidebar link.
  - `src/app/(site)/account/cart/page.js` line 238 — "View my orders" button (`<Button href="/account/orders">`) shown on the post-checkout confirmation screen.
- **Exit points / navigation out**: None internal to the page other than the entry points above being bidirectional links; all "navigation" within this experience (opening a drawer, switching detail views, re-scheduling) is in-page state, not route changes. External links: `MediaStrip` photo thumbnails open the raw photo/video URL in a new tab (`target="_blank"`).
- **Key UI sections**, in render order:
  1. `AccountPageHeader` — "My Orders" / "Bookings & purchases".
  2. Type tabs (`Chip` row): Service, Pickup, Buy, Sell, Enquiry — each maps to one or more `orderType` values.
  3. Status filter pills: Active (`Pending`), Completed, Cancelled.
  4. List body: `AccountLoader` / `AccountError` / `AccountEmpty` / grid of `OrderCard`s (image-or-icon, title, order#, spec line, status pill, booked-services preview, shop name, amount + date, and type-specific action-button row: Details/History/Reschedule/Receipt/Invoice, or a Sell "View sell request" affordance).
  5. `OrderDrawer` (slide-in panel, `role="dialog"`) opened by clicking a card — renders one of: `BookingDetails`, `TicketDetails`, `SellDetails`, `GenericDetails`, `Timeline`, `ReceiptView`, `Invoice`, or `Reschedule`, plus a footer action bar (View details / Track / Receipt / Invoice / Re-schedule / Refresh).
- **State & data**:
  - Local state: `tab`, `status`, `orders`, `details` (map of enriched per-order data keyed by id), `loading`, `error`, `reloadKey`, `selected` (the open drawer's order+view+data), `saving`.
  - Caching refs (not state, to survive re-renders without re-fetching): `masterCache`, `modelsByBrand`, `shopCache`, `addressCache`, `resourceCache`, `selectionId` (a monotonically increasing guard against out-of-order async responses when the user clicks between orders quickly).
  - No redux/zustand/context; auth comes from `customerAuth` indirectly through the `customerAccount.js` helpers.
- **API calls** (all Bearer-authenticated via `customerAccount.js`, plus `masterApi` from `@/lib/api.js` which is **unauthenticated** master-data):
  - `GET {ORDER_BASE}/customer-orders?orderType=&status=` (`listMyOrders`) — once per tab/status change, one call per `orderType` in the active tab's `types` array, deduped and merged client-side.
  - Per-order enrichment, only the one matching the order's kind:
    - `GET {ORDER_BASE}/repair-bookings/{id}` (`getRepairBooking`) for repair/pickup orders.
    - `GET {ORDER_BASE}/sell-orders/{id}` (`getSellOrder`) for sell orders.
    - `GET {TICKET_BASE}/tickets/customer/{id}` (`getServiceTicket`) for shop-ticket-backed orders.
  - `GET {AUTH_BASE}/auth/shops/{shopId}/public` (`getShopPublic`) — shop identity, cached per shop id, **not** Bearer-authenticated (public endpoint, plain fetch).
  - `GET {USER_BASE}/customer/addresses` (`listAddresses`) — only when opening a drawer that needs `includeAddress`, cached once for the whole session.
  - `masterApi.get('/master/brands')`, `/master/ram-options`, `/master/storage-options`, `/master/brands/{id}/models` — unauthenticated master-data lookups used purely to resolve device name/spec labels for display.
  - `POST {ORDER_BASE}/repair-bookings/{id}/reschedule` (`rescheduleRepairBooking`) — on "Confirm re-schedule".
  - `POST {ORDER_BASE}/sell-orders/{id}/cancel` (`cancelSellOrder`) — on "Cancel sell request" (after a `window.confirm`).
  - `GET {SHOP_BASE}/shops/{shopId}/pickup-slots` (`listPickupSlots`) — when the Reschedule view mounts, to populate available slots (falls back to a hardcoded 5-slot day if the shop has none configured — see quirks).
  - Auth: every `customer-orders`/`repair-bookings`/`sell-orders`/`customer/addresses`/`tickets/customer` call carries `Authorization: Bearer <token>` via `authHeaders()`; the shop-public and pickup-slots calls do not require it (public endpoints, no header sent).
- **Notable quirks**:
  - **Hardcoded fallback pickup slots**: `Reschedule` shows `09:00–11:00, 11:00–13:00, 13:00–15:00, 15:00–17:00, 17:00–19:00` whenever the shop's configured-slots response comes back empty — a fabricated schedule presented identically to real shop-configured slots, with no visual distinction.
  - **Hardcoded GST math in `Invoice`**: 18% GST split into 9%/9% CGST/SGST is computed client-side (`const GST = 0.18`) purely for display — not sourced from any backend invoice record.
  - Auto-refresh: while the Timeline view is open for a `booking`-kind order, a `setInterval` polls every 10 seconds (`window.setInterval(onRefresh, 10000)`) — this does not apply to ticket- or sell-kind orders.
  - The status filter's "Active" pill actually sends `status=Pending` to the API — the UI label and wire value diverge (`STATUSES` array maps `label: 'Active'` → `value: 'Pending'`), which is easy to miss when tracing a bug from the network tab back to the UI.
  - Extensive status-key alias tables (`SERVICE_STEPS`, `PICKUP_STEPS` with duplicate keys like `PICKUP_PERSON_ASSIGNED`/`PICKUP_ASSIGNED` both mapping to "Pickup Person Assigned") suggest backend event-key drift over time that the frontend now permanently compensates for.

---

## MyCartPage (`account/cart/page.js`)

- **Path**: `src/app/(site)/account/cart/page.js`
- **Route**: `/account/cart` (no params).
- **Purpose**: View/edit the marketplace cart (quantity stepper, remove) and checkout, which converts the cart into a BUY order via order-service.
- **Entry points**:
  - `src/components/site/HeaderCart.js` — the header's cart icon + live item-count badge, `<Link href="/account/cart">`, always visible (desktop `lg+`); count itself comes from an independent `getCart()` call in that component.
  - `src/components/site/SiteHeader.js` line 407 — renders `<HeaderCart>` inline in the desktop icon row.
  - `src/components/site/HeaderAccount.js` line 52 (`MENU_LINKS`) — "My Cart" entry in the account dropdown/mobile menu.
  - `src/components/site/account/AccountSidebar.js` line 42 (`NAV`) — "My Cart" sidebar link.
- **Exit points / navigation out**:
  - Empty-cart state: `<Button href="/#buy">Start shopping</Button>` → homepage's Buy section anchor.
  - Post-checkout confirmation: `<Button href="/account/orders">View my orders</Button>` and `<Button href="/#buy">Continue shopping</Button>`.
- **Key UI sections**, in render order:
  1. Post-checkout branch (`placed` truthy) — replaces the whole page with a "Thank you for your order!" confirmation panel + the two buttons above. This branch fully short-circuits the normal cart render.
  2. Normal branch: `AccountPageHeader` ("My Cart" / "Your cart", item count subtitle).
  3. `AccountLoader` / `AccountError` / `AccountEmpty` (empty cart, "Start shopping" CTA), or:
  4. Two-column grid: left = `CartRow` list (product image-or-emoji-fallback, title, storage/color chips, price, qty stepper, subtotal, Remove); right = sticky "Order summary" panel (subtotal, free shipping line, total, Checkout button, inline error, warranty/delivery reassurance icons).
- **State & data**:
  - Local: `items`, `loading`, `error`, `busy` (mutation-in-flight), `placing`, `placed` (order confirmation payload or null).
  - Derived via `useMemo`: `total` (sum of line totals) and `count` (sum of quantities).
  - No redux/context; quantity edits are optimistic (`setItems` updates immediately, then persists, reverting via a full `load()` on failure).
- **API calls** (all Bearer-authenticated via `customerAccount.js`):
  - `GET {MARKETPLACE_BASE}/customer/cart` (`getCart`) — on mount.
  - `PUT {MARKETPLACE_BASE}/customer/cart/{itemId}` (`updateCartItem`, body `{quantity}`) — on stepper +/-, optimistic.
  - `DELETE {MARKETPLACE_BASE}/customer/cart/{itemId}` (`removeCartItem`) — on Remove.
  - `POST {ORDER_BASE}/customer-orders/buy` (`checkoutBuy`, body `{items, totalAmount}`) — on Checkout.
  - `DELETE {MARKETPLACE_BASE}/customer/cart` (`clearCart`) — immediately after a successful checkout, to empty the now-converted cart; errors from this call are deliberately swallowed (`.catch(() => {})`) since checkout already succeeded.
  - Auth: identical Bearer pattern as the other account pages — `Authorization: Bearer <token>` from `readCustomer().token`, no cookies.
- **Notable quirks**:
  - "FREE" shipping is a hardcoded label (`<dd>FREE</dd>`) — there's no shipping-cost field/calculation anywhere in this page.
  - The doc comment at the top of the file explicitly flags that the cart controller is "still live on the backend" as a heads-up that this isn't dead code, implying some uncertainty elsewhere about the marketplace cart's future.
  - Checkout failure path: if `checkoutBuy` throws, the cart contents are preserved (not cleared) and a generic error is shown — but if `checkoutBuy` succeeds and the follow-up `clearCart` fails, the user still sees the success screen with cart already cleared client-side, silently leaving stale items server-side.

---

## ManageDevicePage (`account/devices/page.js`)

- **Path**: `src/app/(site)/account/devices/page.js` (list/filter page) + `src/components/site/account/DeviceWizard.js` (add/edit wizard, rendered inline in place of the list).
- **Route**: `/account/devices` (no params).
- **Purpose**: List the customer's saved devices with category filter chips, default-device selection, edit, delete; "Add device" launches a 4-step wizard (category → brand → model → variant details) sourced from master-data, saved to user-service.
- **Entry points**:
  - `src/components/site/HeaderAccount.js` line 53 (`MENU_LINKS`) — "Manage My Device" entry in the account dropdown/mobile menu.
  - `src/components/site/account/AccountSidebar.js` line 43 (`NAV`) — "Manage My Device" sidebar link.
- **Exit points / navigation out**: None — no `Link`/`router.push` calls anywhere in this page or `DeviceWizard`; all "Add device"/"Edit"/"Close" actions swap in-page state (`editor`) between the list and the wizard.
- **Key UI sections**, in render order:
  1. `AccountPageHeader` — title switches between "Saved devices" / "Add a device" / "Edit device" depending on `editor` state; right-aligned "Add device" button (list view only).
  2. If `editor` is set → `DeviceWizard` renders in place of everything below (steps: category grid → brand grid → model grid (with a zoomable full-screen preview modal) → `VariantEditor` for color/RAM/storage/IMEI/note).
  3. Otherwise: category filter `Chip` row (only shown once devices exist), then `AccountLoader`/`AccountError`/`AccountEmpty`/device grid (`DeviceCard`: icon, name, default badge, color/spec/IMEI line, note, Edit/Set default/Delete actions), plus a persistent "Add a new device" dashed-border prompt strip below the grid.
- **State & data**:
  - List page: `devices`, `loading`, `error`, `mutating`, `filter` (category code), `editor` (null = list view, `{}` = add, device object = edit).
  - `counts`/`visible`/`chips` derived via `useMemo` from `devices` + `filter`; an effect resets `filter` back to `ALL` if the current filter's count drops to 0 (e.g. after deleting the last device of that category).
  - `DeviceWizard` internal state: `step` (0–3), `categories`/`brands`/`models` (master-data lists), `selection` (accumulated category/brand/model ids+names), `previewModelId` (full-screen image preview), and `VariantEditor`'s own `colors`/`rams`/`storages`/`specs`/`color`/`ram`/`storage`/`imei`/`note`.
- **API calls**:
  - `GET {USER_BASE}/customer/devices` (`listDevices`) — Bearer, on mount/reload.
  - `POST {USER_BASE}/customer/devices/{id}/default` (`setDefaultDevice`) — Bearer, on "Set default".
  - `DELETE {USER_BASE}/customer/devices/{id}` (`deleteDevice`) — Bearer, on Delete (after `window.confirm`).
  - `POST` / `PUT {USER_BASE}/customer/devices[/{id}]` (`createDevice`/`updateDevice`) — Bearer, from `VariantEditor`'s Save.
  - Master-data (all **unauthenticated**, via `masterApi`): `GET /master/device-categories`, `GET /master/categories/{id}/brands`, `GET /master/brands/{id}/models`, `GET /master/models/{id}`, `GET /master/colors`, `GET /master/ram-options`, `GET /master/storage-options`.
  - Auth: device CRUD calls attach `Authorization: Bearer <token>` (via `customerAccount.js`'s `authHeaders()`); all `masterApi` calls are anonymous by design (`skipAuthRedirect: true`, no token sent) since master-data is `permitAll` on the backend.
- **Notable quirks**:
  - Category-code normalization is duplicated verbatim between this page (`CODE_ALIASES`) and `DeviceWizard.js` (`CATEGORY_ALIASES`) — same alias table (MOBILE/SMARTPHONE→MOBILE, WATCH/WATCHES→SMARTWATCH, etc.), maintained in two separate files rather than a shared constant.
  - `ZoomableModelImage`'s pinch/pan/zoom implementation (pointer-event tracking, clamped offsets, wheel zoom) is a fairly heavy piece of gesture-handling code embedded directly in this device-picker wizard, purely for previewing a model photo before selecting it — notably more complex than any other interaction in the account area.
  - The Cloudinary AVIF/HEIC→JPEG URL rewrite (`resolveMasterImage`) is duplicated logic conceptually similar to `normalizeImageUrl` in `OrdersExperience.js`, implemented independently in each file rather than shared.
  - `VariantEditor` silently drops `ramOptionId`/`storageOptionId`/labels from the save payload entirely for categories matched by `/WATCH|AUDIO|HEADPHONE|EARBUD/` — a regex-based capability check rather than a master-data-driven flag.

---

## ManageAddressPage (`account/addresses/page.js`)

- **Path**: `src/app/(site)/account/addresses/page.js`
- **Route**: `/account/addresses` (no params).
- **Purpose**: List saved delivery/pickup addresses as cards (label icon, one-line formatted address, phone, default badge) with Set-default/Edit/Delete, plus an inline add/edit form.
- **Entry points**:
  - `src/components/site/HeaderAccount.js` line 54 (`MENU_LINKS`) — "Manage Address" entry in the account dropdown/mobile menu.
  - `src/components/site/account/AccountSidebar.js` line 44 (`NAV`) — "Manage Address" sidebar link.
- **Exit points / navigation out**: None — no `Link`/`router.push` in this file; "Add address"/"Edit"/"Cancel" all toggle local `form` state between the list and `AddressForm`.
- **Key UI sections**, in render order:
  1. `AccountPageHeader` — "Manage Addresses" / "Your delivery locations", saved-count subtitle, right-aligned "Add address" button (hidden while the form is open).
  2. `AddressForm` (only rendered when `form` is non-null) — label segmented control (Home/Office/Other), full name, mobile, address line, area/taluk/district/state/pincode grid, "Set as default" checkbox, inline validation error, Save/Cancel.
  3. `AccountLoader` / `AccountError` / `AccountEmpty` (no addresses yet, "Add a new address" CTA) / grid of `AddressCard`s (label icon, name, default badge, formatted address, phone, Set default/Edit/Delete row).
- **State & data**:
  - `addresses`, `loading`, `error`, `mutating`, `form` (`null` = closed, `{}` = add, address object = edit).
  - `AddressForm` keeps its own `form`/`busy`/`error` local state, seeded from `EMPTY_FORM` merged with `initial`; it is deliberately remounted via a `key={form.id || 'new'}` prop when switching between "add" and "edit A" and "edit B", specifically to avoid the initializer reusing stale values (documented in-code as an explicit bug-avoidance choice).
- **API calls** (all Bearer-authenticated via `customerAccount.js`):
  - `GET {USER_BASE}/customer/addresses` (`listAddresses`) — on mount/reload.
  - `POST {USER_BASE}/customer/addresses` (`createAddress`) — Save on the "add" form.
  - `PUT {USER_BASE}/customer/addresses/{id}` (`updateAddress`) — Save on the "edit" form.
  - `DELETE {USER_BASE}/customer/addresses/{id}` (`deleteAddress`) — Delete (after `window.confirm`).
  - `POST {USER_BASE}/customer/addresses/{id}/default` (`setDefaultAddress`) — Set default.
  - Auth: same Bearer pattern (`Authorization: Bearer <token>`, `credentials: 'omit'`) as every other `customerAccount.js` call.
- **Notable quirks**:
  - Dual-write compatibility shim: `addressBody()` in `customerAccount.js` always sends both the canonical fields (`area`, `district`) *and* legacy mirrors (`locality: form.area`, `city: form.district`) on every create/update, purely so older backend readers that still expect `locality`/`city` keep working — a permanent-looking piece of migration debt baked into every request.
  - No client-side pincode format check (only a "not empty" check) despite the field being explicitly labeled "6-digit pincode" — mobile similarly is checked for non-empty here but not for 10-digit length (the profile page enforces exact 10-digit mobile validation via `digitsOnly`, this form does not).
  - Delete/set-default use a native `window.confirm()`/no-confirm respectively — consistent with `devices` and `orders` (sell-cancel), but inconsistent with `cart` (Remove has no confirmation at all).
