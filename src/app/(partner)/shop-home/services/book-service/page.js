'use client';

/**
 * /shop-home/services/book-service — "Book Service" (Create Booking).
 *
 * 2026-09: several rounds of UI-only redesign — every field, handler,
 * validation rule, and API call below is byte-for-byte the same logic this
 * page has always had.
 *   - Compact multi-column grids instead of one full-width column per
 *     section.
 *   - Reorganized into 4 content groups (Customer/Device/Problem & Service/
 *     Pickup), now shown as a horizontal tab bar with Previous/Next/Confirm
 *     Booking in a sticky step footer — only the active tab's fields render.
 *   - Brand and Model are now an image-aware searchable picker
 *     (`ImageSelect`, below) instead of a plain `<select>`: `Brand.imageUrl`/
 *     `Model.imageUrl` are real master-data fields (confirmed via the admin
 *     brands/models pages, which already upload and render them) — this
 *     just surfaces them here too, with a small selected-device preview
 *     once both are picked. `onChange` still writes the exact same
 *     `brandId`/`brandName`/`modelId`/`modelName` (+ resets) the old
 *     `<select>`'s handler did.
 * The shared CardShell/StatCard/etc. components used by every OTHER page
 * are deliberately untouched — this file still uses its own local
 * `Section`/`COMPACT_INPUT_CLS` rather than the shared ones: the brief
 * scoped these redesigns to Book Service, not a global change across the
 * whole dashboard.
 *
 * The 4 tab groups don't have a 1:1 slot for every existing field — Device
 * Photos and the itemized Pricing inputs (inspection/service/parts/pickup
 * charge, discount, tax) aren't named in any of the 4 groups, but they're
 * real, existing fields that can't just disappear. Photos live at the end
 * of Device Details (they document the device); the itemized pricing
 * inputs live at the end of Problem & Service Details, ending in the
 * Estimated Total. "Pickup Required" (asked for once) isn't a real field —
 * the existing Service Method select (Walk-in/Pickup/Doorstep) already
 * serves that purpose and is used as-is.
 *
 * Device category/brand/model and repair-category/service lookups reuse the
 * exact masterApi calls the public /repair flow uses (RepairFlow.js).
 *
 * Service Method and Preferred Date/Time (and their getPickupSlots lookup)
 * were removed entirely per request — every booking now submits as
 * Walk-in (form.serviceMode's EMPTY_FORM default, never changed by any UI
 * anymore) with an empty pickupDate/pickupSlotStart/pickupSlotEnd.
 * validate() no longer requires a slot; the confirmation screen hides its
 * "Scheduled" row when there isn't one. needsAddress (`serviceMode !==
 * 'WALK_IN'`) is consequently always false now, so the Address card on
 * Customer Details is never required — it's kept as-is regardless, in
 * case a future change reintroduces a non-Walk-in service mode.
 *
 * Submission is a stub — see src/lib/shopBooking.js's doc comment for why
 * (no shop-authenticated booking-creation endpoint exists yet). Photo
 * upload and master-data lookups are real, live calls.
 *
 * Device Category also uses `ImageSelect` now (categories carry a real
 * `imageUrl` too — confirmed via the admin Device Categories page, same
 * `/master/device-categories` list this page already fetches). Color has no
 * image field at all — a model's colors are plain strings, not objects — so
 * it gets a swatch instead, via `guessColorHex()` (src/lib/colorSwatch.js,
 * the exact same color-name→hex algorithm the admin Models page already
 * uses to preview colors, extracted so both stay in agreement). RAM/Storage
 * is left as a plain select: it's a spec string ("8GB + 128GB"), there's no
 * image or color concept that honestly applies to it.
 *
 * Color is its own full-width row below Model/IMEI now, showing every
 * available color as an always-visible swatch+name chip (same chip style
 * Problem & Service Details' Service Type already uses) instead of a closed
 * dropdown — replaced the earlier `ColorSelect` combobox, which is now
 * deleted rather than left as dead code. A model with exactly one color
 * auto-selects it (nothing to choose); zero colors shows "No colors
 * available" instead of hiding the section, so that state is honest rather
 * than looking like the section is just missing.
 *
 * `colorSwatch.js` is dynamically `import()`ed, not a static top-of-file
 * import — it pulls in a ~32k-entry color-name dataset, which measured as a
 * +300KB jump in this page's first-load JS when imported statically. It's
 * only actually needed once a selected model has colors to show, so it's
 * fetched as its own lazy chunk at that point instead of bloating every
 * visit to this page (including bookings for models with no color list).
 *
 * Customer Name has a "previous customers" type-ahead now. There is no
 * customer-search-by-name endpoint anywhere reachable from a shop-owner
 * session (confirmed by a full-tree investigation — every customer-shaped
 * path that exists is a customer *self-service* endpoint, keyed to the
 * customer's own bearer token, not the shop's). So this searches the same
 * derived "customers who've booked with this shop before" directory the
 * Customers page already builds from GET {ORDER_BASE}/repair-bookings/shop
 * (shared via src/lib/customerDirectory.js so both pages agree), not a real
 * backend directory — and there is no ID-proof/KYC field on any customer
 * data this client can reach, so no such preview is shown; inventing one
 * would be fabricating data. Picking a match fills name/phone/email and, if
 * that customer's most recent booking had a pickup address, the address
 * fields too — all still freely editable afterward.
 *
 * The address fields (Address Line/Landmark/Pincode/City/District/State)
 * now render as their own "Address" card on the Customer Details tab
 * instead of inside Pickup / Service Location — same 6 real fields, same
 * `needsAddress`-gated required-ness, just relocated per request so address
 * is captured earlier in the flow. No `Taluk`/`Area` field was added even
 * though a reference design showed one — this booking's `pickupAddress`
 * payload shape has no such field (a *different* address model,
 * `{USER_BASE}/customer/addresses`, does have `taluk`/`area`, but that's
 * the customer's own self-service address book, not this booking's
 * pickup-address shape, and adding fields to a real payload the backend
 * wasn't built to receive isn't a layout change).
 *
 * Category/Brand/Model each now track their own loading/error state
 * instead of the fetch's failure being silently swallowed into an empty
 * array (`.catch(() => setX([]))`, the previous behavior for all three).
 * That mattered in practice: this environment's `MASTER_BASE()` host
 * (`api.neargfix.com`, from .env.local) was unreachable when this was written —
 * confirmed by a direct request from this environment timing out while
 * general internet access worked fine — so every one of these dropdowns
 * was silently empty with no indication anything had failed. A genuinely
 * unreachable backend can't be fixed from this file (no frontend change
 * makes an unresponsive server respond), but the dropdowns now say so
 * plainly and offer Retry instead of just looking broken/empty.
 *
 * The 3rd tab (formerly "Problem & Service Details") is now "Add Issue /
 * Service" — a UI-only redesign of the same real relevantRepairCategories/
 * repairServices/form.serviceIds/toggleService this page already had. It
 * used to be a "Service Category" select + a flat "Service Type" chip
 * list; it's now one always-visible accordion row per real repair category
 * (IssueCategoryRow, below), each expanding to that category's real
 * services as Add/Remove rows, plus a removable "Selected Services"
 * summary. Device Condition, Problem Description and Pricing used to live
 * on this same tab (back when it was "Problem & Service Details") — they
 * now live on the 4th tab, Pickup / Service Location, so this tab is only
 * ever the repair-category picker; same fields/validation/estimateTotal(),
 * just relocated. No new category/service data, no new submission field —
 * same serviceIds this page always collected. Per-category icons are
 * guessed from each
 * category's real name via iconForRepairCategory() (same idea as
 * guessColorHex() in colorSwatch.js: derive a visual from real text, not a
 * fixed per-category table), so it works for whatever repair categories
 * the backend actually returns. "Device-aware" filtering already existed
 * before this change — relevantRepairCategories already filters by the
 * selected device category's `deviceCategoryId` (picked on the Device
 * Details tab), so this accordion inherits it for free; if no device
 * category is picked yet, it says so instead of showing an empty list. The
 * old "Service Category" select field (form.serviceCategoryId) is no
 * longer shown anywhere (still present in form state, just unused, so
 * nothing about the payload shape changes).
 *
 * Each selected service also gets a Price input + Warranty (3/6/12
 * months) chip row — repair-services has no price/warranty field anywhere
 * in this backend, and the booking payload's `services` array only ever
 * carries repairServiceId/serviceCode/serviceName (RepairFlow.js,
 * repairBooking.js, and every bookings/pickups list view agree on that
 * shape) — there's no per-item price/warranty line to submit into. Price
 * is still made real the only honest way available: every entered price
 * is summed (draftServicesSubtotal) and synced into the page's actual,
 * submitted `form.serviceCharge` field via an effect, so it genuinely
 * reaches the real Estimated Total — the standalone manual Pricing card
 * (Inspection/Service/Parts/Pickup Charge, Discount, Tax) was removed from
 * the Pickup tab so Service Charge is only ever set this way now (those
 * other charge fields stay in form state, just with no UI to edit them —
 * same "kept but unused" treatment as form.serviceCategoryId elsewhere in
 * this file). Warranty has no equivalent field to feed at all, so it
 * stays a pure local note, never submitted. A "Last 5 prices" control was
 * requested too but left out entirely: there's no per-service price
 * history anywhere to show, not even approximately (ticket priceItemsJson
 * has no repairServiceId to join on and isn't reachable from a
 * booking-shaped page anyway), so there was no honest way to build it.
 *
 * The 4th tab, "Service Price & Issue Estimate" (was "Pickup / Service
 * Location", then "Problem & Service Details" further back), settled on
 * these cards after several rounds of trimming/reorganizing per request:
 *   - Bill Details — an itemized view of chosenServices/
 *     draftServicePrices/toggleService, an "Add Service" shortcut that
 *     jumps to the 3rd tab, and the real Estimated Total banner
 *     (totals.total, driven entirely by the summed service prices).
 *   - Device IMEI / Serial Number — the same real form.imei field also on
 *     Device Details, shown again here since this is the estimate step.
 *   - Estimated Delivery — a local-only planning aid, a "Ready By"
 *     date+time picked via a real month calendar + Hour/Minute/AM-PM
 *     selects (ReadyByPicker, below — a later request replaced this
 *     card's original Received/Duration/Ready By three-tile layout with
 *     this single widget, modeled on a reference design). Never submitted.
 * Device Files (devicePhotosCard) sits beside Estimated Delivery: Front
 * Side + Back Side photos (required) and an optional Full Coverage video,
 * matching the Partner app. Uploads go through uploadShopDevicePhoto() in
 * src/lib/shopBooking.js into form.frontImageUrl/backImageUrl/videoUrl,
 * saved on the ticket as devicePhotosJson {front, back, video}.
 *
 * Modeled on a reference "Service Price & Issue Estimate" screen, but
 * four of its elements were never built after investigation confirmed
 * they have no real backing anywhere in this app: an on-time/SLA status
 * (no turnaround or promised-date field exists on any booking/ticket), a
 * "customer approved the estimate" checkbox (no consent/approval flag
 * exists), an IMEI camera Scan button, and Record Voice Note (no
 * scanning or audio-recording capability integrated anywhere, and no
 * field to submit a recording into even if captured). An "Issue Details"
 * card (Device Condition + Problem Description) briefly lived on this tab
 * too but was removed per request — those two fields currently have no
 * dedicated UI anywhere (Problem Description is still reachable
 * incidentally through the "Other" repair category's textarea on the 3rd
 * tab, if that category exists).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Grid3x3,
  Hash,
  History,
  Home,
  Image as ImageIcon,
  Info,
  KeyRound,
  Landmark,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Mic,
  Minus,
  Music2,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  MessageSquarePlus,
  UserPlus,
  QrCode,
  Receipt,
  RectangleHorizontal,
  RotateCcw,
  ScanLine,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Tag,
  Timer,
  Trash2,
  Truck,
  Usb,
  User,
  UserCog,
  Video,
  Volume2,
  Wrench,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import { MaterialIcon } from '@/components/site/MaterialIcon';
import AssignTechnicianModal from '@/components/shop-dashboard/AssignTechnicianModal';
import { IssueCheckRow, IssueSheet, IssueTile, SelectedIssueRow } from '@/components/shop-dashboard/RepairIssuePieces';
import { masterApi } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { iconForRepairCategory, iconForRepairService } from '@/lib/repairIcons';
import { bookingRef } from '@/lib/orderStages';
import { fetchShopBookings, fetchTicket } from '@/lib/shopDashboard';
import { deriveCustomers } from '@/lib/customerDirectory';
import { readShopOwner } from '@/lib/shopAuth';
import { getShopPublic } from '@/lib/repairBooking';
import { createShopBooking, estimateTotal, ticketVariant, updateShopTicket, uploadShopDevicePhoto } from '@/lib/shopBooking';
import { exactDigits, required, validateForm } from '@/lib/formValidation';
import { focusField, registerField } from '@/lib/formFocus';
import { notifyError, notifySuccess } from '@/lib/toast';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
// Page-local, compact tokens — see file header for why these aren't the
// shared FIELD_INPUT_CLS/CardShell used elsewhere in the dashboard.
// 16px text below sm so iOS Safari doesn't auto-zoom on focus.
const COMPACT_INPUT_CLS =
  'w-full rounded-xl border border-[#ECECEC] bg-white px-3.5 py-3 text-base text-[#111111] sm:text-sm placeholder:text-[#98A2B3] transition focus:border-[#035C6C] focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[#ECECEC] disabled:cursor-not-allowed disabled:bg-[#F3F3F3] disabled:text-[#98A2B3]';
// Same box, with room carved out on the left for a leading icon (see
// IconField, below) — used wherever a field shows one, so the input text
// never sits underneath the icon.
const ICON_INPUT_CLS = cx(COMPACT_INPUT_CLS, 'pl-10');
// Booking Confirmation action rows (Assign Technician / Share Receipt / Barcode Print).
const CONFIRM_ACTION_CLS = cx(
  'group flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white px-4 py-3 text-left transition hover:border-[#035C6C]/50 hover:bg-[#E5F3F5]',
  FOCUS_RING,
);
const CONFIRM_ACTION_ICON_CLS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C] transition group-hover:bg-white';

// Per-service Price/Warranty in "Add Issue / Service" (below) — neither has
// a field on repair-services or the booking payload's `services` array
// (confirmed investigation: that array only ever carries repairServiceId/
// serviceCode/serviceName). Price is still made *real* the only honest way
// available: every entered price is summed into the page's existing, real
// `form.serviceCharge` field (see the effect syncing it from
// draftServicesSubtotal, below), so it genuinely reaches the submitted
// Estimated Total — just not as a separate per-item line, since no such
// line exists in the payload. Warranty has no equivalent real field to
// feed at all, so it stays a pure local scratchpad note.
const WARRANTY_OPTIONS = ['3', '6', '12'];

// This array's own order IS the tab bar's display order AND drives
// goPrev/goNext and each button's step-number badge (i + 1 in
// the tab bar below). devicesList and confirmation are appended at the end
// per request — 1 through 7 keep their existing order/position untouched.
// confirmation being the new last entry means the shared step footer's
// "Confirm Booking" now sits one tab before it, on devicesList, right next
// to that section's own "Submit Booking" bar (both call the same submit());
// submit() itself navigates to 'confirmation' on success (see submit(),
// below) rather than the user tapping through to it manually.
// `subtitle` is a page-local, purely-cosmetic addition to each existing tab
// (used only by the redesigned step-progress bar below) — labels, icons,
// keys, order and everything the tab bar's click handlers/validation key
// off of are unchanged.
const SECTIONS = [
  { key: 'customer', ms: 'person', short: 'Customer', label: 'Customer Details', subtitle: 'Add customer information', icon: User },
  { key: 'device', ms: 'smartphone', short: 'Device', label: 'Device Details', subtitle: 'Add device information', icon: Smartphone },
  { key: 'repair', ms: 'build', short: 'Devices & Repair', label: 'Devices & Repair', subtitle: 'Issues, price, photos, lock and missing parts', icon: Wrench },
  { key: 'devicesList', ms: 'assignment', short: 'Review & Confirm', label: 'Review & Confirm', subtitle: 'Review and submit', icon: ClipboardList },
  { key: 'confirmation', ms: 'check_circle', short: 'Confirmation', label: 'Booking Confirmation', subtitle: 'Booking created', icon: CheckCircle2 },
];

// Same flow as the Partner App (ServicePriceEstimate "Devices & Repair"):
// the old Issue / Service, Price & Estimate, Device Info, Security Lock and
// Missing Parts tabs are now PARTS of the one Devices & Repair step, with
// Security Lock and Missing Parts folded. Validators stay keyed by part.
const STEP_PARTS = { repair: ['problem', 'pickup', 'deviceInfo', 'deviceSecurity', 'missingParts'] };
const STEP_OF = Object.fromEntries(Object.entries(STEP_PARTS).flatMap(([step, parts]) => parts.map((p) => [p, step])));
const FOLD_PARTS = ['deviceSecurity', 'missingParts'];

// Repair Issues tile order — the Partner app's RepairIssuesPicker TILE_ORDER:
// these groups first, the rest after in catalogue order.
const ISSUE_TILE_ORDER = [/dead|no power/i, /display|screen/i, /battery/i, /motherboard|mainboard|sub-?board/i, /network/i, /security/i];
const issueTileRank = (name) => {
  const i = ISSUE_TILE_ORDER.findIndex((re) => re.test(String(name || '')));
  return i === -1 ? ISSUE_TILE_ORDER.length : i;
};

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Pay Later', 'Other'];

// Device Missing Parts inspection checklist. missingDamageParts (the
// summary string built from this, below) is the REAL booking field this
// codebase already reads elsewhere (OrdersExperience.js: "Missing or
// damaged parts" · falls back to "Nil") — not a new, parallel field. The
// per-part missing/damaged breakdown itself has no structured backend
// field to store into, so it stays local UI state and is only ever
// submitted as that one joined summary string.
const MISSING_PART_ITEMS = [
  { key: 'display', icon: Smartphone, title: 'Display', subtitle: 'Screen and front panel' },
  { key: 'backPanel', icon: RectangleHorizontal, title: 'Back Panel', subtitle: 'Rear cover and housing' },
  { key: 'simCardTray', icon: CreditCard, title: 'SIM Card Tray', subtitle: 'SIM card holder' },
  { key: 'buttons', icon: SlidersHorizontal, title: 'Buttons', subtitle: 'Power, volume and other buttons' },
  { key: 'chargingPort', icon: Usb, title: 'Charging Port', subtitle: 'USB port and connectors' },
  { key: 'camera', icon: Camera, title: 'Camera', subtitle: 'Front and rear camera modules' },
  { key: 'speaker', icon: Volume2, title: 'Speaker', subtitle: 'Speaker and audio output' },
];

// Device Security Lock's selectable lock types. 'PIN'/'Password'/'Pattern'
// map directly to the REAL booking.deviceSecurityType field this codebase
// already reads elsewhere (Receipt/QR E-Print pages, the customer app's
// OrdersExperience.js) — not a new, parallel field. 'NONE' (No Lock) is
// its own explicit value, deliberately DIFFERENT from form.deviceSecurityType's
// unselected default of '' — collapsing "nothing chosen yet" and "No Lock
// chosen" onto the same '' was the bug that made No Lock look pre-selected
// on page load and made "you must pick something" validation impossible to
// express. 'NONE' is translated back to no value (undefined) only at
// submit time, so the payload still matches this field's existing
// "no value" convention everywhere else it's read.
const LOCK_OPTIONS = [
  { key: 'PIN', icon: Hash, title: 'Numeric PIN', subtitle: '4–6 digit device PIN', example: 'e.g. 1234 · 987654' },
  { key: 'Password', icon: KeyRound, title: 'Password', subtitle: '4–16 letters & numbers', example: 'e.g. Ggfix2026' },
  { key: 'Pattern', icon: Grid3x3, title: 'Pattern Lock', subtitle: 'Draw across at least 4 dots' },
  { key: 'NONE', icon: ShieldCheck, title: 'No Lock', subtitle: 'Device is already unlocked', badge: 'Ready for Service' },
];

const EMPTY_FORM = {
  customerName: '',
  customerMobile: '',
  customerAltMobile: '',
  customerEmail: '',
  categoryCode: '',
  categoryId: '',
  brandId: '',
  brandName: '',
  customBrand: false,
  modelId: '',
  modelName: '',
  customModel: false,
  color: '',
  variant: '',
  imei: '',
  deviceSecurityType: '',
  devicePin: '',
  serviceCategoryId: '',
  serviceIds: [],
  // "Others" custom issues (not in the service catalog) — see addCustomIssue.
  customIssues: [],
  issueDescription: '',
  deviceCondition: '',
  frontImageUrl: '',
  backImageUrl: '',
  videoUrl: '',
  serviceMode: 'WALK_IN',
  addressLine: '',
  landmark: '',
  pincode: '',
  city: '',
  district: '',
  state: '',
  pickupDate: '',
  pickupSlotStart: '',
  pickupSlotEnd: '',
  inspectionCharge: '',
  serviceCharge: '',
  partsCharge: '',
  pickupCharge: '',
  discount: '',
  taxPercent: '',
};

// "Others" custom-issue draft (Add Issue / Service tab) and its accordion key.
const EMPTY_CUSTOM_ISSUE = { name: '', categoryId: '', price: '' };
const OTHERS_KEY = '__others__';

/** "Apple iPhone 11 Pro Max" — brand prefixed only when the model name doesn't already start with it. */
function deviceTitle(brand, model) {
  const b = String(brand || '').trim();
  const m = String(model || '').trim();
  if (!m) return b;
  return b && !m.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${m}` : m;
}

function unwrap(list) {
  if (Array.isArray(list)) return list;
  return list?.content ?? list?.data ?? [];
}

/** Clean, de-duplicated list of non-empty strings from a possibly-messy jsonb value. */
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  value.forEach((v) => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  });
  return out;
}

function money(n) {
  return `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Per-section required-field schemas — same fields/messages validate()
 * always checked, just structured per tab so both goNext() (gate the
 * current step) and the final submit (gate everything) can reuse the exact
 * same rules instead of two hand-written copies. `values` passed to
 * validateForm() below is always `{ ...form, needsAddress }` since
 * `needsAddress` is a derived local, not a form field.
 */
/** Strips a stored phone like "+91 98765 43210" down to its 10-digit local number. */
function toTenDigitMobile(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

const SECTION_VALIDATORS = {
  customer: {
    customerName: required('Customer name is required.'),
    customerMobile: [required('Customer mobile number is required.'), exactDigits(10, 'Enter a valid 10-digit mobile number.')],
    customerAltMobile: exactDigits(10, 'Enter a valid 10-digit alternate mobile number.'),
  },
  device: {
    categoryId: required('Select the device category, brand and model.'),
    // A brand / model typed through "Other" has no id — its name counts.
    brandId: (value, all) => (value || (all.customBrand && String(all.brandName || '').trim()) ? '' : 'Select the device category, brand and model.'),
    modelId: (value, all) => (value || (all.customModel && String(all.modelName || '').trim()) ? '' : 'Select the device category, brand and model.'),
  },
  // Keyed on serviceIds (not issueDescription) so it doesn't collide with
  // the pickup step's required Issue Description below — validateAll()
  // merges every schema, and sectionForField() must send an empty
  // description to Price & Estimate, where its textarea is.
  problem: {
    serviceIds: (value, all) =>
      (value || []).length === 0 && !(all.customIssues || []).length && !String(all.issueDescription || '').trim()
        ? 'Select at least one repair issue.'
        : '',
  },
  pickup: {
    addressLine: (value, all) => (all.needsAddress && !String(value || '').trim() ? 'Fill in the pickup address.' : ''),
    pincode: (value, all) => (all.needsAddress && !String(value || '').trim() ? 'Fill in the pickup address.' : ''),
    city: (value, all) => (all.needsAddress && !String(value || '').trim() ? 'Fill in the pickup address.' : ''),
    state: (value, all) => (all.needsAddress && !String(value || '').trim() ? 'Fill in the pickup address.' : ''),
    // Device Photo or Video, Issue Description and Device Security are
    // optional in the Partner app's Devices & Repair screen, so not here either.
    customerApproved: (value) => (value ? '' : 'Customer Booking approval is required — tick the box once the customer agrees.'),
  },
  // No deviceInfo entry: that tab only DISPLAYS the Price & Estimate
  // details (pickupSummarySection), so an error there couldn't be fixed in
  // place. The pickup rules above already gate every route forward to it
  // (goNext/handleTabClick), and submit() re-checks them via validateAll().
  deviceSecurity: {
    devicePin: (value, all) => {
      const v = String(value || '');
      if (all.deviceSecurityType === 'PIN' && !/^\d{4,6}$/.test(v)) return 'PIN must contain at least 4 digits.';
      if (all.deviceSecurityType === 'Password' && (v.length < 4 || v.length > 16)) return 'Password must be 4–16 characters.';
      if (all.deviceSecurityType === 'Pattern' && v.split('-').filter(Boolean).length < 4) return 'Pattern must connect at least 4 dots.';
      return '';
    },
  },
  // deviceInfo/missingParts/devicesList intentionally have no required
  // fields here — color/variant, missing-parts flags, and the review list
  // are optional by the existing backend contract (missingDamageParts
  // already defaults to "Nil" when nothing is flagged).
};

/** Every part's rules for one step (a merged step validates all its parts). */
function schemaFor(stepKey) {
  return Object.assign({}, ...(STEP_PARTS[stepKey] || [stepKey]).map((k) => SECTION_VALIDATORS[k] || {}));
}

/** Which tab a given field belongs to, so a failed goNext()/submit can jump the user straight there. */
function sectionForField(field) {
  const entry = Object.entries(SECTION_VALIDATORS).find(([, schema]) => field in schema);
  return entry ? entry[0] : null;
}


/* ---- Thank-you receipt pieces (the app's ReceiptSection / ReceiptRow) ---- */

function ReceiptSection({ label, last = false, children }) {
  return (
    <div className={last ? '' : 'mb-5'}>
      <p className="flex items-center gap-2 text-[13.5px] font-extrabold text-[#111111]">
        <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-[#035C6C]" aria-hidden="true" />
        {label}
      </p>
      <div className="mb-2.5 mt-2 h-px bg-[#E5E7EB]" />
      {children}
    </div>
  );
}

/** Label on the left (fixed column), value on the right — a long value wraps in its own column. */
function ReceiptRow({ icon: Icon, label, value, bold = false }) {
  return (
    <div className="mb-2 flex items-start gap-3">
      <span className="flex w-36 shrink-0 items-start gap-1.5 text-[12px] font-semibold leading-4 text-[#6B7280] sm:w-44">
        {Icon ? <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-[#035C6C]" aria-hidden="true" /> : null}
        <span className="min-w-0 break-words">{label}</span>
      </span>
      <span className={cx('min-w-0 flex-1 break-words text-right text-[13px] leading-5 text-[#111111]', bold ? 'font-extrabold' : 'font-bold')}>
        {value || value === 0 ? value : '—'}
      </span>
    </div>
  );
}

/* ---- Booking success burst: a check that pops in with confetti, then the Thank-you screen ---- */

const BURST_COLORS = ['#035C6C', '#0788C9', '#609138', '#FAA700', '#F32C26', '#1C3053', '#F4B4B4'];
const BURST_SHAPES = ['dot', 'bar', 'star', 'arc'];
const BURST_PIECES = Array.from({ length: 14 }, (_, i) => ({
  angle: i * (360 / 14) + (i % 2 ? 8 : -6),
  radius: i % 3 === 0 ? 122 : i % 3 === 1 ? 104 : 112,
  color: BURST_COLORS[i % BURST_COLORS.length],
  shape: BURST_SHAPES[i % BURST_SHAPES.length],
}));
const BURST_CSS = `
@keyframes bsPop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
@keyframes bsDraw { to { stroke-dashoffset: 0 } }
@keyframes bsBurst {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--bs-a)) translateY(-40px) scale(.4) }
  35% { opacity: 1 }
  100% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--bs-a)) translateY(calc(-1 * var(--bs-r))) scale(1) }
}
@keyframes bsFade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .bs-anim { animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important } }
`;

function BurstPiece({ shape, color }) {
  if (shape === 'bar') return <span className="block h-4 w-1.5 rounded-sm" style={{ backgroundColor: color }} />;
  if (shape === 'star') return <span className="block h-3 w-3 rotate-45 rounded-[3px]" style={{ backgroundColor: color }} />;
  if (shape === 'arc') return <span className="block h-3.5 w-3.5 rounded-full border-[3px] border-b-transparent border-l-transparent" style={{ borderTopColor: color, borderRightColor: color }} />;
  return <span className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />;
}

/** Full-screen success moment (~1.9s, tap to skip); the Thank-you screen is already underneath. */
function BookingSuccessBurst({ onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 1900);
    return () => clearTimeout(t);
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="status" aria-live="polite" onClick={() => doneRef.current()} className="fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center bg-white">
      <style>{BURST_CSS}</style>
      <div className="relative h-[280px] w-[280px]">
        {BURST_PIECES.map((p, i) => (
          <span
            key={i}
            className="bs-anim absolute left-1/2 top-1/2"
            style={{ '--bs-a': `${p.angle}deg`, '--bs-r': `${p.radius}px`, animation: `bsBurst 700ms ${180 + i * 22}ms cubic-bezier(.2,.8,.2,1) both` }}
          >
            <BurstPiece shape={p.shape} color={p.color} />
          </span>
        ))}
        <div
          className="bs-anim absolute left-1/2 top-1/2 -ml-[64px] -mt-[64px] flex h-32 w-32 items-center justify-center rounded-full bg-[#035C6C] shadow-[0_12px_32px_rgba(3,92,108,0.28)]"
          style={{ animation: 'bsPop 520ms cubic-bezier(.2,.9,.3,1.2) both' }}
        >
          <svg viewBox="0 0 52 52" className="h-16 w-16" aria-hidden="true">
            <path
              className="bs-anim"
              d="M14 27 L23 36 L39 18"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: 'bsDraw 380ms 380ms ease-out forwards' }}
            />
          </svg>
        </div>
      </div>
      <p className="bs-anim -mt-4 text-[18px] font-extrabold text-[#111111]" style={{ animation: 'bsFade 400ms 650ms both' }}>
        Booking Confirmed
      </p>
    </div>,
    document.body,
  );
}

/** A folded part of Devices & Repair: a one-line summary row that opens into the full section. */
function FoldCard({ id, icon: Icon, title, summary, invalid = false, open, onToggle, children }) {
  return (
    <div id={id} className="scroll-mt-28">
      {open ? (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded="true"
              className={cx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-[#035C6C] hover:bg-[#E5F3F5]', FOCUS_RING)}
            >
              Fold {title}
              <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded="false"
          className={cx(
            'flex w-full items-center gap-3 rounded-[22px] border bg-[#F3F3F3] p-4 text-left transition hover:border-[#C7E6EA] sm:p-5',
            invalid ? 'border-[#F84141]' : 'border-[#ECECEC]',
            FOCUS_RING,
          )}
        >
          <Icon3D flat icon={Icon} tone="green" size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-[#111111]">{title}</p>
            <p className={cx('truncate text-xs', invalid ? 'text-[#F84141]' : 'text-[#666666]')}>{summary}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-[#035C6C]">Edit</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, action, children, className }) {
  return (
    <section
      className={cx(
        'relative overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F3F3F3] p-4 sm:p-5',
        className,
      )}
    >
      {title ? (
        <div className="relative mb-4 flex flex-wrap items-center gap-3">
          {Icon ? <Icon3D flat icon={Icon} tone="green" size="md" /> : null}
          <div className="min-w-0">
            <h2 className="break-words text-[17px] font-bold text-[#111111]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-[#666666]">{subtitle}</p> : null}
          </div>
          {action ? <div className="ml-auto shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}

/** Field wrapper adding a leading icon inside a COMPACT/ICON_INPUT_CLS box — visual only, the wrapped input's value/onChange/validation are untouched. */
function IconField({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111111]/70" aria-hidden="true" />
      {children}
    </div>
  );
}

function FormField({ label, required, error, fieldRef, className, children }) {
  return (
    <div ref={fieldRef} className={className}>
      <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wide text-[#666666]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * Customer Name input with a "previous customers" type-ahead — see the file
 * header comment for what `directory` actually is (derived from this shop's
 * own booking history, not a real backend search) and its limits. Typing
 * always still just edits the plain text value like a normal input; the
 * dropdown is purely an optional shortcut, never required.
 */
/**
 * Partner App Customer Details search: find a customer who has booked here
 * before by mobile number or name (the shop's own bookings directory). A full
 * 10-digit number with no match is a new customer — "Use" puts it in Mobile.
 */
function CustomerSearch({ directory, onPick, onNewNumber }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '');
  const matches =
    term.length >= 2
      ? directory
          .filter((c) => String(c.name || '').toLowerCase().includes(term) || (digits.length >= 3 && String(c.phone || '').replace(/\D/g, '').includes(digits)))
          .slice(0, 6)
      : [];
  return (
    <div>
      <label className="flex h-11 items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 focus-within:border-[#035C6C]">
        <Search className="h-[18px] w-[18px] shrink-0 text-[#6B7280]" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 40))}
          placeholder="Search by mobile number or name"
          aria-label="Search customer by mobile number or name"
          className="min-w-0 flex-1 bg-transparent text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] sm:text-sm"
        />
        {q ? (
          <button type="button" onClick={() => setQ('')} aria-label="Clear search" className={cx('rounded-full p-0.5 text-[#6B7280]', FOCUS_RING)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </label>

      {matches.length ? (
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {matches.map((c) => (
            <button
              key={`${c.phone}-${c.name}`}
              type="button"
              onClick={() => {
                onPick(c);
                setQ('');
              }}
              aria-label={`Use ${c.name || 'customer'}`}
              className={cx('flex min-h-[52px] items-center gap-2.5 rounded-xl border border-[#C7E6EA] bg-white px-3 text-left transition hover:bg-[#F8FBFB]', FOCUS_RING)}
            >
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#E5F3F5]">
                <User className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-extrabold text-[#111111]">{c.name || 'Customer'}</span>
                <span className="block truncate text-[12px] text-[#6B7280]">{c.phone}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#609138]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#4B7A2B]">
                <Check className="h-[11px] w-[11px]" strokeWidth={3} aria-hidden="true" />
                Existing
              </span>
            </button>
          ))}
        </div>
      ) : term.length >= 2 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-[#035C6C]">
          <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New customer — enter the details below</span>
          {/^\d{10}$/.test(term) ? (
            <button
              type="button"
              onClick={() => {
                onNewNumber(term);
                setQ('');
              }}
              className={cx('rounded-full bg-[#035C6C] px-2.5 py-0.5 text-[11.5px] font-bold text-white', FOCUS_RING)}
            >
              Use {term}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CustomerNameField({ value, onChangeText, directory, onPick }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = value.trim().toLowerCase();
  const matches = q.length >= 2 ? directory.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6) : [];

  return (
    <div ref={wrapRef} className="relative">
      <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#035C6C]" aria-hidden="true" />
      <input
        className={ICON_INPUT_CLS}
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Full name"
        autoComplete="off"
      />
      {open && matches.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+0.25rem)] z-30 w-full min-w-[260px] rounded-xl border border-[#ECECEC] bg-white p-1.5 shadow-[0_12px_28px_rgba(16,24,40,0.12)]">
          <p className="px-2 pb-1 pt-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#98A2B3]">Previous customers</p>
          {matches.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[#F8F8F8]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[10px] font-bold text-[#035C6C]">
                {initials(c.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[#111111]">{c.name}</span>
                <span className="block truncate text-xs text-[#666666]">
                  {c.phone || 'No phone'} · {c.totalBookings} booking{c.totalBookings === 1 ? '' : 's'}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function addressFieldsFrom(booking) {
  const a = booking?.pickupAddress;
  if (!a) return null;
  return {
    addressLine: a.addressLine || '',
    landmark: a.landmark || '',
    pincode: a.pincode || '',
    city: a.city || '',
    district: a.district || '',
    state: a.state || '',
  };
}

/**
 * Fixed-size device/brand image box. The box (inline-flex, so `size` applies
 * wherever it's placed — not only as a flex child) bounds the image, and the
 * image is capped at the box with object-contain, so a large brand logo can
 * never render at its own file dimensions. Missing/broken → device icon.
 */
function Thumb({ url, name, size = 'h-7 w-7' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [url]);
  const src = resolveMediaUrl(url);
  return src && !broken ? (
    <span className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#ECECEC] bg-white p-0.5', size)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- master-data brand/model images, remote S3 URLs. */}
      <img src={src} alt={name || ''} onError={() => setBroken(true)} className="block h-full max-h-full w-full max-w-full object-contain" />
    </span>
  ) : (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-lg border border-[#ECECEC] bg-[#F8F8F8] text-[#98A2B3]', size)}>
      <Smartphone className="h-1/2 w-1/2" aria-hidden="true" />
    </span>
  );
}

/** Device Details picker card image: the master-data image (contained), or the name's initials. */
/* ---- Device Details pieces (Partner App DeviceDetailsScreen method) ---- */

function DeviceField({ label, required = false, optional = false, children }) {
  return (
    <div>
      <p className="mb-2 text-[13.5px] font-bold text-[#111111]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
        {optional ? <span className="font-medium text-[#9CA3AF]"> (optional)</span> : null}
      </p>
      {children}
    </div>
  );
}

function TickBadge() {
  return (
    <span className="absolute right-1.5 top-1.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#035C6C] text-white" aria-hidden="true">
      <Check className="h-[11px] w-[11px]" strokeWidth={3} />
    </span>
  );
}

function OtherIcon() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-[#035C6C]">
      <Plus className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

/** A picker tile: image/icon over a two-line label; the picked one gets a ✓. */
function OptionCard({ on, onClick, label, className, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'relative flex min-h-[96px] min-w-0 flex-col items-center justify-center gap-2 rounded-[14px] border px-2 py-3 text-center transition',
        FOCUS_RING,
        on ? 'border-[1.5px] border-[#035C6C] bg-[#E5F3F5]' : 'border-[#E5E7EB] bg-white hover:border-[#035C6C]/50',
        className,
      )}
    >
      {on ? <TickBadge /> : null}
      {children}
      <span className={cx('line-clamp-2 break-words text-[12.5px] leading-tight', on ? 'font-bold text-[#024A57]' : 'font-medium text-[#111111]')}>{label}</span>
    </button>
  );
}

/** A colour / storage option tile. */
function ChipTile({ on, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[13px] transition',
        FOCUS_RING,
        on ? 'border-[1.5px] border-[#035C6C] bg-[#E5F3F5] font-bold text-[#024A57]' : 'border-[#E5E7EB] bg-white font-medium text-[#111111] hover:border-[#035C6C]/50',
      )}
    >
      {children}
    </button>
  );
}

/** A picked level, folded: image, name, and Change to re-open its list. */
function PickedCard({ image, title, subtitle, onChange, wide = false }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#035C6C] bg-[#E5F3F5] p-3">
      <span className={cx('flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white', wide ? 'h-14 w-28 px-2' : 'h-14 w-14')}>
        <PickImage url={image} name={title} className={wide ? 'h-11 w-full' : 'h-12 w-12'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-[#111111]">{title}</p>
        {subtitle ? <p className="truncate text-xs text-[#6B7280]">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={cx('inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[#C7E6EA] bg-white px-3.5 text-[13px] font-bold text-[#035C6C] transition hover:border-[#035C6C]', FOCUS_RING)}
      >
        Change
      </button>
    </div>
  );
}

/** The "Other" popup: type a value that isn't in the list. */
function TypeSheet({ sheet, onClose }) {
  const [value, setValue] = useState(sheet.initial || '');
  const done = (e) => {
    e.preventDefault();
    const t = value.trim();
    if (!t) return;
    sheet.onDone(t);
    onClose();
  };
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={sheet.title} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={done}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <p className="text-[16px] font-extrabold text-[#111111]">{sheet.title}</p>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the popup exists only to take this one value. */}
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={sheet.placeholder}
          aria-label={sheet.title}
          maxLength={60}
          className="mt-3 h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C] sm:text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cx('h-10 rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#111111]', FOCUS_RING)}>
            Cancel
          </button>
          <button type="submit" disabled={!value.trim()} className={cx('h-10 rounded-xl bg-[#035C6C] px-5 text-sm font-bold text-white disabled:opacity-50', FOCUS_RING)}>
            Use
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function PickImage({ url, name, className }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [url]);
  return url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element -- master-data category/brand/model images, remote S3 URLs.
    <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className={cx('object-contain', className)} />
  ) : (
    <span className={cx('flex items-center justify-center rounded-xl bg-[#F3F3F3] text-sm font-bold text-[#035C6C]', className)}>{initials(name)}</span>
  );
}

function ColorSwatch({ hex, size = 'h-7 w-7' }) {
  return <span className={cx('shrink-0 rounded-full border border-[#ECECEC]', size)} style={{ backgroundColor: hex }} aria-hidden="true" />;
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MO_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const pad2 = (n) => String(n).padStart(2, '0');
const fmtChipDate = (d) => `${DOW_SHORT[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`;
const fmtChipTime = (d) => {
  const h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad2(d.getMinutes())} ${ap}`;
};
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

// Estimated Delivery's Duration presets (in minutes, so "30 min" and a
// Custom hours+minutes value both fit the same unit) — picking one sets
// draftDurationMinutes directly; Ready By (Received + this duration) is
// always recomputed from it, never stored separately.
const DURATION_PRESETS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hr' },
  { minutes: 120, label: '2 hr' },
  { minutes: 180, label: '3 hr' },
  { minutes: 240, label: '4 hr' },
  { minutes: 360, label: '6 hr' },
  { minutes: 480, label: '8 hr' },
  { minutes: 720, label: '12 hr' },
  { minutes: 1440, label: '24 hr' },
];

function durationLabel(minutes) {
  const preset = DURATION_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Full weeks (leading/trailing days from the adjacent month included, greyed out) for a calendar-grid month view. */
function buildCalendarGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, nextDay), inMonth: false });
    nextDay += 1;
  }
  return cells;
}

/** "1 hr 59 min from now" / "2 days ago" / "now" — no date library in this project, so this is plain arithmetic. */
function relativeFromNow(target, now) {
  const diffMs = target.getTime() - now.getTime();
  const past = diffMs < 0;
  const totalMins = Math.round(Math.abs(diffMs) / 60000);
  if (totalMins < 1) return 'now';
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  let label;
  if (days > 0) label = `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours} hr` : ''}`;
  else if (hours > 0) label = `${hours} hr${mins ? ` ${mins} min` : ''}`;
  else label = `${mins} min`;
  return `${label} ${past ? 'ago' : 'from now'}`;
}

/**
 * "Ready By" date+time picker for Estimated Delivery — a month calendar
 * (past days disabled, since a device can't be ready before now) plus
 * Hour/Minute/AM-PM selects and a live "picked date/time · relative to now"
 * summary, modeled on a reference design. `value`/`onChange` are a plain
 * Date, same as the state this replaced (draftReadyBy) — this component
 * owns no state of the actual value, only which month is currently shown.
 */
function ReadyByPicker({ value, onChange }) {
  const [viewDate, setViewDate] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const now = new Date();
  const today = startOfDay(now);
  const isCurrentMonth = viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();

  const cells = useMemo(() => buildCalendarGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);

  const goPrevMonth = () => setViewDate((d) => (isCurrentMonth ? d : new Date(d.getFullYear(), d.getMonth() - 1, 1)));
  const goNextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const pickDate = (date) => {
    if (startOfDay(date) < today) return;
    const next = new Date(value);
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    onChange(next);
    if (date.getMonth() !== viewDate.getMonth() || date.getFullYear() !== viewDate.getFullYear()) {
      setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const hour24 = value.getHours();
  const minute = value.getMinutes();
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setTime = (nextHour12, nextMinute, nextAmPm) => {
    const h = (nextHour12 % 12) + (nextAmPm === 'PM' ? 12 : 0);
    const next = new Date(value);
    next.setHours(h, nextMinute, 0, 0);
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          disabled={isCurrentMonth}
          aria-label="Previous month"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#344054] transition sm:h-8 sm:w-8 hover:bg-[#F8F8F8] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className="text-sm font-bold text-[#111111]">
          {MO_FULL[viewDate.getMonth()]}, {viewDate.getFullYear()}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Next month"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#344054] transition sm:h-8 sm:w-8 hover:bg-[#F8F8F8]"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center">
        {DOW_SHORT.map((d) => (
          <span key={d} className="text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">
            {d}
          </span>
        ))}
        {cells.map(({ date, inMonth }) => {
          const disabled = startOfDay(date) < today;
          const selected = sameDay(date, value);
          const isToday = sameDay(date, now);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => pickDate(date)}
              disabled={disabled}
              className={cx(
                'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition sm:h-8 sm:w-8',
                selected
                  ? 'bg-[#035C6C] text-white'
                  : disabled
                    ? 'cursor-not-allowed text-[#D0D5DD]'
                    : !inMonth
                      ? 'text-[#98A2B3] hover:bg-[#F8F8F8]'
                      : isToday
                        ? 'text-[#035C6C] hover:bg-[#F8F8F8]'
                        : 'text-[#111111] hover:bg-[#F8F8F8]',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">Hour</p>
          <select
            aria-label="Ready by hour"
            className="w-full rounded-lg border border-[#D0D5DD] bg-[#F3F3F3] px-2.5 py-2 text-base font-semibold text-[#111111] focus:outline-none sm:text-sm focus:ring-2 focus:ring-[#ECECEC]"
            value={hour12}
            onChange={(e) => setTime(Number(e.target.value), minute, ampm)}
          >
            {HOURS_12.map((h) => (
              <option key={h} value={h}>
                {pad2(h)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">Minute</p>
          <select
            aria-label="Ready by minute"
            className="w-full rounded-lg border border-[#D0D5DD] bg-[#F3F3F3] px-2.5 py-2 text-base font-semibold text-[#111111] focus:outline-none sm:text-sm focus:ring-2 focus:ring-[#ECECEC]"
            value={minute}
            onChange={(e) => setTime(hour12, Number(e.target.value), ampm)}
          >
            {MINUTES_60.map((m) => (
              <option key={m} value={m}>
                {pad2(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">AM / PM</p>
          <select
            aria-label="Ready by AM or PM"
            className="w-full rounded-lg border border-[#D0D5DD] bg-[#F3F3F3] px-2.5 py-2 text-base font-semibold text-[#111111] focus:outline-none sm:text-sm focus:ring-2 focus:ring-[#ECECEC]"
            value={ampm}
            onChange={(e) => setTime(hour12, minute, e.target.value)}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#F8F8F8] px-4 py-3">
        <p className="text-sm font-bold text-[#035C6C]">
          {DOW_SHORT[value.getDay()]}, {value.getDate()} {MO[value.getMonth()]} – {hour12}:{pad2(minute)} {ampm}
        </p>
        <p className="text-xs text-[#5C8F74]">{relativeFromNow(value, now)}</p>
      </div>
    </div>
  );
}

/**
 * Shared date+time bottom sheet — wraps ReadyByPicker (the same calendar +
 * Hour/Minute/AM-PM controls Estimated Delivery has always used) in a
 * modal, with its own draft state so opening it, poking around the
 * calendar, then dismissing (backdrop tap) never touches the committed
 * value until the confirm button is pressed. Used for BOTH Received and
 * Ready By — one picker implementation, not two — with the caller
 * supplying the copy and deciding what committing the draft actually means
 * (setDraftReceivedAt directly for Received; back-computing Duration for
 * Ready By, since Ready By itself is a derived value with no state of its
 * own — see draftReadyBy's useMemo below).
 */
function DateTimeSheet({ title, description, confirmLabel, initialValue, onConfirm, onClose }) {
  const [draft, setDraft] = useState(initialValue);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[#EAECF0] sm:hidden" />
        <h2 className="text-lg font-bold text-[#111111]">{title}</h2>
        <p className="mt-1 text-sm text-[#666666]">{description}</p>

        <div className="mt-4">
          <ReadyByPicker value={draft} onChange={setDraft} />
        </div>

        <button
          type="button"
          onClick={() => onConfirm(draft)}
          className={cx('mt-4 w-full rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A]', FOCUS_RING)}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * "Duration" bottom sheet — a preset grid (DURATION_PRESETS) plus a Custom
 * hours+minutes pair. Picking a preset applies it immediately; Custom needs
 * "Apply" since it's two number inputs, not one tap.
 */
function DurationSheet({ initialMinutes, onConfirm, onClose }) {
  const isPreset = DURATION_PRESETS.some((p) => p.minutes === initialMinutes);
  const [mode, setMode] = useState(isPreset ? 'preset' : 'custom');
  const [customHours, setCustomHours] = useState(Math.floor(initialMinutes / 60));
  const [customMinutes, setCustomMinutes] = useState(initialMinutes % 60);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[#EAECF0] sm:hidden" />
        <h2 className="text-lg font-bold text-[#111111]">Duration</h2>
        <p className="mt-1 text-sm text-[#666666]">How long will this repair take?</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.minutes}
              type="button"
              onClick={() => onConfirm(p.minutes)}
              className={cx(
                'rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                mode === 'preset' && initialMinutes === p.minutes
                  ? 'border-[#035C6C] bg-[#F8F8F8] text-[#035C6C]'
                  : 'border-[#ECECEC] text-[#344054] hover:border-[#ECECEC]',
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={cx(
              'rounded-xl border px-3 py-2.5 text-sm font-bold transition',
              mode === 'custom' ? 'border-[#035C6C] bg-[#F8F8F8] text-[#035C6C]' : 'border-[#ECECEC] text-[#344054] hover:border-[#ECECEC]',
            )}
          >
            Custom
          </button>
        </div>

        {mode === 'custom' ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">Hours</p>
              <input
                type="number"
                min={0}
                max={999}
                value={customHours}
                onChange={(e) => setCustomHours(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-[#D0D5DD] bg-[#F3F3F3] px-2.5 py-2 text-base font-semibold text-[#111111] focus:outline-none sm:text-sm focus:ring-2 focus:ring-[#ECECEC]"
              />
            </div>
            <div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">Minutes</p>
              <input
                type="number"
                min={0}
                max={59}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                className="w-full rounded-lg border border-[#D0D5DD] bg-[#F3F3F3] px-2.5 py-2 text-base font-semibold text-[#111111] focus:outline-none sm:text-sm focus:ring-2 focus:ring-[#ECECEC]"
              />
            </div>
            <button
              type="button"
              onClick={() => onConfirm(Math.max(1, customHours * 60 + customMinutes))}
              className={cx('col-span-2 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A]', FOCUS_RING)}
            >
              Apply
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Record Voice Note — a real recorder built on the browser's own
 * MediaRecorder/getUserMedia APIs (no library, nothing to install; both are
 * standard in every evergreen browser). There is no backend field or
 * upload endpoint for a booking's voice note anywhere in this codebase
 * (confirmed — same investigation noted near the top of this file), so —
 * same "estimate only" treatment as Estimated Delivery and Customer repair
 * approval above — the clip lives only in memory (an object URL) and is
 * never submitted with the booking. If a real voice-note upload endpoint is
 * ever added, this is the one place a fetch call would be wired in.
 *
 * The recorder state is a hook the page owns (not state inside the card),
 * so moving between wizard steps — which unmounts the card — keeps the
 * clip, and even an in-progress recording; it is discarded only on
 * delete/re-record, Reset / "Add another device", or leaving the page.
 */
function useVoiceNote() {
  const [status, setStatus] = useState('idle'); // idle | recording | recorded
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioUrlRef = useRef('');
  audioUrlRef.current = audioUrl;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      stopStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // A clear() while recording detaches the recorder first, so its
        // late onstop can't resurrect the discarded clip.
        if (mediaRecorderRef.current !== recorder) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setStatus('recorded');
        stopStream();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setStatus('recording');
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      notifyError('Microphone access was denied or is unavailable.');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  function clear() {
    clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stopStream();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    setAudioUrl('');
    setStatus('idle');
    setSeconds(0);
  }

  return { status, seconds, audioUrl, startRecording, stopRecording, clear };
}

/**
 * The voice-note UI inside the Issue Description & Voice Note card; `voice`
 * is useVoiceNote()'s value. `readOnly` (the Device Info tab's summary)
 * drops Record/Stop/Delete and keeps only playback.
 */
function VoiceNoteCard({ voice, readOnly = false }) {
  const { status, seconds, audioUrl, startRecording, stopRecording, clear: deleteRecording } = voice;
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElRef = useRef(null);

  function togglePlay() {
    const el = audioElRef.current;
    if (!el) return;
    if (isPlaying) el.pause();
    else el.play();
  }

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div>
      {status === 'idle' && readOnly ? (
        <p className="rounded-xl bg-[#F8F8F8] px-4 py-3 text-sm text-[#98A2B3]">No voice note recorded.</p>
      ) : status === 'idle' ? (
        <button
          type="button"
          onClick={startRecording}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#F3BF23] px-4 py-3.5 text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A]"
        >
          <Mic className="h-[18px] w-[18px]" aria-hidden="true" />
          Record voice note
        </button>
      ) : status === 'recording' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-red-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
              Recording…
            </span>
            <span className="text-sm font-bold text-red-600">{fmt(seconds)}</span>
          </div>
          {readOnly ? null : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-red-700"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop recording
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-[#F8F8F8] px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#035C6C]">
              <Music2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#111111]">Voice Note</p>
              <p className="text-xs text-[#666666]">{fmt(seconds)}</p>
            </div>
          </div>
          <div className={cx('grid gap-2', readOnly ? 'grid-cols-1' : 'grid-cols-2')}>
            <button
              type="button"
              onClick={togglePlay}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm font-bold text-[#035C6C] transition hover:bg-[#F8F8F8]"
            >
              {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            {readOnly ? null : (
              <button
                type="button"
                onClick={deleteRecording}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
          <audio
            ref={audioElRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Device Files slots — the Partner app's DeviceInformationScreen SLOTS:
 * Front + Back photos are required, the full-coverage video is optional.
 * `key` is the media-upload slot and the devicePhotosJson key
 * ({front, back, video}, the shape the app writes); `field` is the form field.
 */
const DEVICE_FILE_SLOTS = [
  { key: 'front', field: 'frontImageUrl', label: 'Front Side', required: true },
  { key: 'back', field: 'backImageUrl', label: 'Back Side', required: true },
  { key: 'video', field: 'videoUrl', label: 'Full Coverage', video: true },
];

/**
 * One Device Files tile — a hidden file input behind a dashed "+ Add"
 * button, or the uploaded thumbnail (or video frame) with a remove button
 * and an "Added" badge once one exists. The label sits below the tile, as in
 * the app. The browser's own file picker already offers Camera vs Library on
 * mobile, so there's no separate "choose upload method" control to build.
 */
function PhotoTile({ slot, url, uploading, invalid, fieldRef, onUpload, onRemove }) {
  const inputRef = useRef(null);
  const Icon = slot.video ? Video : ImageIcon;
  return (
    <div ref={fieldRef} className="flex min-w-0 flex-col items-center">
      <input
        ref={inputRef}
        type="file"
        accept={slot.video ? 'video/mp4,video/quicktime,video/webm' : 'image/*'}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
      {url ? (
        <div className="relative h-28 w-full overflow-hidden rounded-2xl border-2 border-[#035C6C] bg-[#E5F3F5]">
          {slot.video ? (
            <>
              {/* #t=0.1 makes the browser paint a frame instead of a blank box. */}
              <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 text-white">
                <Video className="h-6 w-6" aria-hidden="true" />
                <span className="mt-1 text-[9px] font-extrabold tracking-widest">VIDEO</span>
              </span>
            </>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- shop-uploaded device photo, remote media URL. */
            <img src={url} alt={slot.label} className="h-full w-full object-cover" />
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${slot.label}`}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#035C6C] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">
            <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" /> Added
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={`Add ${slot.label}${slot.video ? ' video' : ' photo'}`}
          className={cx(
            'flex h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed transition disabled:cursor-not-allowed',
            FOCUS_RING,
            invalid ? 'border-red-300 bg-red-50/40' : 'border-[#D0D5DD] bg-[#F8F8F8] hover:border-[#035C6C]/60',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-[#035C6C]" aria-hidden="true" />
              <span className="mt-2 text-xs font-semibold text-[#98A2B3]">Uploading…</span>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#035C6C] shadow-sm">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-extrabold text-[#035C6C]">
                <Plus className="h-3 w-3" aria-hidden="true" /> Add
              </span>
            </>
          )}
        </button>
      )}
      <p className="mt-1.5 text-center text-[13px] font-bold text-[#111111]">
        {slot.label}
        {slot.required ? <span className="text-red-500"> *</span> : null}
      </p>
    </div>
  );
}

/**
 * One "Add Issue / Service" accordion row — a real repair category (from
 * relevantRepairCategories) plus its real services (from repairServices,
 * grouped by categoryId). Selection state is the page's own
 * form.serviceIds/toggleService, unchanged; this component only owns
 * whether it's expanded.
 */
function IssueCategoryRow({
  category,
  services,
  expanded,
  onToggleExpand,
  selectedIds,
  onToggleService,
  draftPrices,
  draftWarranty,
  onDraftPriceChange,
  onDraftWarrantyChange,
}) {
  const Icon = iconForRepairCategory(category.displayName || category.name);
  const selectedCount = services.filter((s) => selectedIds.includes(s.id)).length;
  const name = category.displayName || category.name || 'Repair Category';

  return (
    <div className="self-start overflow-hidden rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] transition">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className={cx('flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition', expanded ? 'bg-[#F3F3F3]' : 'hover:bg-[#F3F3F3]')}
      >
        <span
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition',
            selectedCount > 0 ? 'bg-[#035C6C] text-white' : 'bg-[#F8F8F8] text-[#035C6C]',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-[#111111]">{name}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#666666]">
            {services.length} option{services.length === 1 ? '' : 's'}
            {selectedCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-[#F8F8F8] px-2 py-0.5 text-[0.68rem] font-bold text-[#035C6C]">
                {selectedCount} selected
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform duration-200', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      <div className={cx('grid transition-all duration-200 ease-out', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-dashed border-[#ECECEC] px-3 py-3">
            {services.length === 0 ? (
              <p className="text-xs text-[#98A2B3]">No services listed under this category yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {services.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  const ServiceIcon = iconForRepairService(s.name, name);
                  return (
                    <div
                      key={s.id}
                      className={cx(
                        'overflow-hidden rounded-xl border transition',
                        checked ? 'border-[#035C6C] bg-[#F8F8F8]' : 'border-[#ECECEC] bg-white hover:border-[#ECECEC]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className={cx('flex min-w-0 items-center gap-2.5 text-sm font-semibold', checked ? 'text-[#035C6C]' : 'text-[#344054]')}>
                          <span
                            className={cx(
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                              checked ? 'bg-[#035C6C] text-white' : 'bg-[#F3F3F3] text-[#035C6C]',
                            )}
                          >
                            <ServiceIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="truncate">{s.name}</span>
                          {checked ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleService(s.id)}
                          aria-pressed={checked}
                          className={cx(
                            'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition',
                            checked
                              ? 'border border-[#D0D5DD] bg-white text-[#666666] hover:border-red-300 hover:bg-red-50 hover:text-red-600'
                              : 'bg-[#035C6C] text-white hover:bg-[#035C6C]',
                            FOCUS_RING,
                          )}
                        >
                          {checked ? (
                            <>
                              <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
                            </>
                          )}
                        </button>
                      </div>

                      {checked ? (
                        <div className="space-y-3 border-t border-dashed border-[#ECECEC] bg-white px-3.5 py-3.5">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-end">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[#344054]" htmlFor={`svc-price-${s.id}`}>
                                Price
                              </label>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#98A2B3]">₹</span>
                                <input
                                  id={`svc-price-${s.id}`}
                                  type="number"
                                  min="0"
                                  inputMode="decimal"
                                  value={draftPrices[s.id] || ''}
                                  onChange={(e) => onDraftPriceChange(s.id, e.target.value)}
                                  placeholder="0"
                                  className={cx(COMPACT_INPUT_CLS, 'h-10 pl-7 text-sm font-semibold text-[#111111]')}
                                />
                              </div>
                            </div>
                            <div>
                              <p className="mb-1.5 text-xs font-semibold text-[#344054]">Warranty</p>
                              <div className="flex flex-wrap gap-1.5">
                                {WARRANTY_OPTIONS.map((months) => {
                                  const active = draftWarranty[s.id] === months;
                                  return (
                                    <button
                                      key={months}
                                      type="button"
                                      onClick={() => onDraftWarrantyChange(s.id, months)}
                                      aria-pressed={active}
                                      className={cx(
                                        'h-10 rounded-full border px-3.5 text-xs font-bold transition',
                                        active ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#ECECEC]',
                                      )}
                                    >
                                      {months} Months
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <p className="flex items-center gap-1.5 text-[0.7rem] text-[#98A2B3]">
                            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" /> Price adds to Service Charge on the total. Warranty is a note only, not saved.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookServicePage() {
  // The ACTIVE shop — the JWT session's shopId (the shop an owner switched to,
  // or a shop login's own shop) — and that shop's own public record. Not the
  // owner's first location, and never the owner's personal profile/phone.
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState('');
  const [shopId, setShopId] = useState(null);

  useEffect(() => {
    let alive = true;
    const activeShopId = readShopOwner()?.shopId || null;
    setShopId(activeShopId);
    if (!activeShopId) {
      setProfileError('Could not identify your shop. Please sign in again.');
      return undefined;
    }
    getShopPublic(activeShopId).then((data) => {
      if (!alive) return;
      if (data) setProfile(data);
      else setProfileError('Could not load your shop profile.');
    });
    return () => {
      alive = false;
    };
  }, []);

  const [activeSection, setActiveStep] = useState('customer');
  // Folded parts of Devices & Repair (Security Lock, Missing Parts).
  const [openFolds, setOpenFolds] = useState({});
  // Accepts a step OR a part key (validation jumps, "Add Service"): lands on
  // the part's step, unfolds it if folded, and scrolls to it.
  const setActiveSection = (key) => {
    if (FOLD_PARTS.includes(key)) setOpenFolds((o) => ({ ...o, [key]: true }));
    setActiveStep(STEP_OF[key] || key);
    if (STEP_OF[key] && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => document.getElementById(`bs-part-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };
  // A rule failed inside a closed fold: open it, then focus once it renders.
  const revealFoldedError = (field) => {
    const part = sectionForField(field);
    if (!FOLD_PARTS.includes(part) || openFolds[part]) return false;
    setActiveSection(part);
    setPendingFocusField(field);
    return true;
  };
  // Moved up from just above the JSX return (where it originally lived,
  // right before sectionContent) so section consts defined further down —
  // e.g. deviceSecuritySection's Continue button — can call goNext(). Pure
  // navigation helpers, unrelated to why they were originally placed later.
  const activeIndex = SECTIONS.findIndex((s) => s.key === activeSection);
  const goPrev = () => activeIndex > 0 && setActiveSection(SECTIONS[activeIndex - 1].key);
  // Gated: validates only the CURRENT section's own required fields before
  // advancing (tab-bar clicks below stay free-jump — this is an internal
  // staff tool, not a public form, and the final submit() re-validates
  // everything regardless of which tab was used to get there). On failure,
  // sets that section's field errors and focuses the first invalid one
  // instead of moving to the next tab.
  const goNext = () => {
    if (activeIndex >= SECTIONS.length - 1) return;
    if (SECTIONS[activeIndex + 1].key === 'confirmation' && !confirmed) return;
    const { errors, firstErrorField, isValid } = validateSection(activeSection);
    if (!isValid) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      if (revealFoldedError(firstErrorField)) {
        notifyError(errors[firstErrorField]);
        return;
      }
      // A rule with no on-screen field (e.g. "select a service") shows as a toast.
      if (!fieldRefs.current?.[firstErrorField]) notifyError(errors[firstErrorField]);
      focusField(fieldRefs, firstErrorField);
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      Object.keys(schemaFor(activeSection)).forEach((key) => {
        delete next[key];
      });
      return next;
    });
    setActiveSection(SECTIONS[activeIndex + 1].key);
  };

  // Top stepper tab click — previously a free jump to any tab regardless of
  // validation. Backward/same-step clicks stay free (no re-validation
  // needed to look at a step you already filled in). A forward click,
  // though, must pass the exact same per-section required-field rules
  // goNext() above already enforces for every section it would skip over
  // (clicking Step 4 from Step 1 must not bypass Steps 2 and 3's required
  // fields) — reusing validateSection()/SECTION_VALIDATORS, not a second
  // validation system. The first section that fails blocks the jump: if
  // it's the section already on screen we just show its errors and focus
  // the field (mirrors goNext()'s own behavior); if it's a later section
  // the user tried to skip past, we move there instead of silently doing
  // nothing, using the same jump-to-first-error convention submit() below
  // already relies on.
  const handleTabClick = (targetKey) => {
    const targetIndex = SECTIONS.findIndex((s) => s.key === targetKey);
    if (targetIndex <= activeIndex) {
      setActiveSection(targetKey);
      return;
    }
    for (let i = activeIndex; i < targetIndex; i += 1) {
      const sectionKey = SECTIONS[i].key;
      const { errors, firstErrorField, isValid } = validateSection(sectionKey);
      if (!isValid) {
        setFieldErrors((prev) => ({ ...prev, ...errors }));
        if (sectionKey === activeSection) {
          if (revealFoldedError(firstErrorField)) notifyError(errors[firstErrorField]);
          else {
            if (!fieldRefs.current?.[firstErrorField]) notifyError(errors[firstErrorField]);
            focusField(fieldRefs, firstErrorField);
          }
        } else {
          setActiveSection(sectionKey);
          setPendingFocusField(firstErrorField);
        }
        return;
      }
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (let i = activeIndex; i < targetIndex; i += 1) {
        Object.keys(schemaFor(SECTIONS[i].key)).forEach((key) => {
          delete next[key];
        });
      }
      return next;
    });
    // Confirmation only opens once Devices List is finished — i.e. submit()
    // has created the booking and set `confirmed`. devicesList has no
    // required fields of its own, so the loop above alone would let a tab
    // click land on an empty Confirmation; send the user to Devices List
    // to submit instead.
    if (targetKey === 'confirmation' && !confirmed) {
      setActiveSection('devicesList');
      notifyError('Submit the booking from Review & Confirm to continue');
      return;
    }
    setActiveSection(targetKey);
  };

  // Tab bar auto-scroll — keyed by section, one entry set per rendered step
  // button (see the tab bar's ref callback below). Whenever the active step
  // changes (a tab click, goPrev/goNext, or a validation-error jump via
  // sectionForError), scroll that button into view so switching steps from
  // a Previous/Next button or an off-screen tab never leaves the highlighted
  // step scrolled out of sight.
  const tabRefs = useRef({});
  useEffect(() => {
    tabRefs.current[activeSection]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeSection]);

  // Focuses + smooth-scrolls a field that failed validation, once the
  // section it belongs to has actually switched and rendered (a raw
  // setTimeout after setActiveSection risks running before the new
  // section's inputs exist in the DOM; this effect fires after React has
  // committed the re-render for the new activeSection).
  const [pendingFocusField, setPendingFocusField] = useState(null);
  useEffect(() => {
    if (!pendingFocusField) return;
    focusField(fieldRefs, pendingFocusField);
    setPendingFocusField(null);
  }, [activeSection, pendingFocusField]);

  const [form, setForm] = useState(EMPTY_FORM);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const needsAddress = form.serviceMode !== 'WALK_IN';

  /* ---- Previous-customer type-ahead (Customer Name) — see file header ---- */
  const [directoryBookings, setDirectoryBookings] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchShopBookings()
      .then((rows) => alive && setDirectoryBookings(rows))
      .catch(() => {}); // Non-fatal: the plain Customer Name field still works with no directory loaded.
    return () => {
      alive = false;
    };
  }, []);

  const customerDirectory = useMemo(() => deriveCustomers(directoryBookings), [directoryBookings]);
  // Partner App "More Details (Optional)" fold: Email + address.
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);

  const pickExistingCustomer = (customer) => {
    const address = addressFieldsFrom(customer.addressBooking);
    setForm((f) => ({
      ...f,
      customerName: customer.name,
      customerMobile: toTenDigitMobile(customer.phone) || f.customerMobile,
      customerEmail: customer.email || f.customerEmail,
      ...(address || {}),
    }));
    notifySuccess(
      address
        ? `Loaded ${customer.name}'s details and their last pickup address.`
        : `Loaded ${customer.name}'s details. No saved address found for them yet.`,
    );
  };

  /* ---- Device: category -> brand -> model ----
   * Every fetch here used to swallow its own failure silently (`.catch(() =>
   * setX([]))`), which made a genuine network/backend failure indistinguishable
   * from "this shop truly has zero brands" — both just rendered an empty
   * dropdown. Each level now tracks its own error message and exposes a Retry
   * action, so a failed load is visibly different from an honestly-empty one.
   */
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [categoriesRetry, setCategoriesRetry] = useState(0);

  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState('');
  const [brandsRetry, setBrandsRetry] = useState(0);

  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [modelsRetry, setModelsRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setCategoriesLoading(true);
    setCategoriesError('');
    masterApi
      .get('/master/device-categories')
      .then(unwrap)
      .then((rows) => alive && setCategories(Array.isArray(rows) ? rows : []))
      .catch((err) => {
        if (!alive) return;
        setCategories([]);
        setCategoriesError(err?.message || 'Could not load device categories. Check your connection and try again.');
      })
      .finally(() => alive && setCategoriesLoading(false));
    return () => {
      alive = false;
    };
  }, [categoriesRetry]);

  // ImageSelect matches options by `.id`; categories are otherwise keyed by
  // `.code` (form.categoryCode) here, so `id` is remapped to the code for
  // matching while the real entity id survives as `categoryId`.
  const categoryOptions = useMemo(() => categories.map((c) => ({ ...c, id: c.code, categoryId: c.id })), [categories]);

  useEffect(() => {
    if (!form.categoryCode) {
      setBrands([]);
      setBrandsError('');
      return undefined;
    }
    let alive = true;
    setBrandsLoading(true);
    setBrandsError('');
    masterApi
      .get(`/master/categories/by-code/${encodeURIComponent(String(form.categoryCode).toUpperCase())}/brands`)
      .then(unwrap)
      .then((rows) => alive && setBrands(Array.isArray(rows) ? rows : []))
      .catch((err) => {
        if (!alive) return;
        setBrands([]);
        setBrandsError(err?.message || 'Could not load brands for this category. Check your connection and try again.');
      })
      .finally(() => alive && setBrandsLoading(false));
    return () => {
      alive = false;
    };
  }, [form.categoryCode, brandsRetry]);

  useEffect(() => {
    if (!form.brandId) {
      setModels([]);
      setModelsError('');
      return undefined;
    }
    let alive = true;
    setModelsLoading(true);
    setModelsError('');
    masterApi
      .get(`/master/brands/${form.brandId}/models`)
      .then(unwrap)
      .then((rows) => alive && setModels(Array.isArray(rows) ? rows : []))
      .catch((err) => {
        if (!alive) return;
        setModels([]);
        setModelsError(err?.message || 'Could not load models for this brand. Check your connection and try again.');
      })
      .finally(() => alive && setModelsLoading(false));
    return () => {
      alive = false;
    };
  }, [form.brandId, modelsRetry]);

  const categoryModels = useMemo(() => {
    if (!form.categoryId) return models;
    return models.filter((m) => !m.categoryId || m.categoryId === form.categoryId);
  }, [models, form.categoryId]);

  // Device Details visual picker: brand search, model search, series chips
  // (real series from GET /master/brands/{id}/series, matched to models by
  // model.seriesId) and a "show more" limit for long model grids.
  // Partner App method: Category → Brand → Model → Colour / Storage stacked
  // on one screen. A picked level folds to a card; its Change button re-opens
  // that level's list (deviceView). An unpicked level always shows its list.
  const [deviceView, setDeviceView] = useState(null);
  // "Other" popup: { title, placeholder, initial, onDone(text) }.
  const [typeSheet, setTypeSheet] = useState(null);
  const catPicked = Boolean(form.categoryCode);
  const brandPicked = Boolean(form.brandId || (form.customBrand && form.brandName));
  const modelPicked = Boolean(form.modelId || (form.customModel && form.modelName));
  const [brandQuery, setBrandQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('');
  const [modelLimit, setModelLimit] = useState(24);
  const [brandSeries, setBrandSeries] = useState([]);
  useEffect(() => {
    setModelQuery('');
    setSeriesFilter('');
    setModelLimit(24);
    if (!form.brandId) {
      setBrandSeries([]);
      return undefined;
    }
    let alive = true;
    masterApi
      .get(`/master/brands/${form.brandId}/series`)
      .then(unwrap)
      .then((rows) => alive && setBrandSeries(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setBrandSeries([]));
    return () => {
      alive = false;
    };
  }, [form.brandId]);
  useEffect(() => {
    setBrandQuery('');
  }, [form.categoryCode]);

  const visibleBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    return q ? brands.filter((b) => String(b.name || '').toLowerCase().includes(q)) : brands;
  }, [brands, brandQuery]);
  // Only series that actually have models in the chosen category, in the API's order.
  const seriesChips = useMemo(() => {
    const used = new Set(categoryModels.map((m) => m.seriesId).filter(Boolean));
    return brandSeries
      .filter((s) => used.has(s.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  }, [brandSeries, categoryModels]);
  const visibleModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    return categoryModels.filter(
      (m) =>
        (!seriesFilter || m.seriesId === seriesFilter) &&
        (!q || [m.name, ...(Array.isArray(m.modelNumber) ? m.modelNumber : [m.modelNumber])].some((v) => String(v || '').toLowerCase().includes(q))),
    );
  }, [categoryModels, seriesFilter, modelQuery]);

  const selectedModel = useMemo(
    () => categoryModels.find((m) => m.id === form.modelId) || null,
    [categoryModels, form.modelId],
  );
  const selectedBrand = useMemo(() => brands.find((b) => b.id === form.brandId) || null, [brands, form.brandId]);
  // The selected device's image: the model's own photo, then the brand logo
  // only as a fallback (Thumb shows a device icon when neither exists).
  const selectedDeviceImage = selectedModel?.imageUrl || selectedBrand?.imageUrl || null;
  const modelColors = cleanList(selectedModel?.colors);
  const modelVariants = cleanList(selectedModel?.ramStorage);
  // Manufacturer model number(s) (e.g. "A2221"), a real field on the same
  // master-data Model row selectedModel already is (confirmed via the admin
  // Models page, which is the only place it's ever entered) — join() the
  // array the way that page's own read views do, since a model can carry
  // more than one code.
  const modelNumbers = cleanList(selectedModel?.modelNumber);

  // Auto-pick the color when a model only offers exactly one — nothing to
  // choose between, so don't make the shop owner click it manually.
  useEffect(() => {
    const colors = cleanList(selectedModel?.colors);
    if (colors.length === 1) {
      setForm((f) => (f.color === colors[0] ? f : { ...f, color: colors[0] }));
    }
  }, [selectedModel]);

  // Lazy-loaded color→hex cache — see the file header comment on why
  // colorSwatch.js (a ~32k-entry dataset) is dynamically import()ed here
  // instead of a static top-of-file import.
  const [colorHex, setColorHex] = useState({});
  useEffect(() => {
    if (!modelColors.length) return undefined;
    let alive = true;
    import('@/lib/colorSwatch').then(({ guessColorHex }) => {
      if (!alive) return;
      setColorHex((prev) => {
        let changed = false;
        const next = { ...prev };
        modelColors.forEach((name) => {
          if (!(name in next)) {
            next[name] = guessColorHex(name);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    });
    return () => {
      alive = false;
    };
  }, [modelColors]);
  const hexOfColor = (name) => colorHex[name] || '#9CA3AF';

  // Selected-device preview modal — same two-step open/visible fade+scale
  // pattern as the cart page's product-image lightbox (ProductImage in
  // src/app/(customer)/account/cart/page.js), reused here for the "Selected
  // Device" summary card. Reads selectedBrand/selectedModel/form.color/
  // form.variant live, so it always reflects whatever is currently picked —
  // there's no separate snapshot to go stale.
  const [devicePreviewOpen, setDevicePreviewOpen] = useState(false);
  const [devicePreviewVisible, setDevicePreviewVisible] = useState(false);
  // The model the preview shows — opened from the product grid, so the modal
  // offers "Select this product" and prev/next through visibleModels, like
  // the mobile app. (The "Your device" card image is not clickable.)
  const [previewModelId, setPreviewModelId] = useState(null);

  // Zoom/pan for the preview image — mouse wheel, on-screen +/- buttons,
  // keyboard (+/-/0), and click-drag to pan once zoomed in.
  const PREVIEW_MIN_ZOOM = 1;
  const PREVIEW_MAX_ZOOM = 4;
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewDragging, setPreviewDragging] = useState(false);
  const previewDragRef = useRef(null);
  const previewImgWrapRef = useRef(null);

  const zoomPreviewBy = (delta) => {
    setPreviewZoom((z) => {
      const next = Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, +(z + delta).toFixed(2)));
      if (next === PREVIEW_MIN_ZOOM) setPreviewPan({ x: 0, y: 0 });
      return next;
    });
  };
  const zoomPreviewIn = () => zoomPreviewBy(0.5);
  const zoomPreviewOut = () => zoomPreviewBy(-0.5);
  const resetPreviewZoom = () => {
    setPreviewZoom(1);
    setPreviewPan({ x: 0, y: 0 });
  };

  const openDevicePreview = (modelId = null) => {
    resetPreviewZoom();
    setPreviewModelId(modelId);
    setDevicePreviewOpen(true);
    requestAnimationFrame(() => setDevicePreviewVisible(true));
  };
  const previewModel = previewModelId ? categoryModels.find((m) => m.id === previewModelId) || null : selectedModel;
  const previewIndex = previewModelId ? visibleModels.findIndex((m) => m.id === previewModelId) : -1;
  const stepPreview = (dir) => {
    if (previewIndex < 0) return;
    const next = visibleModels[previewIndex + dir];
    if (!next) return;
    resetPreviewZoom();
    setPreviewModelId(next.id);
  };
  // Picking a tile closes that level's list; picking the same tile just closes it.
  const clearDeviceErrors = () =>
    setFieldErrors((prev) => (prev.categoryId || prev.brandId || prev.modelId ? { ...prev, categoryId: undefined, brandId: undefined, modelId: undefined } : prev));
  const pickCategory = (cat) => {
    setDeviceView(null);
    if (form.categoryCode === cat.id) return;
    setForm((fm) => ({ ...fm, categoryCode: cat.id || '', categoryId: cat.categoryId || '', brandId: '', brandName: '', customBrand: false, modelId: '', modelName: '', customModel: false, color: '', variant: '' }));
    clearDeviceErrors();
  };
  const pickBrand = (brand) => {
    setDeviceView(null);
    if (form.brandId === brand.id) return;
    setForm((fm) => ({ ...fm, brandId: brand.id || '', brandName: brand.name || '', customBrand: false, modelId: '', modelName: '', customModel: false, color: '', variant: '' }));
    clearDeviceErrors();
  };
  const pickOtherBrand = (name) => {
    setDeviceView(null);
    setForm((fm) => ({ ...fm, brandId: '', brandName: name, customBrand: true, modelId: '', modelName: '', customModel: false, color: '', variant: '' }));
    clearDeviceErrors();
  };
  const selectModel = (model) => {
    setDeviceView(null);
    if (form.modelId === model.id) return;
    setForm((fm) => ({ ...fm, modelId: model.id || '', modelName: model.name || '', customModel: false, color: '', variant: '' }));
    clearDeviceErrors();
  };
  const pickOtherModel = (name) => {
    setDeviceView(null);
    setForm((fm) => ({ ...fm, modelId: '', modelName: name, customModel: true, color: '', variant: '' }));
    clearDeviceErrors();
  };
  const closeDevicePreview = () => {
    setDevicePreviewVisible(false);
    setTimeout(() => setDevicePreviewOpen(false), 200);
  };
  useEffect(() => {
    if (!devicePreviewOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') closeDevicePreview();
      else if (e.key === 'ArrowLeft') stepPreview(-1);
      else if (e.key === 'ArrowRight') stepPreview(1);
      else if (e.key === '+' || e.key === '=') zoomPreviewIn();
      else if (e.key === '-' || e.key === '_') zoomPreviewOut();
      else if (e.key === '0') resetPreviewZoom();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicePreviewOpen, previewIndex, visibleModels]);

  // Mouse wheel to zoom — attached as a native, non-passive listener so
  // preventDefault() actually stops the page from scrolling behind the
  // modal (React's onWheel is passive by default and can't do that).
  useEffect(() => {
    const el = previewImgWrapRef.current;
    if (!el || !devicePreviewOpen) return undefined;
    function onWheel(e) {
      e.preventDefault();
      zoomPreviewBy(e.deltaY < 0 ? 0.25 : -0.25);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicePreviewOpen]);

  // Pointer gestures for the preview image — one code path for mouse, touch
  // and pen (Android, iOS, Windows touchscreens): two fingers pinch-zoom,
  // one pointer pans once zoomed in, otherwise a horizontal swipe steps to
  // the previous/next model, and a double-tap toggles zoom on touch.
  // Pointer capture keeps the drag following past the image's own edges.
  const previewPointersRef = useRef(new Map());
  const previewLastTapRef = useRef(null);
  const previewLastPointerTypeRef = useRef('mouse');
  const clampPreviewZoom = (z) => Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, +z.toFixed(2)));
  const togglePreviewZoom = () => (previewZoom > PREVIEW_MIN_ZOOM ? resetPreviewZoom() : setPreviewZoom(2.25));
  const startPreviewPan = (x, y) => {
    previewDragRef.current = { type: 'pan', startX: x, startY: y, panX: previewPan.x, panY: previewPan.y };
    setPreviewDragging(true);
  };
  const onPreviewPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    previewLastPointerTypeRef.current = e.pointerType;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const pointers = previewPointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      previewDragRef.current = { type: 'pinch', startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startZoom: previewZoom };
      setPreviewDragging(false);
    } else if (pointers.size === 1) {
      if (previewZoom > PREVIEW_MIN_ZOOM) startPreviewPan(e.clientX, e.clientY);
      else previewDragRef.current = { type: 'swipe', startX: e.clientX, startY: e.clientY };
    }
  };
  const onPreviewPointerMove = (e) => {
    const pointers = previewPointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = previewDragRef.current;
    if (g?.type === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const next = clampPreviewZoom((g.startZoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.startDist);
      setPreviewZoom(next);
      if (next === PREVIEW_MIN_ZOOM) setPreviewPan({ x: 0, y: 0 });
    } else if (g?.type === 'pan') {
      setPreviewPan({ x: g.panX + (e.clientX - g.startX), y: g.panY + (e.clientY - g.startY) });
    }
  };
  const onPreviewPointerEnd = (e) => {
    const pointers = previewPointersRef.current;
    if (!pointers.delete(e.pointerId)) return;
    const g = previewDragRef.current;
    previewDragRef.current = null;
    setPreviewDragging(false);
    if (e.type !== 'pointerup') return;
    if (g?.type === 'swipe') {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        stepPreview(dx < 0 ? 1 : -1);
        return;
      }
      // Touch has no reliable dblclick (iOS Safari), so detect the double-tap here.
      if (e.pointerType !== 'mouse' && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const last = previewLastTapRef.current;
        const now = Date.now();
        if (last && now - last.t < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
          previewLastTapRef.current = null;
          togglePreviewZoom();
        } else {
          previewLastTapRef.current = { t: now, x: e.clientX, y: e.clientY };
        }
      }
    }
    // One finger left on the glass after a pinch keeps panning.
    if (pointers.size === 1 && previewZoom > PREVIEW_MIN_ZOOM) {
      const [p] = [...pointers.values()];
      startPreviewPan(p.x, p.y);
    }
  };

  /* ---- Problem & Service Type ---- */
  const [repairCategories, setRepairCategories] = useState([]);
  const [repairServices, setRepairServices] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      masterApi.get('/master/repair-categories').then(unwrap).catch(() => []),
      masterApi.get('/master/repair-services').then(unwrap).catch(() => []),
    ]).then(([cats, svcs]) => {
      if (!alive) return;
      setRepairCategories(Array.isArray(cats) ? cats : []);
      setRepairServices(Array.isArray(svcs) ? svcs : []);
    });
    return () => {
      alive = false;
    };
  }, []);

  const relevantRepairCategories = useMemo(
    () =>
      repairCategories
        .filter((c) => c && c.isActive !== false)
        .filter((c) => !form.categoryId || !c.deviceCategoryId || c.deviceCategoryId === form.categoryId)
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)),
    [repairCategories, form.categoryId],
  );

  // Catalog picks first, then "Others" custom issues ({ id, name, categoryId,
  // code: 'OTHER', isCustom }) — so every list, total and the payload that
  // reads chosenServices covers both kinds without its own special case.
  const chosenServices = useMemo(
    () => [...repairServices.filter((s) => form.serviceIds.includes(s.id)), ...form.customIssues],
    [repairServices, form.serviceIds, form.customIssues],
  );
  const repairCategoryNames = useMemo(() => new Map(repairCategories.map((c) => [c.id, c.displayName || c.name])), [repairCategories]);

  const toggleService = (id) => {
    setForm((f) => {
      const has = f.serviceIds.includes(id);
      return { ...f, serviceIds: has ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] };
    });
  };

  // "Add Issue / Service" accordion (3rd tab) — same real
  // relevantRepairCategories/repairServices/serviceIds/toggleService this
  // page already had, grouped by category instead of one active category at
  // a time. Nothing about the API/state shape changes; this is a second,
  // per-category view onto the same data the old Service Category
  // select + Service Type chips used.
  const servicesByCategoryId = useMemo(() => {
    const map = new Map();
    repairServices.forEach((s) => {
      if (!map.has(s.categoryId)) map.set(s.categoryId, []);
      map.get(s.categoryId).push(s);
    });
    return map;
  }, [repairServices]);
  const [expandedIssueCategories, setExpandedIssueCategories] = useState([]);
  const toggleIssueCategory = (id) => {
    setExpandedIssueCategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Local-only per-service price/warranty drafts — see the WARRANTY_OPTIONS
  // comment above. Keyed by repairService id, never read by validate()/
  // submit(), never sent to createShopBooking.
  const [draftServicePrices, setDraftServicePrices] = useState({});
  const [draftServiceWarranty, setDraftServiceWarranty] = useState({});
  const setDraftServicePrice = (id, value) => setDraftServicePrices((p) => ({ ...p, [id]: value }));
  const setDraftServiceWarrantyMonths = (id, months) =>
    setDraftServiceWarranty((w) => ({ ...w, [id]: w[id] === months ? '' : months }));
  // Partner RepairIssuesPicker (chargePerService): each issue row is
  // Price | Service Charge | Warranty. Price + Service Charge both add to the
  // estimate (summed into form.serviceCharge, below); warranty stays a note.
  const [draftServiceCharges, setDraftServiceCharges] = useState({});
  // Per-issue note (the app's withNotes); saved as "Issue: note" lines in issueDescription.
  const [draftServiceNotes, setDraftServiceNotes] = useState({});
  const setDraftServiceCharge = (id, value) => setDraftServiceCharges((c) => ({ ...c, [id]: value }));
  const lineAmount = (id) => (Number(draftServicePrices[id]) || 0) + (Number(draftServiceCharges[id]) || 0);
  const [issueQuery, setIssueQuery] = useState('');
  const [issueSheetId, setIssueSheetId] = useState(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [showAllIssueGroups, setShowAllIssueGroups] = useState(false);

  // "Others" — a custom issue not in the service catalog, as in the Partner
  // app's DeviceServicesScreen: issue → condition category → price → Add
  // Issue. Kept on form.customIssues (merged into chosenServices above), its
  // price in draftServicePrices like any other line so it sums into Service
  // Charge, and sent with repairServiceId: null — the same catalog-less line
  // the app sends, which createShopBooking already passes through.
  const [customIssueDraft, setCustomIssueDraft] = useState(EMPTY_CUSTOM_ISSUE);
  const customIssueSeq = useRef(0);
  const setCustomIssueField = (key, value) => setCustomIssueDraft((d) => ({ ...d, [key]: value }));
  const addCustomIssue = () => {
    const name = customIssueDraft.name.trim();
    if (!name) return;
    customIssueSeq.current += 1;
    const id = `custom-${customIssueSeq.current}`;
    setForm((f) => ({
      ...f,
      customIssues: [...f.customIssues, { id, name, categoryId: customIssueDraft.categoryId || null, code: 'OTHER', isCustom: true }],
    }));
    if (Number(customIssueDraft.price) > 0) setDraftServicePrice(id, customIssueDraft.price);
    setCustomIssueDraft(EMPTY_CUSTOM_ISSUE);
  };
  // "Other Issue" tile / no-match search row: a typed issue, no catalogue id.
  const addOtherIssue = (name) => {
    customIssueSeq.current += 1;
    const id = `custom-${customIssueSeq.current}`;
    setForm((f) => ({ ...f, customIssues: [...f.customIssues, { id, name, categoryId: null, code: 'OTHER', isCustom: true }] }));
  };
  const removeCustomIssue = (id) => setForm((f) => ({ ...f, customIssues: f.customIssues.filter((c) => c.id !== id) }));
  // Remove buttons on the chips / Bill Details take either kind of line.
  const removeChosenService = (s) => (s.isCustom ? removeCustomIssue(s.id) : toggleService(s.id));
  const draftServicesSubtotal = useMemo(
    () => chosenServices.reduce((sum, s) => sum + lineAmount(s.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lineAmount reads exactly these two maps.
    [chosenServices, draftServicePrices, draftServiceCharges],
  );

  // Sums every entered per-service Price into the real, submitted
  // form.serviceCharge — the only field the booking payload actually has
  // for a repair charge (no per-item price line exists there). This is
  // now the sole way Service Charge gets set; the standalone Pricing
  // charges card was removed from the Pickup tab per request.
  useEffect(() => {
    setForm((f) => {
      const next = draftServicesSubtotal > 0 ? String(draftServicesSubtotal) : '';
      return f.serviceCharge === next ? f : { ...f, serviceCharge: next };
    });
  }, [draftServicesSubtotal]);

  // Estimated Delivery — local-only, see ReadyByPicker's doc comment above
  // for why. draftReceivedAt defaults to the moment this page loaded, but
  // (unlike before) is directly editable via the Received chip. Ready By is
  // deliberately not its own state any more — it's always Received +
  // Duration, recomputed below, so it can never drift out of sync with
  // either input.
  const [draftReceivedAt, setDraftReceivedAt] = useState(() => new Date());
  const [draftDurationMinutes, setDraftDurationMinutes] = useState(120);
  const [receivedPickerOpen, setReceivedPickerOpen] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [readyByPickerOpen, setReadyByPickerOpen] = useState(false);
  const draftReadyBy = useMemo(
    () => new Date(draftReceivedAt.getTime() + draftDurationMinutes * 60000),
    [draftReceivedAt, draftDurationMinutes],
  );
  // Ready By has no state of its own (see above), so "manually change Ready
  // By" means back-computing the Duration that would produce it from the
  // current Received time — Ready By then updates the instant Duration
  // does, via the useMemo above. Floored to whole minutes and clamped to at
  // least 1 so a picked time at/before Received can't produce a negative
  // or zero duration.
  function applyReadyBy(next) {
    const minutes = Math.max(1, Math.round((next.getTime() - draftReceivedAt.getTime()) / 60000));
    setDraftDurationMinutes(minutes);
  }

  // Customer Booking approval — REQUIRED before Next / Confirm Booking
  // (validated as customerApproved in SECTION_VALIDATORS). Still not sent with
  // the booking: the booking API has no approval field.
  const [customerApproved, setCustomerApproved] = useState(false);
  // Price & Estimate's voice note — page-owned so it survives step changes (see useVoiceNote).
  const voiceNote = useVoiceNote();

  // Device Security Lock — form.deviceSecurityType/devicePin are the real,
  // submitted fields (see the payload in submit(), above); showSecret and
  // patternDots are transient UI-only state (mask toggle, the pattern
  // grid's visual/in-progress path), never submitted themselves — only the
  // final joined pattern string, written into devicePin the same as a
  // typed PIN or password would be.
  const [showSecret, setShowSecret] = useState(false);
  const [patternDots, setPatternDots] = useState([]);
  // Pointer position (in 3×3 grid units) while dragging — the pattern pad's live line.
  const [patternTail, setPatternTail] = useState(null);
  // Not state — toggled synchronously inside a single pointer gesture, a
  // re-render-triggering setState would lag one event behind the actual
  // drag. Pointer capture (set in onPointerDown, below) is what keeps
  // pointermove events routed to the grid container even once the finger/
  // cursor has moved on top of a different dot's own element.
  const patternDragging = useRef(false);

  // The PIN / Password / Pattern entry opens in a popup (lockModalOpen) when
  // its option is picked; the step itself shows a small "saved / Change" row.
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const lockLabel = { PIN: 'PIN', Password: 'Password', Pattern: 'Pattern' }[form.deviceSecurityType] || 'Lock';
  const lockValueValid =
    form.deviceSecurityType === 'PIN'
      ? /^\d{4,6}$/.test(form.devicePin || '')
      : form.deviceSecurityType === 'Password'
        ? (form.devicePin || '').length >= 4
        : form.deviceSecurityType === 'Pattern'
          ? patternDots.length >= 4
          : false;

  function selectLockType(type) {
    setForm((f) => ({ ...f, deviceSecurityType: type, devicePin: '' }));
    setPatternDots([]);
    setShowSecret(false);
  }

  function togglePatternDot(dot) {
    setPatternDots((prev) => {
      if (prev.includes(dot)) return prev;
      const next = [...prev, dot];
      set('devicePin', next.join('-'));
      return next;
    });
    setFieldErrors((prev) => (prev.devicePin ? { ...prev, devicePin: undefined } : prev));
  }

  function clearPattern() {
    setPatternDots([]);
    set('devicePin', '');
  }

  const deviceLockStatus = useMemo(() => {
    // Derived, not its own form field — see draftReadyBy above for the same
    // "never let a display value drift out of sync with its source" reason.
    // '' (nothing chosen yet) and 'NONE' (No Lock explicitly chosen) both
    // read as the same ready/unlocked summary — they only differ for
    // selection-highlighting and validation, below.
    if (!form.deviceSecurityType || form.deviceSecurityType === 'NONE') {
      return { label: 'No lock set', description: 'Device is currently unlocked and ready for service.', chip: 'READY' };
    }
    const names = { PIN: 'Numeric PIN', Password: 'Password', Pattern: 'Pattern Lock' };
    const nouns = { PIN: 'PIN', Password: 'password', Pattern: 'pattern' };
    return {
      label: names[form.deviceSecurityType] || form.deviceSecurityType,
      description: `Device protected with ${nouns[form.deviceSecurityType] || form.deviceSecurityType}.`,
      chip: 'SECURED',
    };
  }, [form.deviceSecurityType]);

  // Device Missing Parts — see MISSING_PART_ITEMS' doc comment above for
  // why this is local UI state rather than a new form field. One of
  // null | 'missing' | 'damaged' per part; clicking the already-active
  // button clears it (matches "clicking the selected option again clears
  // it").
  const [missingParts, setMissingParts] = useState(() =>
    Object.fromEntries(MISSING_PART_ITEMS.map((item) => [item.key, null])),
  );
  function setPartStatus(key, status) {
    setMissingParts((prev) => ({ ...prev, [key]: prev[key] === status ? null : status }));
  }
  const [missingPartDetails, setMissingPartDetails] = useState({});
  const flaggedPartsCount = useMemo(() => Object.values(missingParts).filter(Boolean).length, [missingParts]);
  const missingPartsSummary = useMemo(
    () =>
      MISSING_PART_ITEMS.filter((item) => missingParts[item.key])
        .map((item) => {
          const detail = String(missingPartDetails[item.key] || '').trim();
          return `${item.title}: ${missingParts[item.key] === 'missing' ? 'Missing' : 'Damaged'}${detail ? ` (${detail})` : ''}`;
        })
        .join(', '),
    [missingParts, missingPartDetails],
  );

  // Device Photos — real uploads via uploadShopDevicePhoto() (src/lib/
  // shopBooking.js), the same shop-token media upload the public /repair
  // flow's customer-facing photo picker uses. photoUploading is per-slot
  // transient UI state (never submitted; upload failures are shown as a
  // toast); the URLs themselves live in each DEVICE_FILE_SLOTS entry's
  // form field (frontImageUrl/backImageUrl/videoUrl), which ARE submitted
  // (see the payload in submit(), below).
  const [photoUploading, setPhotoUploading] = useState({});

  async function handlePhotoUpload(slot, file) {
    if (!file) return;
    // Same ceilings media-service enforces (MediaProperties), checked here so
    // a too-big file fails instantly instead of after a long upload.
    const limitMb = slot.video ? 48 : 5;
    if (file.size > limitMb * 1024 * 1024) {
      notifyError(`${slot.video ? 'Videos' : 'Photos'} must be under ${limitMb} MB.`);
      return;
    }
    setPhotoUploading((u) => ({ ...u, [slot.key]: true }));
    try {
      const url = await uploadShopDevicePhoto(file, slot.key);
      set(slot.field, url);
      if (fieldErrors[slot.field]) setFieldErrors((prev) => ({ ...prev, [slot.field]: undefined }));
    } catch (err) {
      notifyError(err, 'Upload failed. Please try again.');
    } finally {
      setPhotoUploading((u) => ({ ...u, [slot.key]: false }));
    }
  }

  function removePhoto(slot) {
    set(slot.field, '');
  }

  /* ---- Pricing ---- */
  const totals = useMemo(() => estimateTotal(form), [form]);

  // Service Booking Devices List — derives entirely from state this page
  // already has (customer/device fields, chosenServices, totals.total,
  // deviceSecurityType, missingPartsSummary), nothing new is stored here.
  // This client only ever builds ONE device per booking (no array-shaped
  // device state exists anywhere in this codebase), so bookingDevices is a
  // single-item array — array-shaped on purpose so a future multi-device
  // change has a real structure to extend rather than a single flat
  // device object to refactor away from. paymentMode has no confirmed
  // backend field anywhere in this app; it's included in the payload
  // best-effort (the create-booking call is already a stub — see
  // shopBooking.js) rather than invented as a real, guaranteed-persisted
  // field.
  const [paymentMode, setPaymentMode] = useState('');
  // Devices already added with "Add another device" — each holds its own
  // submit payload and the card it showed; the form keeps the current device.
  const [queuedDevices, setQueuedDevices] = useState([]);

  /* ---- Re-Est (edit) mode ----
   * ?edit=<ticketId> (the Requote page's Re-Est button) opens this same form
   * filled from that repair ticket (GET /tickets/{id}); Save Re-Estimate
   * writes it back with updateShopTicket() (PUT + status QUOTED) instead of
   * creating a booking. Category isn't on the ticket, so it's found from the
   * model's own categoryId. Service lines come from priceItemsJson: catalog
   * ids become selected services, anything else an "Others" custom issue,
   * each keeping its price and warranty.
   */
  const router = useRouter();
  const [editTicketId, setEditTicketId] = useState(null);
  const [editTicket, setEditTicket] = useState(null);
  const [editError, setEditError] = useState('');
  const [editRetry, setEditRetry] = useState(0);
  const isEditing = Boolean(editTicketId);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    if (id) setEditTicketId(id);
  }, []);

  useEffect(() => {
    if (!editTicketId) return undefined;
    let alive = true;
    setEditError('');
    setEditTicket(null);
    (async () => {
      const ticket = await fetchTicket(editTicketId);
      if (!ticket?.id) throw new Error('Repair ticket not found.');
      const [brandModels, deviceCategories] = await Promise.all([
        ticket.brandId ? masterApi.get(`/master/brands/${ticket.brandId}/models`).then(unwrap).catch(() => []) : [],
        masterApi.get('/master/device-categories').then(unwrap).catch(() => []),
      ]);
      const model = (brandModels || []).find((m) => String(m.id) === String(ticket.modelId)) || null;
      const category = model?.categoryId ? (deviceCategories || []).find((c) => String(c.id) === String(model.categoryId)) : null;

      let items = [];
      try {
        const parsed = ticket.priceItemsJson ? JSON.parse(ticket.priceItemsJson) : [];
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        items = [];
      }
      if (!items.length && ticket.repairServicesSummary) {
        items = [{ id: null, label: ticket.repairServicesSummary, amount: ticket.estimatedPrice }];
      }
      const serviceIds = [];
      const customIssues = [];
      const prices = {};
      const warranty = {};
      items.forEach((it) => {
        const label = it.label || it.serviceName || it.name || 'Service';
        const amount = Math.round(Number(it.amount ?? it.price ?? it.estimatedPrice) || 0);
        let key = it.id || it.serviceId || null;
        if (key && !serviceIds.includes(key)) {
          serviceIds.push(key);
        } else {
          customIssueSeq.current += 1;
          key = `custom-${customIssueSeq.current}`;
          customIssues.push({ id: key, name: label, categoryId: null, code: it.code || 'OTHER', isCustom: true });
        }
        if (amount > 0) prices[key] = String(amount);
        const months = String(it.warranty ?? '').match(/\d+/)?.[0];
        if (months && WARRANTY_OPTIONS.includes(months)) warranty[key] = months;
      });

      let photos = {};
      try {
        photos = ticket.devicePhotosJson ? JSON.parse(ticket.devicePhotosJson) || {} : {};
      } catch {
        photos = {};
      }
      let missing = [];
      try {
        const parsed = ticket.missingPartsJson ? JSON.parse(ticket.missingPartsJson) : [];
        missing = Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        missing = [];
      }

      const lockType = ['PIN', 'Password', 'Pattern', 'NONE'].includes(ticket.deviceSecurityType) ? ticket.deviceSecurityType : 'NONE';
      const lockValue = lockType === 'NONE' ? '' : ticket.deviceSecurityValue || '';
      if (!alive) return;
      setForm({
        ...EMPTY_FORM,
        customerName: ticket.customerName || '',
        customerMobile: toTenDigitMobile(ticket.customerPhone),
        categoryCode: category?.code || '',
        categoryId: category?.id || '',
        brandId: ticket.brandId || '',
        brandName: ticket.brandName || model?.brandName || '',
        customBrand: !ticket.brandId,
        modelId: ticket.modelId || '',
        customModel: !ticket.modelId,
        modelName: model?.name || String(ticket.deviceDisplayName || '').split(' · ')[0] || '',
        color: ticket.color || '',
        variant: ticketVariant(ticket),
        imei: ticket.imei || '',
        deviceSecurityType: lockType,
        devicePin: lockValue,
        serviceIds,
        customIssues,
        issueDescription: ticket.issueDescription || '',
        frontImageUrl: photos.front || '',
        backImageUrl: photos.back || '',
        videoUrl: photos.video || '',
      });
      setDraftServicePrices(prices);
      setDraftServiceWarranty(warranty);
      setPatternDots(lockType === 'Pattern' ? lockValue.split('-').filter(Boolean) : []);
      setMissingParts(
        Object.fromEntries(
          MISSING_PART_ITEMS.map((item) => {
            const hit = missing.find((m) => m.toLowerCase().startsWith(`${item.title.toLowerCase()}:`));
            return [item.key, hit ? (/damaged/i.test(hit) ? 'damaged' : 'missing') : null];
          }),
        ),
      );
      setCustomerApproved(Boolean(ticket.customerApproval));
      if (ticket.paymentType) setPaymentMode(ticket.paymentType);
      setQueuedDevices([]);
      setDeviceView(null);
      setFieldErrors({});
      setActiveSection('customer');
      setEditTicket(ticket);
      if (!category) notifyError('Could not work out this device’s category — pick it again on the Device tab.');
    })().catch((err) => {
      if (alive) setEditError(err?.message || 'Could not load this booking.');
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTicketId, editRetry]);

  // The ticket carries no brand name; take it from the brand list once loaded.
  useEffect(() => {
    if (selectedBrand && !form.brandName) set('brandName', selectedBrand.name || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, form.brandName]);

  const bookingDevices = useMemo(() => {
    const queued = queuedDevices.map((q, i) => ({ ...q.display, isPrimary: i === 0, queuedIndex: i }));
    if (!form.brandName && !form.modelName) return queued;
    return [
      ...queued,
      {
        brand: form.brandName,
        model: form.modelName,
        image: selectedDeviceImage,
        modelCode: modelNumbers.join(' / '),
        selectedServices: chosenServices,
        estimatedAmount: totals.total,
        isPrimary: queued.length === 0,
        deviceSecurityLock: form.deviceSecurityType,
        deviceMissingParts: missingPartsSummary,
        // Snapshot for the Thank-you receipt: issue → price, its service charge, warranty, note.
        lines: chosenServices.map((x) => ({
          name: x.name,
          note: String(draftServiceNotes[x.id] || '').trim(),
          price: Number(draftServicePrices[x.id]) || 0,
          charge: Number(draftServiceCharges[x.id]) || 0,
          warranty: String(draftServiceWarranty[x.id] || '').trim(),
        })),
        variant: [form.variant, form.color].filter(Boolean).join(', '),
        imei: form.imei.trim(),
      },
    ];
  }, [
    draftServicePrices,
    draftServiceCharges,
    draftServiceWarranty,
    draftServiceNotes,
    form.variant,
    form.color,
    form.imei,
    queuedDevices,
    form.brandName,
    form.modelName,
    selectedDeviceImage,
    modelNumbers,
    chosenServices,
    totals.total,
    form.deviceSecurityType,
    missingPartsSummary,
  ]);
  const grandTotal = bookingDevices.reduce((sum, d) => sum + Number(d.estimatedAmount || 0), 0);

  /* ---- Submit ---- */
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const fieldRefs = useRef({});
  const [confirmed, setConfirmed] = useState(null);
  // Success burst shown for a moment after a booking is created, before the Thank-you screen.
  const [celebrating, setCelebrating] = useState(false);
  // Assign Technician on the confirmation: which booking the modal is for,
  // whether the per-device picker is open, and who got assigned (by ticketId).
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [assignedTechs, setAssignedTechs] = useState({});

  // Booking Confirmation's "Customer Details" card — the active shop's own
  // public record (name / mobile / address), fetched above.
  const shopLocation = profile || null;
  const shopAddress = shopLocation ? [shopLocation.address, shopLocation.district, shopLocation.state, shopLocation.pincode].filter(Boolean).join(', ') : '';

  function copyTrackingId() {
    if (!confirmed || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(String(confirmed.bookingNumber || confirmed.id))
      .then(() => notifySuccess('Copied'))
      .catch(() => {});
  }

  // Same fields/messages the old flat validate() always checked — now built
  // from SECTION_VALIDATORS so goNext() and submit() share one source of
  // truth instead of two hand-written copies of the same rules.
  const validateSection = (sectionKey) => {
    const schema = schemaFor(sectionKey);
    if (!Object.keys(schema).length) return { errors: {}, firstErrorField: null, isValid: true };
    return validateForm(schema, { ...form, needsAddress, customerApproved });
  };

  const validateAll = () => {
    const merged = Object.assign({}, ...Object.values(SECTION_VALIDATORS));
    return validateForm(merged, { ...form, needsAddress, customerApproved });
  };

  const buildPayload = () => ({
    shopId,
    customerName: form.customerName.trim(),
    customerMobile: form.customerMobile.trim(),
    customerAltMobile: form.customerAltMobile.trim() || undefined,
    customerEmail: form.customerEmail.trim() || undefined,
    categoryId: form.categoryId,
    brandId: form.brandId || null,
    brandName: form.brandName,
    modelId: form.modelId || null,
    modelName: form.modelName,
    color: form.color || undefined,
    ramStorage: form.variant || undefined,
    imei: form.imei.trim() || undefined,
    deviceSecurityType: form.deviceSecurityType && form.deviceSecurityType !== 'NONE' ? form.deviceSecurityType : undefined,
    devicePin: form.devicePin || undefined,
    missingDamageParts: missingPartsSummary || undefined,
    paymentMode: paymentMode || undefined,
    services: chosenServices.map((s) => ({ repairServiceId: s.isCustom ? null : s.id, serviceCode: s.code, serviceName: s.name })),
    issueSummary: chosenServices.map((s) => s.name).join(', ') || form.issueDescription.slice(0, 120),
    issueDescription:
      chosenServices
        .map((x) => (String(draftServiceNotes[x.id] || '').trim() ? `${x.name}: ${String(draftServiceNotes[x.id]).trim()}` : ''))
        .filter(Boolean)
        .join('\n') ||
      form.issueDescription.trim() ||
      undefined,
    deviceCondition: form.deviceCondition || undefined,
    frontImageUrl: form.frontImageUrl || undefined,
    backImageUrl: form.backImageUrl || undefined,
    videoUrl: form.videoUrl || undefined,
    serviceMode: form.serviceMode,
    pickupAddress: needsAddress
      ? {
          addressLine: form.addressLine.trim(),
          landmark: form.landmark.trim() || undefined,
          pincode: form.pincode.trim(),
          city: form.city.trim(),
          district: form.district.trim() || undefined,
          state: form.state.trim(),
        }
      : undefined,
    pickupDate: form.pickupDate,
    pickupSlotStart: form.pickupSlotStart,
    pickupSlotEnd: form.pickupSlotEnd,
    customerApproval: customerApproved,
    pricing: {
      inspectionCharge: Number(form.inspectionCharge) || 0,
      serviceCharge: Number(form.serviceCharge) || 0,
      partsCharge: Number(form.partsCharge) || 0,
      pickupCharge: Number(form.pickupCharge) || 0,
      discount: Number(form.discount) || 0,
      taxPercent: Number(form.taxPercent) || 0,
      estimatedAmount: totals.total,
    },
  });

  // Hard lock against a second submit landing before the first finishes
  // (two fast clicks run before `submitting` re-renders the disabled button).
  const submitLockRef = useRef(false);

  const submit = async () => {
    if (submitLockRef.current) return;
    const { errors, firstErrorField, isValid } = validateAll();
    if (!isValid) {
      setFieldErrors(errors);
      notifyError(errors[firstErrorField]);
      const jumpTo = sectionForField(firstErrorField);
      if (jumpTo) {
        setActiveSection(jumpTo);
        setPendingFocusField(firstErrorField);
      } else {
        focusField(fieldRefs, firstErrorField);
      }
      return;
    }
    submitLockRef.current = true;
    setFieldErrors({});
    setSubmitting(true);
    if (isEditing) {
      try {
        const items = chosenServices.map((s) => ({
          id: s.isCustom ? null : s.id,
          code: s.code || null,
          label: s.name || 'Service',
          amount: lineAmount(s.id),
          warranty: draftServiceWarranty[s.id] || null,
        }));
        await updateShopTicket(editTicket, buildPayload(), items);
        notifySuccess('Re-estimate saved');
        router.push('/shop-home/services/bookings/?stage=reestimated');
      } catch (e) {
        notifyError(e.message ? `Unable to save re-estimate: ${e.message}` : 'Unable to save re-estimate. Please try again.');
      } finally {
        submitLockRef.current = false;
        setSubmitting(false);
      }
      return;
    }
    try {
      // Every queued device first, then the one in the form — one ticket per
      // device for the same customer (the Partner app's multi-device flow).
      const payloads = [...queuedDevices.map((q) => q.payload), buildPayload()];
      // Each device's own image, kept beside its result (display only, not
      // sent) so the confirmation never pairs one device's name with another's photo.
      const images = [...queuedDevices.map((q) => q.display?.image || null), selectedDeviceImage];
      const created = [];
      for (let i = 0; i < payloads.length; i += 1) {
        try {
          created.push({ ...(await createShopBooking(payloads[i])), deviceImage: images[i] });
        } catch (err) {
          // Drop the devices that did save so a retry can't book them twice.
          if (created.length) setQueuedDevices((prev) => prev.slice(Math.min(created.length, prev.length)));
          throw new Error(
            created.length
              ? `${created.length} of ${payloads.length} devices were booked (${created.map((c) => c.bookingNumber).join(', ')}). The rest failed: ${err.message}`
              : err.message,
          );
        }
      }
      setQueuedDevices([]);
      setConfirmed({
        ...created[0],
        bookingNumber: created.map((c) => bookingRef(c)).filter(Boolean).join(', '),
        allBookings: created,
        // Every device's details + price lines as entered (the API doesn't echo per-line prices).
        receiptDevices: bookingDevices,
      });
      // Booking Confirmation is now its own tab (9th/last), not a separate
      // full-page takeover — this is the one place that navigates there,
      // and only after a real successful response, never speculatively.
      setActiveSection('confirmation');
      setCelebrating(true);
      notifySuccess('Booking created');
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.error('[Booking] ERROR:', e.status, e.message, e.body); // eslint-disable-line no-console
      notifyError(e.message ? `Unable to create booking: ${e.message}` : 'Unable to create booking. Please try again.');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  // "Add another device": validate the current device, queue it, then clear only
  // the device-specific fields and go back to Device Details (customer kept).
  const addAnotherDevice = () => {
    const { errors, firstErrorField, isValid } = validateAll();
    if (!isValid) {
      setFieldErrors(errors);
      notifyError(errors[firstErrorField]);
      const jumpTo = sectionForField(firstErrorField);
      if (jumpTo) {
        setActiveSection(jumpTo);
        setPendingFocusField(firstErrorField);
      }
      return;
    }
    setQueuedDevices((prev) => [...prev, { payload: buildPayload(), display: bookingDevices[bookingDevices.length - 1] }]);
    setForm((f) => ({
      ...f,
      categoryCode: '', categoryId: '', brandId: '', brandName: '', customBrand: false, modelId: '', modelName: '', customModel: false,
      color: '', variant: '', imei: '', deviceSecurityType: '', devicePin: '',
      serviceCategoryId: '', serviceIds: [], customIssues: [], issueDescription: '', deviceCondition: '',
      frontImageUrl: '', backImageUrl: '', videoUrl: '',
      inspectionCharge: '', serviceCharge: '', partsCharge: '', pickupCharge: '', discount: '', taxPercent: '',
    }));
    setMissingParts(Object.fromEntries(MISSING_PART_ITEMS.map((item) => [item.key, null])));
    setMissingPartDetails({});
    setPatternDots([]);
    setShowSecret(false);
    setCustomerApproved(false);
    // Per-device drafts too, so the next device never inherits this one's
    // prices (they'd be re-summed into its Service Charge) or voice note.
    setDraftServicePrices({});
    setDraftServiceCharges({});
    setDraftServiceNotes({});
    setDraftServiceWarranty({});
    setCustomIssueDraft(EMPTY_CUSTOM_ISSUE);
    voiceNote.clear();
    setFieldErrors({});
    setActiveSection('device');
  };

  const removeQueuedDevice = (index) => setQueuedDevices((prev) => prev.filter((_, i) => i !== index));

  const resetForm = () => {
    // setPhotos/setDayIdx were leftover calls to state that no longer
    // exists (both predate the current Device Photos / Estimated Delivery
    // implementations) — calling either would throw ReferenceError and
    // break this function outright, including from the new Booking
    // Confirmation tab's "Create another booking" button. Removed, and
    // every other local-only state this flow has picked up since is reset
    // here too so a fresh booking genuinely starts clean.
    setForm(EMPTY_FORM);
    setQueuedDevices([]);
    setConfirmed(null);
    setAssignTarget(null);
    setAssignPickerOpen(false);
    setAssignedTechs({});
    setActiveSection('customer');
    setPhotoUploading({});
    setShowSecret(false);
    setPatternDots([]);
    setMissingParts(Object.fromEntries(MISSING_PART_ITEMS.map((item) => [item.key, null])));
    setPaymentMode('');
    setCustomerApproved(false);
    // Reset is the one intentional clear — normal Back/Next keeps all of
    // these (they're page state, not per-step), so they're cleared here too.
    setDraftServicePrices({});
    setDraftServiceCharges({});
    setDraftServiceNotes({});
    setDraftServiceWarranty({});
    setCustomIssueDraft(EMPTY_CUSTOM_ISSUE);
    setExpandedIssueCategories([]);
    setDraftReceivedAt(new Date());
    setDraftDurationMinutes(120);
    setReceivedPickerOpen(false);
    setDurationPickerOpen(false);
    setReadyByPickerOpen(false);
    setLockModalOpen(false);
    voiceNote.clear();
    setFieldErrors({});
  };

  // Booking Confirmation used to be a full-page early return here,
  // replacing the whole wizard the instant `confirmed` was set. Per
  // request it's now its own tab (confirmationSection, built alongside the
  // other sections below, wired into SECTIONS/sectionContent as
  // 'confirmation') so it can appear in the top step navigation like every
  // other section; submit() above navigates there with setActiveSection
  // only after a real successful response.

  /* ---- Section content (rendered once, shown for whichever is active) ---- */

  const addressFields = (
    <>
        <FormField label="State" required={needsAddress} error={fieldErrors.state} fieldRef={registerField(fieldRefs, 'state')}>
          <IconField icon={MapPin}>
            <input
              className={ICON_INPUT_CLS}
              value={form.state}
              onChange={(e) => {
                set('state', e.target.value);
                if (fieldErrors.state) setFieldErrors((prev) => ({ ...prev, state: undefined }));
              }}
            />
          </IconField>
        </FormField>
        <FormField label="District">
          <IconField icon={MapPin}>
            <input className={ICON_INPUT_CLS} value={form.district} onChange={(e) => set('district', e.target.value)} />
          </IconField>
        </FormField>
        <FormField label="City" required={needsAddress} error={fieldErrors.city} fieldRef={registerField(fieldRefs, 'city')}>
          <IconField icon={MapPin}>
            <input
              className={ICON_INPUT_CLS}
              value={form.city}
              onChange={(e) => {
                set('city', e.target.value);
                if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: undefined }));
              }}
            />
          </IconField>
        </FormField>
        <FormField label="Landmark">
          <IconField icon={Landmark}>
            <input className={ICON_INPUT_CLS} value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
          </IconField>
        </FormField>
        <FormField label="Door No. / Street" required={needsAddress} error={fieldErrors.addressLine} fieldRef={registerField(fieldRefs, 'addressLine')}>
          <IconField icon={Home}>
            <input
              className={ICON_INPUT_CLS}
              value={form.addressLine}
              onChange={(e) => {
                set('addressLine', e.target.value);
                if (fieldErrors.addressLine) setFieldErrors((prev) => ({ ...prev, addressLine: undefined }));
              }}
            />
          </IconField>
        </FormField>
        <FormField label="Pincode" required={needsAddress} error={fieldErrors.pincode} fieldRef={registerField(fieldRefs, 'pincode')}>
          <IconField icon={MapPin}>
            <input
              className={ICON_INPUT_CLS}
              value={form.pincode}
              onChange={(e) => {
                set('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                if (fieldErrors.pincode) setFieldErrors((prev) => ({ ...prev, pincode: undefined }));
              }}
            />
          </IconField>
        </FormField>
    </>
  );

  // Partner App CustomerDetailsScreen: search an existing customer by mobile
  // or name, then Name · Mobile · Alternative Mobile, and a folded "More
  // Details (Optional)" with Email and the address.
  const moreDetailsFilled = ['customerEmail', 'state', 'district', 'city', 'landmark', 'addressLine', 'pincode'].filter((k) => String(form[k] || '').trim()).length;
  const moreDetailsShown = moreDetailsOpen || Boolean(fieldErrors.state || fieldErrors.city || fieldErrors.addressLine || fieldErrors.pincode);
  const customerSection = (
    <Section title="Customer Details" subtitle="Search an existing customer, or enter a new one" icon={User}>
      <CustomerSearch
        directory={customerDirectory}
        onPick={pickExistingCustomer}
        onNewNumber={(n) => {
          set('customerMobile', n);
          if (fieldErrors.customerMobile) setFieldErrors((prev) => ({ ...prev, customerMobile: undefined }));
        }}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField label="Customer Name" required error={fieldErrors.customerName} fieldRef={registerField(fieldRefs, 'customerName')}>
          <IconField icon={User}>
            <input
              className={ICON_INPUT_CLS}
              value={form.customerName}
              onChange={(e) => {
                set('customerName', e.target.value);
                if (fieldErrors.customerName) setFieldErrors((prev) => ({ ...prev, customerName: undefined }));
              }}
              placeholder="Customer name"
              autoCapitalize="words"
            />
          </IconField>
        </FormField>
        <FormField label="Mobile Number" required error={fieldErrors.customerMobile} fieldRef={registerField(fieldRefs, 'customerMobile')}>
          <IconField icon={Phone}>
            <input
              className={ICON_INPUT_CLS}
              value={form.customerMobile}
              onChange={(e) => {
                set('customerMobile', e.target.value.replace(/\D/g, '').slice(0, 10));
                if (fieldErrors.customerMobile) setFieldErrors((prev) => ({ ...prev, customerMobile: undefined }));
              }}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              maxLength={10}
            />
          </IconField>
        </FormField>
        <FormField label="Alternative Mobile Number" error={fieldErrors.customerAltMobile} fieldRef={registerField(fieldRefs, 'customerAltMobile')}>
          <IconField icon={Phone}>
            <input
              className={ICON_INPUT_CLS}
              value={form.customerAltMobile}
              onChange={(e) => {
                set('customerAltMobile', e.target.value.replace(/\D/g, '').slice(0, 10));
                if (fieldErrors.customerAltMobile) setFieldErrors((prev) => ({ ...prev, customerAltMobile: undefined }));
              }}
              inputMode="numeric"
              maxLength={10}
              placeholder="Optional"
            />
          </IconField>
        </FormField>
      </div>

      <div className="mt-4 overflow-hidden rounded-[14px] border border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => setMoreDetailsOpen((v) => !v)}
          aria-expanded={moreDetailsShown}
          className={cx('flex min-h-[48px] w-full items-center gap-2 bg-[#F9FAFB] px-3.5 text-left', FOCUS_RING)}
        >
          <span className="flex-1 text-[13.5px] font-bold text-[#111111]">
            More Details <span className="font-normal text-[#6B7280]">(Optional)</span>
          </span>
          {moreDetailsFilled ? (
            <span className="rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[10.5px] font-extrabold text-[#035C6C]">{moreDetailsFilled} added</span>
          ) : null}
          <ChevronDown className={cx('h-[18px] w-[18px] text-[#111111] transition', moreDetailsShown && 'rotate-180')} aria-hidden="true" />
        </button>
        {moreDetailsShown ? (
          <div className="bg-white p-3.5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Email">
                <IconField icon={Mail}>
                  <input type="email" className={ICON_INPUT_CLS} value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} placeholder="Email address" />
                </IconField>
              </FormField>
              {addressFields}
            </div>
            {!needsAddress ? (
              <p className="mt-2.5 text-[0.7rem] text-[#98A2B3]">Address is only required for Pickup or Doorstep Service.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Section>
  );


  const deviceSectionError = fieldErrors.categoryId || fieldErrors.brandId || fieldErrors.modelId;
  const deviceSection = (
    <Section title="Device Details" icon={Smartphone}>
      {deviceSectionError ? (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {deviceSectionError}
        </p>
      ) : null}
      <div
        ref={(el) => {
          fieldRefs.current.categoryId = el;
          fieldRefs.current.brandId = el;
          fieldRefs.current.modelId = el;
        }}
        className="space-y-7"
      >
        {/* Partner App method (DeviceDetailsScreen): each level is a tile grid;
            once picked it folds to a card with Change. Brand and Model end
            with an "Other" tile for a name that isn't in the catalogue. */}

        {/* Category */}
        <DeviceField label="Category" required>
          {catPicked && deviceView !== 'category' ? (
            <PickedCard
              image={categoryOptions.find((c) => c.id === form.categoryCode)?.imageUrl}
              title={categoryOptions.find((c) => c.id === form.categoryCode)?.name || 'Category'}
              onChange={() => setDeviceView('category')}
            />
          ) : categoriesLoading ? (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                {[0,1,2,3,4,5].map((i) => (
                  <div key={i} className="h-[96px] animate-pulse rounded-[14px] border border-[#E5E7EB] bg-white" />
                ))}
              </div>
          ) : categoriesError ? (
            <p className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {categoriesError}
                <button type="button" onClick={() => setCategoriesRetry((k) => k + 1)} className="font-bold underline underline-offset-2">
                  Retry
                </button>
              </p>
          ) : categoryOptions.length === 0 ? (
            <p className="text-sm text-[#98A2B3]">No categories available.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
              {categoryOptions.map((cat) => (
                <OptionCard key={cat.id} on={form.categoryCode === cat.id} label={cat.name} onClick={() => pickCategory(cat)}>
                  <PickImage url={cat.imageUrl} name={cat.name} className="h-12 w-12" />
                </OptionCard>
              ))}
            </div>
          )}
        </DeviceField>

        {/* Brand — logo tiles + Other */}
        {catPicked ? (
          <DeviceField label="Brand" required>
            {brandPicked && deviceView !== 'brand' ? (
              <PickedCard
                image={selectedBrand?.imageUrl}
                wide
                title={form.brandName || 'Brand'}
                subtitle={form.customBrand ? 'Not in list' : null}
                onChange={() => setDeviceView('brand')}
              />
            ) : brandsLoading ? (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => (
                  <div key={i} className="h-[96px] animate-pulse rounded-[14px] border border-[#E5E7EB] bg-white" />
                ))}
              </div>
            ) : brandsError ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {brandsError}
                <button type="button" onClick={() => setBrandsRetry((k) => k + 1)} className="font-bold underline underline-offset-2">
                  Retry
                </button>
              </p>
            ) : (
              <>
                <label className="mb-3 flex h-10 w-full items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 focus-within:border-[#035C6C] sm:w-72">
                  <Search className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />
                  <input value={brandQuery} onChange={(e) => setBrandQuery(e.target.value)} placeholder="Search brand" aria-label="Search brand" className="min-w-0 flex-1 bg-transparent text-base text-[#111111] outline-none placeholder:text-[#98A2B3] sm:text-sm" />
                </label>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                  {visibleBrands.map((brand) => (
                    <OptionCard key={brand.id} on={form.brandId === brand.id} label={brand.name} className="min-h-[124px]" onClick={() => pickBrand(brand)}>
                      <PickImage url={brand.imageUrl} name={brand.name} className="h-16 w-full max-w-[128px]" />
                    </OptionCard>
                  ))}
                  <OptionCard
                    on={form.customBrand}
                    label={form.customBrand ? form.brandName : 'Other'}
                    onClick={() =>
                      setTypeSheet({
                        title: 'Other Brand',
                        placeholder: 'Type the brand name',
                        initial: form.customBrand ? form.brandName : brandQuery.trim(),
                        onDone: pickOtherBrand,
                      })
                    }
                  >
                    <OtherIcon />
                  </OptionCard>
                </div>
                {brandQuery.trim() && !visibleBrands.length ? (
                  <p className="mt-2 text-xs text-[#6B7280]">No brand matches “{brandQuery.trim()}” — tap Other to type it.</p>
                ) : null}
              </>
            )}
          </DeviceField>
        ) : null}

        {/* Model — search, series chips, model tiles + Other */}
        {brandPicked ? (
          <DeviceField label="Model" required>
            {modelPicked && deviceView !== 'model' ? (
              <PickedCard
                image={selectedModel?.imageUrl}
                title={form.modelName || 'Model'}
                subtitle={form.customModel ? 'Not in list' : [form.brandName, categoryOptions.find((c) => c.id === form.categoryCode)?.name].filter(Boolean).join(' · ')}
                onChange={() => setDeviceView('model')}
              />
            ) : modelsLoading ? (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
                {[0,1,2,3,4,5,6,7,8,9].map((i) => (
                  <div key={i} className="h-[150px] animate-pulse rounded-[14px] border border-[#E5E7EB] bg-white" />
                ))}
              </div>
            ) : modelsError ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-[0.75rem] text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {modelsError}
                <button type="button" onClick={() => setModelsRetry((k) => k + 1)} className="font-bold underline underline-offset-2">
                  Retry
                </button>
              </p>
            ) : (
              <>
                {categoryModels.length ? (
                  <label className="mb-3 flex h-10 w-full items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 focus-within:border-[#035C6C] sm:w-72">
                    <Search className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />
                    <input
                      value={modelQuery}
                      onChange={(e) => {
                        setModelQuery(e.target.value);
                        setModelLimit(24);
                      }}
                      placeholder="Search model"
                      aria-label="Search model"
                      className="min-w-0 flex-1 bg-transparent text-base text-[#111111] outline-none placeholder:text-[#98A2B3] sm:text-sm"
                    />
                  </label>
                ) : null}

                {seriesChips.length > 1 && !modelQuery.trim() ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[{ id: '', name: 'All' }, ...seriesChips].map((sr) => {
                      const on = seriesFilter === sr.id;
                      return (
                        <button
                          key={sr.id || 'all'}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            setSeriesFilter(sr.id);
                            setModelLimit(24);
                          }}
                          className={cx(
                            'rounded-xl border px-3.5 py-1.5 text-[13px] font-semibold transition',
                            FOCUS_RING,
                            on ? 'border-[#035C6C] bg-[#E5F3F5] text-[#024A57]' : 'border-[#E5E7EB] bg-white text-[#344054] hover:border-[#035C6C]/50',
                          )}
                        >
                          {sr.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {visibleModels.slice(0, modelLimit).map((model) => {
                    const on = form.modelId === model.id;
                    return (
                      <div
                        key={model.id}
                        className={cx(
                          'relative flex min-w-0 flex-col items-center gap-2 rounded-[14px] border p-3 text-center transition',
                          on ? 'border-[1.5px] border-[#035C6C] bg-[#E5F3F5]' : 'border-[#E5E7EB] bg-white hover:border-[#035C6C]/50',
                        )}
                      >
                        {/* Whole card selects (stretched button); the image sits above it and opens the full-screen preview. */}
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={deviceTitle(form.brandName, model.name)}
                          onClick={() => selectModel(model)}
                          className={cx('absolute inset-0 rounded-[14px]', FOCUS_RING)}
                        />
                        {on ? <TickBadge /> : null}
                        <button
                          type="button"
                          onClick={() => openDevicePreview(model.id)}
                          aria-label={`Preview ${deviceTitle(form.brandName, model.name)}`}
                          className={cx('relative z-10 w-full cursor-zoom-in rounded-xl', FOCUS_RING)}
                        >
                          <PickImage url={model.imageUrl} name={model.name} className="h-20 w-full sm:h-24" />
                        </button>
                        <span className={cx('pointer-events-none relative line-clamp-2 break-words text-[13px] leading-tight', on ? 'font-bold text-[#024A57]' : 'font-semibold text-[#111111]')}>{model.name}</span>
                      </div>
                    );
                  })}
                  <OptionCard
                    on={form.customModel}
                    label={form.customModel ? form.modelName : 'Other'}
                    className="min-h-[150px]"
                    onClick={() =>
                      setTypeSheet({
                        title: 'Other Model',
                        placeholder: 'Type the model name',
                        initial: form.customModel ? form.modelName : modelQuery.trim(),
                        onDone: pickOtherModel,
                      })
                    }
                  >
                    <OtherIcon />
                  </OptionCard>
                </div>

                {visibleModels.length > modelLimit ? (
                  <div className="mt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setModelLimit((n) => n + 24)}
                      className={cx('rounded-xl border border-[#E5E7EB] bg-white px-5 py-2 text-[13px] font-bold text-[#035C6C] transition hover:border-[#035C6C]', FOCUS_RING)}
                    >
                      Show more models ({visibleModels.length - modelLimit})
                    </button>
                  </div>
                ) : null}
                {!categoryModels.length ? (
                  <p className="mt-2 text-xs text-[#6B7280]">No models listed for this brand — tap Other to type it.</p>
                ) : modelQuery.trim() && !visibleModels.length ? (
                  <p className="mt-2 text-xs text-[#6B7280]">No model matches “{modelQuery.trim()}” — tap Other to type it.</p>
                ) : null}
              </>
            )}
          </DeviceField>
        ) : null}

        {/* Colour and Storage — catalogue options as tiles (+ Other); a model
            typed through Other, or one with nothing listed, types them in. */}
        {modelPicked ? (
          <>
            <DeviceField label="Color" optional>
              {modelColors.length && !form.customModel ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {modelColors.map((name) => {
                    const on = form.color === name;
                    return (
                      <ChipTile key={name} on={on} onClick={() => set('color', on ? '' : name)}>
                        <ColorSwatch hex={hexOfColor(name)} size="h-4 w-4" />
                        <span className="truncate">{name}</span>
                      </ChipTile>
                    );
                  })}
                  <ChipTile
                    on={Boolean(form.color) && !modelColors.includes(form.color)}
                    onClick={() =>
                      setTypeSheet({
                        title: 'Other Color',
                        placeholder: 'Type the colour, e.g. Sea Green',
                        initial: modelColors.includes(form.color) ? '' : form.color,
                        onDone: (t) => set('color', t),
                      })
                    }
                  >
                    <Plus className="h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
                    <span className="truncate">{form.color && !modelColors.includes(form.color) ? form.color : 'Other'}</span>
                  </ChipTile>
                </div>
              ) : (
                <input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="Enter colour, e.g. Sea Green" aria-label="Color" maxLength={40} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C] sm:text-sm" />
              )}
            </DeviceField>

            <DeviceField label="Storage & RAM" optional>
              {modelVariants.length && !form.customModel ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {modelVariants.map((v) => {
                    const on = form.variant === v;
                    return (
                      <ChipTile key={v} on={on} onClick={() => set('variant', on ? '' : v)}>
                        <span className="truncate">{v}</span>
                      </ChipTile>
                    );
                  })}
                  <ChipTile
                    on={Boolean(form.variant) && !modelVariants.includes(form.variant)}
                    onClick={() =>
                      setTypeSheet({
                        title: 'Other Storage & RAM',
                        placeholder: 'e.g. 8 GB + 256 GB',
                        initial: modelVariants.includes(form.variant) ? '' : form.variant,
                        onDone: (t) => set('variant', t),
                      })
                    }
                  >
                    <Plus className="h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
                    <span className="truncate">{form.variant && !modelVariants.includes(form.variant) ? form.variant : 'Other'}</span>
                  </ChipTile>
                </div>
              ) : (
                <input value={form.variant} onChange={(e) => set('variant', e.target.value)} placeholder="Enter storage & RAM, e.g. 8 GB + 128 GB" aria-label="Storage and RAM" maxLength={40} className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C] sm:text-sm" />
              )}
            </DeviceField>
          </>
        ) : null}

        {typeSheet ? <TypeSheet key={typeSheet.title} sheet={typeSheet} onClose={() => setTypeSheet(null)} /> : null}
      </div>

      {devicePreviewOpen && previewModel
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${deviceTitle(form.brandName, previewModel.name)} — preview`}
              onClick={closeDevicePreview}
              // Opaque backdrop: at /95 the page behind (title, product grid)
              // bled through and collided with the header/footer text on phones.
              // Safe-area padding keeps controls clear of the iPhone notch/home bar.
              style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingRight: 'env(safe-area-inset-right)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
              }}
              className={cx(
                'fixed inset-0 z-[100] flex flex-col overscroll-contain bg-[#1F2A22] text-white transition-opacity duration-200',
                devicePreviewVisible ? 'opacity-100' : 'opacity-0',
              )}
            >
              <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4 [@media(max-height:480px)]:py-1.5">
                <p className="min-w-0 truncate text-xs font-semibold text-white/80 sm:text-sm">
                  <span aria-hidden="true">🤏 </span>
                  <span className="[@media(pointer:coarse)]:hidden">Scroll · double-click · drag</span>
                  <span className="hidden [@media(pointer:coarse)]:inline">Pinch · double-tap · drag</span>
                  {previewIndex >= 0 ? ' · swipe' : ''}
                </p>
                <button
                  type="button"
                  onClick={closeDevicePreview}
                  aria-label="Close preview"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:h-12 sm:w-12 [@media(max-height:480px)]:h-9 [@media(max-height:480px)]:w-9"
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </header>

              <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-20">
                {previewIndex > 0 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stepPreview(-1);
                    }}
                    aria-label="Previous model"
                    className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:left-6 sm:flex"
                  >
                    <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                  </button>
                ) : null}

                <div
                  onClick={(e) => e.stopPropagation()}
                  className={cx(
                    // Square card that fits whatever space the header/footer
                    // leave — portrait phone, landscape phone, tablet, desktop.
                    'relative aspect-square h-full max-h-[640px] max-w-full overflow-hidden rounded-2xl bg-white transition-transform duration-200',
                    devicePreviewVisible ? 'scale-100' : 'scale-95',
                  )}
                >
                  <div
                    ref={previewImgWrapRef}
                    onPointerDown={onPreviewPointerDown}
                    onPointerMove={onPreviewPointerMove}
                    onPointerUp={onPreviewPointerEnd}
                    onPointerCancel={onPreviewPointerEnd}
                    onDoubleClick={() => {
                      if (previewLastPointerTypeRef.current === 'mouse') togglePreviewZoom();
                    }}
                    className="h-full w-full touch-none select-none overflow-hidden"
                    style={{ cursor: previewModel.imageUrl && previewZoom > PREVIEW_MIN_ZOOM ? (previewDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
                  >
                    {previewModel.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- master-data model image, remote S3 URL, needs a live zoom/pan transform.
                      <img
                        src={previewModel.imageUrl}
                        alt={previewModel.name}
                        draggable={false}
                        className="h-full w-full select-none object-contain"
                        style={{
                          transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
                          transition: previewDragging ? 'none' : 'transform 150ms ease-out',
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-[#035C6C]">{initials(previewModel.name)}</div>
                    )}
                  </div>

                  {previewModel.imageUrl ? (
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/60 px-2 py-1.5 backdrop-blur">
                      <button
                        type="button"
                        onClick={zoomPreviewOut}
                        disabled={previewZoom <= PREVIEW_MIN_ZOOM}
                        aria-label="Zoom out"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={resetPreviewZoom}
                        aria-label="Reset zoom"
                        className="min-w-[3rem] rounded-full px-2 py-1 text-center text-xs font-semibold text-white transition hover:bg-white/20"
                      >
                        {Math.round(previewZoom * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={zoomPreviewIn}
                        disabled={previewZoom >= PREVIEW_MAX_ZOOM}
                        aria-label="Zoom in"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>

                {previewIndex >= 0 && previewIndex < visibleModels.length - 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      stepPreview(1);
                    }}
                    aria-label="Next model"
                    className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-6 sm:flex"
                  >
                    <ChevronRight className="h-6 w-6" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <footer onClick={(e) => e.stopPropagation()} className="shrink-0 px-4 pb-4 pt-3 sm:px-7 sm:pb-7 sm:pt-4 [@media(max-height:480px)]:pb-2 [@media(max-height:480px)]:pt-1">
                <p className="line-clamp-2 text-center text-base font-extrabold text-white sm:text-lg">{deviceTitle(form.brandName, previewModel.name)}</p>
                {previewIndex >= 0 ? (
                  <>
                    {visibleModels.length > 1 ? (
                      <p className="mt-0.5 text-center text-xs font-medium text-white/55">
                        {previewIndex + 1} of {visibleModels.length}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        selectModel(previewModel);
                        closeDevicePreview();
                      }}
                      className="mx-auto mt-3 flex w-full max-w-xl items-center justify-center rounded-full bg-[#035C6C] px-5 py-3.5 text-base font-semibold text-white transition hover:bg-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:mt-4 sm:py-4 [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:py-2.5"
                    >
                      Select this product
                    </button>
                  </>
                ) : null}
              </footer>
            </div>,
            document.body,
          )
        : null}
    </Section>
  );

  /**
   * Device Information — its own top-nav tab (SECTIONS, above). Display
   * only: the identity card (the real selectedModel/selectedBrand image)
   * plus Device / Brand / Model / Model Number / Color / Storage, all read
   * from the same form state and selectedModel the Device Details tab
   * fills in — that tab is where any of them gets picked or changed.
   * Below it, sectionContent.deviceInfo renders pickupSummarySection, a
   * read-only view of the Service Price & Issue Estimate tab.
   */
  const deviceCategoryName = categoryOptions.find((c) => c.id === form.categoryCode)?.name || '';
  const deviceInfoDetails = [
    { label: 'Device', value: deviceCategoryName },
    { label: 'Brand', value: form.brandName },
    { label: 'Model', value: form.modelName },
    { label: 'Model Number', value: modelNumbers.join(' / '), empty: 'Not available' },
    { label: 'Color', value: form.color, swatch: form.color ? hexOfColor(form.color) : null },
    { label: 'Storage', value: form.variant },
  ];
  const deviceInfoSection = (
    <Section title="Device Information" icon={Info}>
      {/* Device identity card — selectedDeviceImage (model photo, brand logo
          only as fallback, device icon last) in a fixed 56px box. Never a
          hardcoded sample. */}
      {form.brandName || form.modelName ? (
        <div className="rounded-xl border border-[#ECECEC] bg-white p-4">
          <div className="flex items-center gap-3 border-b border-dashed border-[#ECECEC] pb-4">
            <Thumb url={selectedDeviceImage} name={[form.brandName, form.modelName].filter(Boolean).join(' ')} size="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#666666]">{[deviceCategoryName, form.brandName].filter(Boolean).join(' · ') || 'Device'}</p>
              <p className="truncate text-sm font-bold text-[#111111]">{form.modelName || 'Model not selected'}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
            {deviceInfoDetails.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#666666]">{row.label}</dt>
                <dd className={cx('mt-1 flex items-center gap-1.5 text-sm font-bold', row.value ? 'text-[#111111]' : 'text-[#98A2B3]')}>
                  {row.swatch ? (
                    <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: row.swatch }} aria-hidden="true" />
                  ) : null}
                  <span className="truncate">{row.value || row.empty || 'Not selected'}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F3F3F3] p-3">
          <Thumb url={null} name="" size="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#98A2B3]">No device selected yet</p>
            <p className="text-xs text-[#98A2B3]">Pick a brand and model on the Device Details tab.</p>
          </div>
        </div>
      )}
    </Section>
  );

  /**
   * Device Security Lock — its own top-nav tab (SECTIONS, above), between
   * Device Information and Add Issue / Service. form.deviceSecurityType /
   * devicePin are the real fields (see EMPTY_FORM / the submit() payload
   * above and LOCK_OPTIONS' doc comment) — the same ones Receipt/QR
   * E-Print and the customer app's own order-history screen already read.
   * Pattern Lock has no existing drawing implementation anywhere in this
   * codebase to reuse, so this is a genuinely new, real 3x3 tap-in-sequence
   * grid (not a placeholder) — tapping dots builds devicePin as e.g.
   * "1-2-3-6-9", the same way a typed PIN/password would populate it.
   */
  const deviceSecuritySection = (
    <div ref={registerField(fieldRefs, 'deviceSecurityType')}>
      <div ref={registerField(fieldRefs, 'devicePin')} role="radiogroup" aria-label="Device security">
        {[...LOCK_OPTIONS.filter((o) => o.key === 'NONE'), ...LOCK_OPTIONS.filter((o) => o.key !== 'NONE')].map((opt) => {
          const on = (form.deviceSecurityType || 'NONE') === opt.key;
          return (
            <div key={opt.key} className="flex min-h-[40px] items-center gap-2.5 py-1">
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  // Re-picking the current type just reopens the entry popup (keeps what was entered).
                  if (opt.key !== form.deviceSecurityType) selectLockType(opt.key);
                  if (opt.key !== 'NONE') setLockModalOpen(true);
                  if (fieldErrors.devicePin) setFieldErrors((prev) => ({ ...prev, devicePin: undefined }));
                }}
                className={cx('flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left', FOCUS_RING)}
              >
                <span
                  className={cx(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    on ? 'bg-[#035C6C] text-white' : 'border-[1.5px] border-[#B8B8B8] bg-white',
                  )}
                >
                  {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
                </span>
                <span className="truncate text-[14px] text-[#111111]">{opt.key === 'NONE' ? 'None' : opt.title}</span>
              </button>
              {on && opt.key !== 'NONE' ? (
                <button type="button" onClick={() => setLockModalOpen(true)} className={cx('max-w-[50%] shrink-0 truncate rounded-md text-[12.5px] text-[#6B7280]', FOCUS_RING)}>
                  {lockValueValid ? '•'.repeat(Math.min(String(form.devicePin || '').length, 8)) : 'Not entered'}{' '}
                  <span className="font-bold text-[#035C6C]">Edit</span>
                </button>
              ) : null}
            </div>
          );
        })}
        {fieldErrors.devicePin ? <p className="pb-1 text-xs text-red-600">{fieldErrors.devicePin}</p> : null}
      </div>

        {lockModalOpen && form.deviceSecurityType && form.deviceSecurityType !== 'NONE' && typeof document !== 'undefined'
          ? createPortal(
              <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#1E1E1E]/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={() => setLockModalOpen(false)}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Enter ${lockLabel}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[22px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_60px_rgba(30,30,30,0.25)] sm:rounded-[22px]"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[17px] font-extrabold text-[#111111]">{`Enter ${lockLabel}`}</p>
                    <button type="button" onClick={() => setLockModalOpen(false)} aria-label="Close" className="rounded-full p-2 text-[#98A2B3] hover:bg-[#F3F3F3] hover:text-[#111111] sm:p-1.5">
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
              {form.deviceSecurityType === 'PIN' ? (
                <div>
                  <FormField label="Enter PIN">
                    <div className="flex items-center gap-2">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={form.devicePin}
                        onChange={(e) => {
                          set('devicePin', e.target.value.replace(/\D/g, '').slice(0, 6));
                          if (fieldErrors.devicePin) setFieldErrors((prev) => ({ ...prev, devicePin: undefined }));
                        }}
                        placeholder="4–6 digit PIN"
                        className={cx(COMPACT_INPUT_CLS, 'flex-1 tracking-widest')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        aria-label={showSecret ? 'Hide PIN' : 'Show PIN'}
                        className="shrink-0 rounded-lg border border-[#D0D5DD] p-2.5 text-[#666666] transition hover:bg-[#F3F3F3]"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </FormField>
                  {form.devicePin && form.devicePin.length < 4 ? (
                    <p className="mt-1.5 text-xs text-red-600">PIN must contain at least 4 digits.</p>
                  ) : fieldErrors.devicePin ? (
                    <p className="mt-1.5 text-xs text-red-600">{fieldErrors.devicePin}</p>
                  ) : null}
                </div>
              ) : form.deviceSecurityType === 'Password' ? (
                <div>
                  <FormField label="Enter Password">
                    <div className="flex items-center gap-2">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={form.devicePin}
                        onChange={(e) => {
                          set('devicePin', e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16));
                          if (fieldErrors.devicePin) setFieldErrors((prev) => ({ ...prev, devicePin: undefined }));
                        }}
                        placeholder="4–16 letters & numbers"
                        className={cx(COMPACT_INPUT_CLS, 'flex-1')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret((v) => !v)}
                        aria-label={showSecret ? 'Hide password' : 'Show password'}
                        className="shrink-0 rounded-lg border border-[#D0D5DD] p-2.5 text-[#666666] transition hover:bg-[#F3F3F3]"
                      >
                        {showSecret ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </FormField>
                  {form.devicePin && form.devicePin.length < 4 ? (
                    <p className="mt-1.5 text-xs text-red-600">Password must be at least 4 characters.</p>
                  ) : fieldErrors.devicePin ? (
                    <p className="mt-1.5 text-xs text-red-600">{fieldErrors.devicePin}</p>
                  ) : null}
                </div>
              ) : form.deviceSecurityType === 'Pattern' ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#666666]">Draw Pattern</p>
                    <button type="button" onClick={clearPattern} className="text-xs font-bold text-[#035C6C]">
                      Clear pattern
                    </button>
                  </div>
                  {/* Real drag input, not decorative: pointer capture on the grid
                      itself (set on pointerdown) keeps every subsequent
                      pointermove routed here even as the finger/cursor crosses
                      onto other dots' own elements; elementFromPoint then finds
                      which dot is currently under the pointer. Works for touch
                      and mouse alike since Pointer Events unify both. A plain
                      tap still works too — each dot's own onClick calls the same
                      togglePatternDot, which is a no-op if the drag already
                      added that dot. */}
                  {/* Square pad that uses the popup's width; the drawn path is an
                      SVG under the dots (viewBox 3×3: dot n sits at its column/
                      row centre), plus a live line to the pointer while dragging. */}
                  <div
                    className="relative mx-auto aspect-square w-full max-w-[300px] touch-none select-none rounded-2xl bg-[#F9FAFB]"
                    onPointerDown={(e) => {
                      const dotEl = e.target.closest('[data-pattern-dot]');
                      if (!dotEl) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      patternDragging.current = true;
                      togglePatternDot(Number(dotEl.dataset.patternDot));
                    }}
                    onPointerMove={(e) => {
                      if (!patternDragging.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPatternTail({ x: ((e.clientX - rect.left) / rect.width) * 3, y: ((e.clientY - rect.top) / rect.height) * 3 });
                      const el = document.elementFromPoint(e.clientX, e.clientY);
                      const dotEl = el?.closest('[data-pattern-dot]');
                      if (dotEl) togglePatternDot(Number(dotEl.dataset.patternDot));
                    }}
                    onPointerUp={() => {
                      patternDragging.current = false;
                      setPatternTail(null);
                    }}
                    onPointerCancel={() => {
                      patternDragging.current = false;
                      setPatternTail(null);
                    }}
                  >
                    <svg viewBox="0 0 3 3" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                      {patternDots.length > 1 ? (
                        <polyline
                          points={patternDots.map((d) => `${((d - 1) % 3) + 0.5},${Math.floor((d - 1) / 3) + 0.5}`).join(' ')}
                          fill="none"
                          stroke="#035C6C"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          opacity="0.85"
                        />
                      ) : null}
                      {patternTail && patternDots.length ? (
                        <line
                          x1={((patternDots[patternDots.length - 1] - 1) % 3) + 0.5}
                          y1={Math.floor((patternDots[patternDots.length - 1] - 1) / 3) + 0.5}
                          x2={patternTail.x}
                          y2={patternTail.y}
                          stroke="#035C6C"
                          strokeWidth="6"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          opacity="0.35"
                        />
                      ) : null}
                    </svg>
                    <div className="relative grid h-full w-full grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => {
                        const dot = i + 1;
                        const order = patternDots.indexOf(dot);
                        const active = order >= 0;
                        return (
                          <div key={dot} className="flex items-center justify-center">
                            <button
                              type="button"
                              data-pattern-dot={dot}
                              onClick={() => togglePatternDot(dot)}
                              aria-pressed={active}
                              aria-label={`Pattern dot ${dot}`}
                              className={cx(
                                'flex h-14 w-14 items-center justify-center rounded-full border-2 transition',
                                active ? 'border-[#035C6C] bg-[#035C6C]' : 'border-[#D0D5DD] bg-white hover:border-[#035C6C]/50',
                                order === 0 && 'ring-4 ring-[#035C6C]/20',
                              )}
                            >
                              {active ? (
                                <span className="text-[13px] font-extrabold text-white">{order + 1}</span>
                              ) : (
                                <span className="h-3 w-3 rounded-full bg-[#D0D5DD]" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-center text-xs text-[#666666]">
                    {patternDots.length ? `Pattern: ${patternDots.join(' → ')}` : 'Drag or tap at least 4 dots in sequence.'}
                  </p>
                  {patternDots.length > 0 && patternDots.length < 4 ? (
                    <p className="text-center text-xs text-red-600">Connect at least 4 dots.</p>
                  ) : fieldErrors.devicePin ? (
                    <p className="text-center text-xs text-red-600">{fieldErrors.devicePin}</p>
                  ) : null}
                </div>
              ) : null}
                  <div className="mt-4 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setLockModalOpen(false)}
                      className="h-11 flex-1 rounded-xl border border-[#D0D5DD] bg-white text-sm font-bold text-[#344054] transition hover:bg-[#F3F3F3]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!lockValueValid}
                      onClick={() => {
                        setLockModalOpen(false);
                        if (fieldErrors.devicePin) setFieldErrors((prev) => ({ ...prev, devicePin: undefined }));
                      }}
                      className="h-11 flex-1 rounded-xl bg-[#F3BF23] text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
    </div>
  );

  /**
   * Device Missing Parts — its own top-nav tab (SECTIONS, above), between
   * Device Security Lock and Add Issue / Service. See MISSING_PART_ITEMS'
   * doc comment for why the per-part breakdown is local state while only
   * the joined missingPartsSummary reaches the real, existing
   * missingDamageParts field in the submit payload.
   */
  const missingPartsSection = (
    <Section title="Device Missing Parts" icon={ListChecks}>
      <p className="-mt-1 mb-4 text-xs text-[#666666]">Inspect and flag the device condition.</p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#ECECEC] bg-white p-3 text-center">
          <p className="text-lg font-extrabold text-[#111111]">{flaggedPartsCount}</p>
          <p className="text-xs text-[#666666]">Parts Flagged</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#ECECEC] bg-[#F8F8F8] p-3 text-center">
          <p className="text-xs font-bold text-[#035C6C]">Inspection in progress</p>
        </div>
      </div>

      {/* 4 cards per row on desktop (2 on tablets, 1 on phones); each card is
          a flex column so its Missing/Damaged buttons line up at the bottom
          across a row even when a subtitle wraps. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MISSING_PART_ITEMS.map((item) => {
          const status = missingParts[item.key];
          const flagged = Boolean(status);
          return (
            <div
              key={item.key}
              className={cx('flex flex-col rounded-xl border p-3.5 transition', flagged ? 'border-[#035C6C] bg-[#F8F8F8]' : 'border-[#ECECEC] bg-white')}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cx(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    flagged ? 'bg-[#035C6C] text-white' : 'bg-[#F8F8F8] text-[#035C6C]',
                  )}
                >
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#111111]">{item.title}</p>
                  <p className="text-xs text-[#666666]">{item.subtitle}</p>
                </div>
                <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', flagged ? 'bg-[#035C6C]' : 'bg-[#D0D5DD]')} aria-hidden="true" />
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPartStatus(item.key, 'missing')}
                  aria-pressed={status === 'missing'}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                    status === 'missing' ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#ECECEC]',
                  )}
                >
                  Missing
                </button>
                <button
                  type="button"
                  onClick={() => setPartStatus(item.key, 'damaged')}
                  aria-pressed={status === 'damaged'}
                  className={cx(
                    'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                    status === 'damaged' ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#ECECEC]',
                  )}
                >
                  Damaged
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </Section>
  );

  // "Others" accordion — the Partner app's custom-issue card (see addCustomIssue).
  const othersOpen = expandedIssueCategories.includes(OTHERS_KEY);
  const customIssueName = customIssueDraft.name.trim();
  const customIssuesCard = (
    <div className="overflow-hidden rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] transition">
      <button
        type="button"
        onClick={() => toggleIssueCategory(OTHERS_KEY)}
        aria-expanded={othersOpen}
        className={cx('flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition', othersOpen ? 'bg-[#F3F3F3]' : 'hover:bg-[#F3F3F3]')}
      >
        <span
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition',
            form.customIssues.length ? 'bg-[#035C6C] text-white' : 'bg-[#F8F8F8] text-[#035C6C]',
          )}
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#111111]">Others</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#666666]">
            Add a custom issue
            {form.customIssues.length ? (
              <span className="inline-flex items-center rounded-full bg-[#F8F8F8] px-2 py-0.5 text-[0.68rem] font-bold text-[#035C6C]">
                {form.customIssues.length} added
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform duration-200', othersOpen && 'rotate-180')} aria-hidden="true" />
      </button>

      <div className={cx('grid transition-all duration-200 ease-out', othersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-dashed border-[#ECECEC] px-3 py-3">
            {form.customIssues.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#035C6C] bg-white px-3.5 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#035C6C] text-white">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#111111]">{c.name}</p>
                  <p className="truncate text-xs text-[#666666]">
                    {repairCategoryNames.get(c.categoryId) || 'Others'} ·{' '}
                    {Number(draftServicePrices[c.id]) > 0 ? money(draftServicePrices[c.id]) : 'Price TBD'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomIssue(c.id)}
                  className={cx(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-bold text-[#666666] transition hover:border-red-300 hover:bg-red-50 hover:text-red-600',
                    FOCUS_RING,
                  )}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                </button>
              </div>
            ))}

            <div className="space-y-3 rounded-xl border border-[#ECECEC] bg-white p-3.5">
              <div>
                <label className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-[#666666]" htmlFor="custom-issue-name">
                  Issue
                </label>
                <input
                  id="custom-issue-name"
                  type="text"
                  value={customIssueDraft.name}
                  onChange={(e) => setCustomIssueField('name', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomIssue();
                    }
                  }}
                  placeholder="Describe the issue (e.g. Face ID not working)"
                  className={cx(COMPACT_INPUT_CLS, 'h-10 text-sm')}
                />
              </div>

              {relevantRepairCategories.length ? (
                <div>
                  <p className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-[#666666]">Condition Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {relevantRepairCategories.map((c) => {
                      const active = customIssueDraft.categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCustomIssueField('categoryId', active ? '' : c.id)}
                          aria-pressed={active}
                          className={cx(
                            'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                            active ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#035C6C]',
                          )}
                        >
                          {c.displayName || c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-[0.7rem] font-bold uppercase tracking-wide text-[#666666]" htmlFor="custom-issue-price">
                  Price (₹)
                </label>
                <div className="relative sm:max-w-xs">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#98A2B3]">₹</span>
                  <input
                    id="custom-issue-price"
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={customIssueDraft.price}
                    onChange={(e) => setCustomIssueField('price', e.target.value)}
                    placeholder="0 (leave blank if price is not decided yet)"
                    className={cx(COMPACT_INPUT_CLS, 'h-10 pl-7 text-sm font-semibold text-[#111111]')}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={addCustomIssue}
                disabled={!customIssueName}
                className={cx(
                  'flex w-full items-center justify-center gap-1.5 rounded-full bg-[#035C6C] py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#035C6C] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#035C6C]',
                  FOCUS_RING,
                )}
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Add Issue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Partner App RepairIssuesPicker: search, the category's issue groups as
  // tiles (first 8, then View All), a sheet to pick a group's issues, an
  // "Other Issue" tile, and the selected services with Price | Service
  // Charge | Warranty each.
  const ISSUE_FIRST_TILES = 8;
  const voiceExpanded = voiceOpen || voiceNote.status === 'recording' || Boolean(voiceNote.audioUrl);
  const voiceHint = voiceNote.status === 'recording' ? 'Recording…' : voiceNote.audioUrl ? 'Voice note attached' : '';
  const issueGroups = relevantRepairCategories
    .filter((c) => (servicesByCategoryId.get(c.id) || []).length)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => issueTileRank(a.c.displayName || a.c.name) - issueTileRank(b.c.displayName || b.c.name) || a.i - b.i)
    .map(({ c }) => c);
  const groupName = (c) => c?.displayName || c?.name || '';
  const visibleIssueGroups = showAllIssueGroups ? issueGroups : issueGroups.slice(0, ISSUE_FIRST_TILES);
  const issueSheetGroup = issueSheetId ? issueGroups.find((c) => c.id === issueSheetId) || null : null;
  const issueQ = issueQuery.trim().toLowerCase();
  const issueMatches = issueQ
    ? issueGroups
        .flatMap((c) =>
          (servicesByCategoryId.get(c.id) || [])
            .filter((x) => String(x.name || '').toLowerCase().includes(issueQ) || groupName(c).toLowerCase().includes(issueQ))
            .map((x) => ({ x, group: groupName(c) })),
        )
        .slice(0, 30)
    : [];

  const problemSection = (
    <Section title="Repair Issues" icon={Wrench}>
      <div className="space-y-3">
        <p className="-mt-1 text-xs text-[#666666]">Search or pick the repair issues for this device — each gets its own price, service charge and warranty.</p>

        {!form.categoryId ? (
          <p className="rounded-lg border border-dashed border-[#D0D5DD] bg-[#F3F3F3] px-3 py-4 text-center text-xs text-[#98A2B3]">
            Select a Device Category on the Device step to see the relevant repair options.
          </p>
        ) : (
          <>
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#035C6C]">
              <Search className="h-[17px] w-[17px] shrink-0 text-[#6B7280]" aria-hidden="true" />
              <input
                value={issueQuery}
                onChange={(e) => setIssueQuery(e.target.value)}
                placeholder="Search issue (e.g. display, battery)"
                aria-label="Search repair issue"
                className="min-w-0 flex-1 bg-transparent text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] sm:text-[13.5px]"
              />
              {issueQuery ? (
                <button type="button" onClick={() => setIssueQuery('')} aria-label="Clear issue search" className={cx('rounded-full p-0.5 text-[#6B7280]', FOCUS_RING)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>

            {issueQ ? (
              <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                {issueMatches.map(({ x, group }) => (
                  <IssueCheckRow
                    key={x.id}
                    name={x.name}
                    sub={group}
                    Icon={iconForRepairService(x.name, group)}
                    on={form.serviceIds.includes(x.id)}
                    onClick={() => toggleService(x.id)}
                  />
                ))}
                {issueMatches.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      addOtherIssue(issueQuery.trim());
                      setIssueQuery('');
                    }}
                    className={cx('flex min-h-[46px] w-full items-center gap-2.5 rounded-xl border border-dashed border-[#035C6C] bg-[#E5F3F5] px-3 text-left text-[13px] text-[#111111]', FOCUS_RING)}
                  >
                    <MessageSquarePlus className="h-[18px] w-[18px] shrink-0 text-[#035C6C]" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      No matching issue — add <span className="font-extrabold">“{issueQuery.trim()}”</span> as Other Issue
                    </span>
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                {/* Compact app-sized tiles (~120-140px): 3 across on phones, then as
                    many as fit, left to right — tiles never stretch on wide screens. */}
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]">
                  {visibleIssueGroups.map((c) => (
                    <IssueTile
                      key={c.id}
                      name={groupName(c)}
                      Icon={iconForRepairCategory(groupName(c))}
                      picked={(servicesByCategoryId.get(c.id) || []).filter((x) => form.serviceIds.includes(x.id)).length}
                      onClick={() => setIssueSheetId(c.id)}
                    />
                  ))}
                  <IssueTile
                    name="Other Issue"
                    Icon={MessageSquarePlus}
                    picked={form.customIssues.length}
                    onClick={() => setTypeSheet({ title: 'Other Issue', placeholder: 'Describe the issue (e.g. Face ID not working)', initial: '', onDone: addOtherIssue })}
                  />
                </div>
                {issueGroups.length > ISSUE_FIRST_TILES ? (
                  <button
                    type="button"
                    onClick={() => setShowAllIssueGroups((v) => !v)}
                    className={cx('mx-auto flex items-center gap-0.5 rounded-md py-1 text-[12.5px] font-bold text-[#035C6C]', FOCUS_RING)}
                  >
                    {showAllIssueGroups ? 'Show less' : `View All (${issueGroups.length})`}
                    <ChevronDown className={cx('h-3.5 w-3.5 transition', showAllIssueGroups && 'rotate-180')} aria-hidden="true" />
                  </button>
                ) : null}
                {issueGroups.length === 0 ? (
                  <p className="text-xs text-[#98A2B3]">No repair issues are set up for this device category yet — use Other Issue.</p>
                ) : null}
              </>
            )}
          </>
        )}

        {chosenServices.length > 0 ? (
          <div className="pt-1">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[13px] font-extrabold text-[#111111]">Selected Services ({chosenServices.length})</p>
              <p className={cx('text-[13px] font-extrabold', draftServicesSubtotal > 0 ? 'text-[#035C6C]' : 'text-[#6B7280]')}>
                {draftServicesSubtotal > 0 ? money(draftServicesSubtotal) : 'Not Estimated'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {chosenServices.map((x) => {
                const group = x.isCustom ? 'Other Issue' : repairCategoryNames.get(x.categoryId) || '';
                return (
                  <SelectedIssueRow
                    key={x.id}
                    name={x.name}
                    sub={group}
                    Icon={x.isCustom ? MessageSquarePlus : iconForRepairService(x.name, group)}
                    price={draftServicePrices[x.id] || ''}
                    charge={draftServiceCharges[x.id] || ''}
                    warranty={draftServiceWarranty[x.id] || ''}
                    note={draftServiceNotes[x.id] || ''}
                    onNote={(v) => setDraftServiceNotes((m) => ({ ...m, [x.id]: v }))}
                    onPrice={(v) => setDraftServicePrice(x.id, v)}
                    onCharge={(v) => setDraftServiceCharge(x.id, v)}
                    onWarranty={(v) => setDraftServiceWarranty((w) => ({ ...w, [x.id]: v }))}
                    onRemove={() => removeChosenService(x)}
                  />
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[#6B7280]">Price and Service Charge add to the estimate. Notes are saved with the booking; warranty is a note only.</p>
          </div>
        ) : null}

        {/* Voice note — the app's collapsible "Record Voice Note (optional)" card, right under the issues. */}
        <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-3">
          <button
            type="button"
            onClick={() => setVoiceOpen((v) => !v)}
            aria-expanded={voiceExpanded}
            className={cx('flex w-full items-center gap-2.5 rounded-lg text-left', FOCUS_RING)}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5F3F5]">
              <Mic className={cx('h-[18px] w-[18px]', voiceNote.status === 'recording' ? 'text-[#DC2626]' : 'text-[#035C6C]')} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[#111111]">
                Record Voice Note <span className="text-[12px] font-normal text-[#6B7280]">(optional)</span>
              </span>
              {voiceHint ? <span className="block truncate text-[12px] text-[#6B7280]">{voiceHint}</span> : null}
            </span>
            {voiceExpanded ? <ChevronDown className="h-[18px] w-[18px] text-[#9CA3AF]" aria-hidden="true" /> : <ChevronRight className="h-[18px] w-[18px] text-[#9CA3AF]" aria-hidden="true" />}
          </button>
          {voiceExpanded ? (
            <div className="mt-2.5">
              <VoiceNoteCard voice={voiceNote} />
            </div>
          ) : null}
        </div>
      </div>

      {issueSheetGroup ? (
        <IssueSheet title={groupName(issueSheetGroup)} Icon={iconForRepairCategory(groupName(issueSheetGroup))} onClose={() => setIssueSheetId(null)}>
          {(servicesByCategoryId.get(issueSheetGroup.id) || []).map((x) => (
            <IssueCheckRow
              key={x.id}
              name={x.name}
              Icon={iconForRepairService(x.name, groupName(issueSheetGroup))}
              on={form.serviceIds.includes(x.id)}
              onClick={() => {
                // Select / unselect, then the sheet closes by itself (as in the app).
                toggleService(x.id);
                setIssueSheetId(null);
              }}
            />
          ))}
        </IssueSheet>
      ) : null}
      {typeSheet ? <TypeSheet key={typeSheet.title} sheet={typeSheet} onClose={() => setTypeSheet(null)} /> : null}
    </Section>
  );

  /**
   * Device Files — the Partner app's DeviceInformationScreen card: Front Side
   * and Back Side photos (required, see SECTION_VALIDATORS) plus an optional
   * Full Coverage video, one tile per DEVICE_FILE_SLOTS entry. Rendered beside
   * Estimated Delivery inside pickupSection (Device Information shows the
   * same files view-only, in pickupSummarySection). Every upload is a real call to
   * shop media storage with the shop's own bearer token (uploadShopDevicePhoto,
   * the same endpoint the public /repair flow's photo picker uses), and the
   * URLs are saved on the ticket as devicePhotosJson {front, back, video}.
   */
  // App format: Camera · Gallery · Video buttons, then the added files as
  // thumbnails (tap × to remove). Photos fill the Front, then Back slot; the
  // video fills Full Coverage — still saved as devicePhotosJson {front, back, video}.
  const devicePhotoSlots = DEVICE_FILE_SLOTS.filter((slot) => !slot.video);
  const deviceVideoSlot = DEVICE_FILE_SLOTS.find((slot) => slot.video) || null;
  const nextDevicePhotoSlot = devicePhotoSlots.find((slot) => !form[slot.field] && !photoUploading[slot.key]) || null;
  const deviceMediaBusy = Object.values(photoUploading).some(Boolean);
  const addDeviceMedia = (slot, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (slot && file) handlePhotoUpload(slot, file);
  };
  const deviceMediaShown = DEVICE_FILE_SLOTS.filter((slot) => form[slot.field] || photoUploading[slot.key]);
  // Still read by the display-only summary (pickupSummarySection).
  const deviceFilesAdded = DEVICE_FILE_SLOTS.filter((slot) => form[slot.field]).length;
  const devicePhotosCard = (
    <div className="min-w-0 rounded-xl border border-[#ECECEC] bg-white p-4">
      <p className="mb-2 text-sm font-bold text-[#111111]">
        Device Photo or Video <span className="font-normal text-[#6B7280]">(Optional)</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'camera', label: 'Camera', Icon: Camera, slot: nextDevicePhotoSlot, accept: 'image/*', capture: 'environment' },
          { key: 'gallery', label: 'Gallery', Icon: ImageIcon, slot: nextDevicePhotoSlot, accept: 'image/*' },
          { key: 'video', label: 'Video', Icon: Video, slot: deviceVideoSlot && !form[deviceVideoSlot.field] ? deviceVideoSlot : null, accept: 'video/mp4,video/quicktime,video/webm' },
        ].map((b) => {
          const off = !b.slot || deviceMediaBusy;
          return (
            <label
              key={b.key}
              className={cx(
                'flex h-11 items-center justify-center gap-1.5 rounded-xl border text-[13px] font-bold transition focus-within:ring-2 focus-within:ring-[#035C6C]',
                off ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280] opacity-60' : 'cursor-pointer border-[#035C6C]/30 bg-[#E5F3F5] text-[#035C6C] hover:border-[#035C6C]',
              )}
            >
              <input type="file" accept={b.accept} capture={b.capture} disabled={off} className="sr-only" aria-label={`Add ${b.label.toLowerCase()}`} onChange={(e) => addDeviceMedia(b.slot, e)} />
              {deviceMediaBusy && b.key !== 'video' ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <b.Icon className="h-[18px] w-[18px]" aria-hidden="true" />}
              {b.label}
            </label>
          );
        })}
      </div>
      {deviceMediaShown.length ? (
        <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {deviceMediaShown.map((slot) => (
            <div key={slot.key} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F3F4F6]">
                {photoUploading[slot.key] ? (
                  <span className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[#035C6C]" aria-hidden="true" />
                  </span>
                ) : slot.video ? (
                  <a href={form[slot.field]} target="_blank" rel="noreferrer" className="flex h-full items-center justify-center bg-[#111111]" aria-label={`Open ${slot.label}`}>
                    <Video className="h-8 w-8 text-white" aria-hidden="true" />
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded device photo (remote URL).
                  <img src={form[slot.field]} alt={slot.label} className="h-full w-full object-cover" />
                )}
                {form[slot.field] ? (
                  <button
                    type="button"
                    onClick={() => removePhoto(slot)}
                    aria-label={`Remove ${slot.label}`}
                    className={cx('absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#111111]/70 text-white', FOCUS_RING)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 truncate text-center text-[11.5px] font-semibold text-[#6B7280]">{slot.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  /* ---- Booking & Delivery (app format): Booking Time, then the delivery date + time ---- */
  const deliveryDayLabel = (d) => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const same = (x, y) => x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
    const short = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (same(d, today)) return `Today, ${short}`;
    if (same(d, tomorrow)) return `Tomorrow, ${short}`;
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const bookingDeliveryCard = (
    <div className="min-w-0 rounded-xl border border-[#ECECEC] bg-white p-4">
      <p className="mb-2 text-sm font-bold text-[#111111]">Booking Time</p>
      <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5E7EB] px-3">
        <Calendar className="h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" />
        <span className="flex-1 text-[13px] text-[#6B7280]">Booking Time</span>
        <span className="truncate text-[13.5px] font-bold text-[#111111]">
          {deliveryDayLabel(draftReceivedAt).split(',')[0]}, {fmtChipTime(draftReceivedAt)}
        </span>
      </div>
      <p className="mb-1.5 mt-3 text-[12.5px] font-bold text-[#111111]">Estimated &amp; Delivery Time</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setReadyByPickerOpen(true)}
          aria-label={`Delivery date ${deliveryDayLabel(draftReadyBy)}. Change.`}
          className={cx('flex h-11 min-w-0 flex-[1.2] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-2.5 text-left transition hover:border-[#035C6C]', FOCUS_RING)}
        >
          <Calendar className="h-[18px] w-[18px] shrink-0 text-[#035C6C]" aria-hidden="true" />
          <span className="truncate text-[13.5px] font-bold text-[#111111]">{deliveryDayLabel(draftReadyBy)}</span>
        </button>
        <button
          type="button"
          onClick={() => setReadyByPickerOpen(true)}
          aria-label={`Delivery time ${fmtChipTime(draftReadyBy)}. Change.`}
          className={cx('flex h-11 min-w-0 flex-[0.8] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-2.5 text-left transition hover:border-[#035C6C]', FOCUS_RING)}
        >
          <Timer className="h-[18px] w-[18px] shrink-0 text-[#035C6C]" aria-hidden="true" />
          <span className="truncate text-[13.5px] font-bold text-[#111111]">{fmtChipTime(draftReadyBy)}</span>
        </button>
      </div>
      <p className="mt-1.5 text-[11.5px] text-[#6B7280]">Ready in {durationLabel(draftDurationMinutes)} from booking · estimate only, not saved with this booking.</p>
    </div>
  );

  /* ---- More Device Details (app format): two folds in one box ---- */
  const lockIsSet = Boolean(form.deviceSecurityType) && form.deviceSecurityType !== 'NONE';
  const lockSummaryText = !lockIsSet
    ? 'None'
    : lockValueValid
      ? `${lockLabel} · ${'•'.repeat(Math.min(String(form.devicePin || '').length, 8))}`
      : `${lockLabel} — not entered`;
  const missingPartsChecklist = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {MISSING_PART_ITEMS.map((item) => {
        const status = missingParts[item.key];
        return (
          <div
            key={item.key}
            className={cx(
              'min-w-0 rounded-[14px] p-2.5',
              status === 'damaged' ? 'border-[1.5px] border-[#F84141] bg-[#FEECEC]' : status === 'missing' ? 'border-[1.5px] border-[#F3BF23] bg-[#FFF8E1]' : 'border border-[#F3F4F6] bg-white',
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]', status ? 'bg-white' : 'bg-[#E5F3F5]')}>
                <item.icon className={cx('h-4 w-4', status === 'damaged' ? 'text-[#F84141]' : status === 'missing' ? 'text-[#C99A00]' : 'text-[#035C6C]')} aria-hidden="true" />
              </span>
              <p className="line-clamp-2 text-[13px] font-extrabold text-[#111111]">{item.title}</p>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {[
                ['missing', 'Missing', 'border-[1.5px] border-[#F3BF23] bg-[#FFF8E1] text-[#8A6A00]'],
                ['damaged', 'Damaged', 'border-[1.5px] border-[#F84141] bg-[#FEECEC] text-[#D63232]'],
              ].map(([key, label, onCls]) => {
                const on = status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${item.title} ${label}`}
                    onClick={() => setPartStatus(item.key, key)}
                    className={cx(
                      'flex min-h-[30px] min-w-0 flex-1 items-center justify-center gap-0.5 rounded-[9px] px-1 text-[11px] font-bold transition',
                      FOCUS_RING,
                      on ? onCls : 'border border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB]',
                    )}
                  >
                    {on ? <X className="h-2.5 w-2.5 shrink-0" strokeWidth={2.75} aria-hidden="true" /> : null}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
            {status ? (
              <input
                value={missingPartDetails[item.key] || ''}
                onChange={(e) => setMissingPartDetails((d) => ({ ...d, [item.key]: e.target.value.slice(0, 120) }))}
                placeholder="Add details…"
                aria-label={`${item.title} details`}
                className="mt-2 h-9 w-full rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C] sm:text-[12px]"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
  const moreDeviceDetails = (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-bold text-[#111111]">More Device Details</p>
      <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
        <div id="bs-part-missingParts" className="scroll-mt-28">
          <button
            type="button"
            onClick={() => setOpenFolds((o) => ({ ...o, missingParts: !o.missingParts }))}
            aria-expanded={Boolean(openFolds.missingParts)}
            className={cx('flex min-h-[48px] w-full items-center gap-2 px-3 text-left', FOCUS_RING)}
          >
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[#111111]">
              Missing / Damaged Parts <span className="font-normal text-[#6B7280]">(Optional)</span>
            </span>
            {flaggedPartsCount ? (
              <span className="shrink-0 text-[11.5px] font-extrabold text-[#D63232]">
                {flaggedPartsCount} Part{flaggedPartsCount === 1 ? '' : 's'} Flagged
              </span>
            ) : null}
            <ChevronDown className={cx('h-[18px] w-[18px] shrink-0 text-[#111111] transition', openFolds.missingParts && 'rotate-180')} aria-hidden="true" />
          </button>
          {openFolds.missingParts ? <div className="px-3 pb-3">{missingPartsChecklist}</div> : null}
        </div>
        <div className="h-px bg-[#E5E7EB]" />
        <div id="bs-part-deviceSecurity" className="scroll-mt-28">
          <button
            type="button"
            onClick={() => setOpenFolds((o) => ({ ...o, deviceSecurity: !o.deviceSecurity }))}
            aria-expanded={Boolean(openFolds.deviceSecurity)}
            className={cx('flex min-h-[48px] w-full items-center gap-2 px-3 text-left', FOCUS_RING)}
          >
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[#111111]">
              Device Security <span className="font-normal text-[#6B7280]">(Optional)</span>
            </span>
            <span className={cx('max-w-[45%] shrink-0 truncate text-[12px] font-bold', fieldErrors.devicePin ? 'text-[#F84141]' : lockIsSet ? 'text-[#035C6C]' : 'text-[#6B7280]')}>
              {lockSummaryText}
            </span>
            <ChevronDown className={cx('h-[18px] w-[18px] shrink-0 text-[#111111] transition', openFolds.deviceSecurity && 'rotate-180')} aria-hidden="true" />
          </button>
          {openFolds.deviceSecurity ? <div className="px-3 pb-2">{deviceSecuritySection}</div> : null}
        </div>
      </div>
    </div>
  );

  const pickupSection = (
    <Section title="Service Price & Issue Estimate" icon={Receipt} className="space-y-4">
      {/* Two columns from md up — Bill Details + IMEI on the left, Issue
          Description & Voice Note on the right; on phones they stack in
          that same order, with Delivery + Photos and approval below. Both
          columns stretch to the taller one so their bottoms line up: the
          Bill Details list and the Issue Description textarea take up the slack. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="contents">
          {/* Bill Details — same real chosenServices/draftServicePrices/toggleService
              this page already collects, restyled as an itemized bill. Each line
              price is entered on the Add Issue / Service tab and summed into the
              real, submitted form.serviceCharge (see the sync effect near
              draftServicesSubtotal); the Estimated Total banner below is that
              same real, submitted totals.total from estimateTotal(). */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#ECECEC] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECECEC] bg-[#F3F3F3] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[#035C6C]">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#111111]">Bill Details</p>
                  <p className="text-xs text-[#666666]">Services selected for this device</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#D0D5DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054]">
                  {chosenServices.length} item{chosenServices.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSection('problem')}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F3BF23] px-3 py-1.5 text-xs font-bold text-[#111111] transition hover:bg-[#E5B11A]"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add Service
                </button>
              </div>
            </div>

            {chosenServices.length === 0 ? (
              <p className="flex-1 px-4 py-6 text-center text-sm text-[#98A2B3]">No services selected yet — add one from Add Issue / Service above.</p>
            ) : (
              <div className="flex-1 divide-y divide-dashed divide-[#ECECEC]">
                {chosenServices.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-xs font-bold text-[#035C6C]">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#111111]">{s.name}</p>
                      {draftServiceWarranty[s.id] ? <p className="text-xs text-[#666666]">{draftServiceWarranty[s.id]} months warranty (draft)</p> : null}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#344054]">{money(lineAmount(s.id))}</span>
                    <button
                      type="button"
                      onClick={() => removeChosenService(s)}
                      aria-label={`Remove ${s.name}`}
                      className="shrink-0 rounded-lg p-1.5 text-[#98A2B3] transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 bg-[#F8F8F8] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-[#111111]">Estimated Total</p>
                  <p className="text-[0.7rem] text-[#666666]">Final amount may vary based on parts availability.</p>
                </div>
              </div>
              <span className="shrink-0 text-lg font-extrabold text-[#111111]">{money(totals.total)}</span>
            </div>
          </div>

          {/* Device IMEI — same real form.imei field as Device Details; shown
              again here since this tab is now the estimate/summary step. The
              tip below is just real, static help text (dialing *#06# is a
              genuine phone feature). The "Scan" button is disabled — there's no
              camera/OCR capability anywhere in this app to back it; it's shown
              for layout parity with the reference design, not as a working
              feature (same treatment as Assign/Receipt/Barcode elsewhere in the
              shop dashboard before those got real pages). */}
          <div className="rounded-xl border border-[#ECECEC] bg-white p-4">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <FormField label="Device IMEI / Serial Number">
                  <input
                    className={COMPACT_INPUT_CLS}
                    value={form.imei}
                    onChange={(e) => set('imei', e.target.value)}
                    placeholder="Enter 15-digit IMEI"
                  />
                </FormField>
              </div>
              <button
                type="button"
                disabled
                title="Camera IMEI scanning isn't available in the shop portal yet"
                className="mb-[3px] inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg bg-[#F3F3F3] px-3.5 py-2.5 text-sm font-bold text-[#98A2B3]"
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                Scan
              </button>
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-[#F8F8F8] px-3 py-2 text-xs text-[#035C6C]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Tip: dial *#06# on the device to display the IMEI as a barcode.
            </p>
          </div>

        </div>

      </div>

      {/* App order: Device Photo or Video · More Device Details · Booking & Delivery. */}
      <div className="mt-4 space-y-4">
        {devicePhotosCard}
        {moreDeviceDetails}
        {bookingDeliveryCard}
      </div>

      {readyByPickerOpen ? (
        <DateTimeSheet
          title="Ready by"
          description="Pick the date and time the device will be ready. Duration is recalculated from it."
          confirmLabel="Set ready by"
          initialValue={draftReadyBy}
          onConfirm={(next) => {
            applyReadyBy(next);
            setReadyByPickerOpen(false);
          }}
          onClose={() => setReadyByPickerOpen(false)}
        />
      ) : null}

      {/* Customer Booking approval — required (see SECTION_VALIDATORS). */}
      <label
        ref={registerField(fieldRefs, 'customerApproved')}
        className={cx(
          'mt-4 flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4',
          fieldErrors.customerApproved ? 'border-red-300 bg-red-50/40' : customerApproved ? 'border-[#035C6C] bg-[#F8F8F8]' : 'border-[#ECECEC]',
        )}
      >
        <input
          type="checkbox"
          checked={customerApproved}
          onChange={(e) => {
            setCustomerApproved(e.target.checked);
            if (fieldErrors.customerApproved) setFieldErrors((prev) => ({ ...prev, customerApproved: undefined }));
          }}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D0D5DD] text-[#035C6C] focus:ring-[#035C6C]"
        />
        <span>
          <span className="block text-sm font-bold text-[#111111]">
            Customer Booking approval <span className="text-red-500">*</span>
          </span>
          <span className="block text-xs text-[#666666]">Customer agreed to proceed with the service booking</span>
          {fieldErrors.customerApproved ? <span className="mt-1 block text-xs font-semibold text-red-600">{fieldErrors.customerApproved}</span> : null}
        </span>
      </label>
    </Section>
  );

  /**
   * Service Price & Issue Estimate, display only — what the Device Info tab
   * shows under Device Information. Same real state as pickupSection
   * (services and prices, totals, IMEI, issue description, voice note,
   * delivery estimate, device files, approval) with every edit control left
   * out: no Add Service / remove, no inputs, no pickers or uploads. Changes
   * are made on the Price & Estimate tab itself.
   */
  const issueDescriptionText = form.issueDescription.trim();
  const pickupSummarySection = (
    <Section title="Service Price & Issue Estimate" subtitle="View only — make changes on the Price & Estimate tab." icon={Receipt}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#ECECEC] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECECEC] bg-[#F3F3F3] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[#035C6C]">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#111111]">Bill Details</p>
                  <p className="text-xs text-[#666666]">Services selected for this device</p>
                </div>
              </div>
              <span className="rounded-full border border-[#D0D5DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#344054]">
                {chosenServices.length} item{chosenServices.length === 1 ? '' : 's'}
              </span>
            </div>

            {chosenServices.length === 0 ? (
              <p className="flex-1 px-4 py-6 text-center text-sm text-[#98A2B3]">No services selected.</p>
            ) : (
              <div className="flex-1 divide-y divide-dashed divide-[#ECECEC]">
                {chosenServices.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-xs font-bold text-[#035C6C]">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#111111]">{s.name}</p>
                      {draftServiceWarranty[s.id] ? <p className="text-xs text-[#666666]">{draftServiceWarranty[s.id]} months warranty (draft)</p> : null}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[#344054]">{money(lineAmount(s.id))}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 bg-[#F8F8F8] px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-bold text-[#111111]">Estimated Total</p>
                  <p className="text-[0.7rem] text-[#666666]">Final amount may vary based on parts availability.</p>
                </div>
              </div>
              <span className="shrink-0 text-lg font-extrabold text-[#111111]">{money(totals.total)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#ECECEC] bg-white p-4">
            <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[#666666]">Device IMEI / Serial Number</p>
            <p className={cx('break-all rounded-lg bg-[#F8F8F8] px-3 py-2.5 text-sm font-semibold', form.imei.trim() ? 'text-[#111111]' : 'text-[#98A2B3]')}>
              {form.imei.trim() || 'Not provided'}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col rounded-xl border border-[#ECECEC] bg-white p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#111111]">
            <Wrench className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
            Issue Description &amp; Voice Note
          </p>
          <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[#666666]">Issue Description</p>
          <p
            className={cx(
              'min-h-[110px] grow whitespace-pre-wrap break-words rounded-lg bg-[#F8F8F8] px-3 py-2.5 text-sm',
              issueDescriptionText ? 'text-[#111111]' : 'text-[#98A2B3]',
            )}
          >
            {issueDescriptionText || 'Not provided'}
          </p>

          <div className="mt-4 border-t border-dashed border-[#ECECEC] pt-3">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[#666666]">Voice Note</p>
            <VoiceNoteCard voice={voiceNote} readOnly />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-[#ECECEC] bg-white p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#111111]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[#035C6C]">
              <Truck className="h-4 w-4" aria-hidden="true" />
            </span>
            Estimated Delivery
          </p>

          <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            <div className="min-w-[108px] shrink-0 rounded-xl bg-[#F8F8F8] px-3 py-2.5">
              <p className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wide text-[#666666]">
                <Calendar className="h-3 w-3" aria-hidden="true" /> Received
              </p>
              <p className="mt-1 text-sm font-bold text-[#111111]">{fmtChipDate(draftReceivedAt)}</p>
              <p className="text-xs text-[#666666]">{fmtChipTime(draftReceivedAt)}</p>
            </div>

            <ChevronRight className="my-auto h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />

            <div className="min-w-[108px] shrink-0 rounded-xl bg-[#F8F8F8] px-3 py-2.5">
              <p className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wide text-[#666666]">
                <Timer className="h-3 w-3" aria-hidden="true" /> Duration
              </p>
              <p className="mt-1 text-sm font-bold text-[#111111]">{durationLabel(draftDurationMinutes)}</p>
            </div>

            <ChevronRight className="my-auto h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />

            <div className="min-w-[108px] shrink-0 rounded-xl bg-[#F3BF23] px-3 py-2.5 text-[#1E1E1E]">
              <p className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wide">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Ready By
              </p>
              <p className="mt-1 text-sm font-bold">{fmtChipDate(draftReadyBy)}</p>
              <p className="text-xs">{fmtChipTime(draftReadyBy)}</p>
            </div>
          </div>

          <p className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-[#98A2B3]">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" /> Estimate only — not saved with this booking.
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-[#ECECEC] bg-white p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[#035C6C]">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#111111]">Device Files</p>
              <p className="text-xs text-[#666666]">
                {deviceFilesAdded}/{DEVICE_FILE_SLOTS.length} added
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {DEVICE_FILE_SLOTS.map((slot) => {
              const url = form[slot.field];
              const SlotIcon = slot.video ? Video : ImageIcon;
              return (
                <div key={slot.key} className="flex min-w-0 flex-col items-center">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${slot.label}`}
                      className={cx('relative block h-28 w-full overflow-hidden rounded-2xl border-2 border-[#035C6C] bg-[#E5F3F5]', FOCUS_RING)}
                    >
                      {slot.video ? (
                        <>
                          <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white">
                            <Video className="h-6 w-6" aria-hidden="true" />
                          </span>
                        </>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element -- shop-uploaded device photo, remote media URL. */
                        <img src={url} alt={slot.label} className="h-full w-full object-cover" />
                      )}
                    </a>
                  ) : (
                    <div className="flex h-28 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D0D5DD] bg-[#F8F8F8] text-[#98A2B3]">
                      <SlotIcon className="h-5 w-5" aria-hidden="true" />
                      <span className="mt-2 text-xs font-semibold">Not added</span>
                    </div>
                  )}
                  <p className="mt-1.5 text-center text-[13px] font-bold text-[#111111]">{slot.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={cx(
          'mt-4 flex items-start gap-3 rounded-xl border p-4',
          customerApproved ? 'border-[#035C6C] bg-[#F8F8F8]' : 'border-[#ECECEC] bg-white',
        )}
      >
        <span
          className={cx(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
            customerApproved ? 'bg-[#035C6C] text-white' : 'bg-[#F3F3F3] text-[#98A2B3]',
          )}
        >
          {customerApproved ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
        </span>
        <span>
          <span className="block text-sm font-bold text-[#111111]">Customer Booking approval</span>
          <span className="block text-xs text-[#666666]">
            {customerApproved ? 'Customer agreed to proceed with the service booking' : 'Not approved yet'}
          </span>
        </span>
      </div>
    </Section>
  );

  /**
   * Service Booking Devices List — 8th of 9 tabs (Booking Confirmation is
   * now the true last one), a booking review screen built entirely from
   * state the earlier tabs already collected (see bookingDevices' doc
   * comment above). "+ Add another device" is disabled: this client's
   * booking form is a single flat object, not an array of devices, so real
   * multi-device support would mean restructuring every earlier tab's
   * state — a much bigger change than this section on its own, and not one
   * to make silently as a side effect of a review screen. Its own "Submit
   * Booking" bar calls the exact same submit() the shared step footer's
   * "Confirm Booking" button does on this same tab — not a second,
   * parallel submission path — and submit() itself navigates to the
   * confirmation tab on success.
   */
  const bookingDevicesSection = (
    <Section
      title="Service Booking Devices List"
      icon={ClipboardList}
      action={
        isEditing ? null : (
        <button
          type="button"
          onClick={addAnotherDevice}
          className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-[#ECECEC] bg-white px-3 py-2 text-left transition hover:border-[#035C6C] hover:bg-[#F8F8F8]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[#035C6C]">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[#035C6C]">Add another device</span>
          </span>
        </button>
        )
      }
    >
      <p className="-mt-1 mb-4 text-xs text-[#666666]">Review customer devices and services.</p>

      {/* Left: customer + devices. Right: bill summary + payment (stacks on mobile). "Add another device" lives in the Section header. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#ECECEC] bg-white p-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[#035C6C]">
              <User className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[#98A2B3]">Customer</p>
              <p className="truncate text-sm font-bold text-[#111111]">{form.customerName || 'Not provided'}</p>
              <p className="truncate text-xs text-[#666666]">{form.customerMobile || 'Not provided'}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#F3F3F3] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#035C6C]">Verified</span>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[0.7rem] font-bold uppercase tracking-wide text-[#666666]">Devices in this Booking</p>
            <span className="shrink-0 rounded-full bg-[#F8F8F8] px-2.5 py-1 text-xs font-bold text-[#035C6C]">
              {bookingDevices.length} Device{bookingDevices.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-3">
            {bookingDevices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#D0D5DD] bg-[#F3F3F3] px-3 py-6 text-center text-xs text-[#98A2B3]">
                No device selected yet — pick a brand and model on the Device Details tab.
              </p>
            ) : (
              bookingDevices.map((d, idx) => (
                <div key={idx} className="rounded-xl border border-[#ECECEC] bg-white p-3.5">
                  <div className="flex items-start gap-3">
                    <Thumb url={d.image} name={d.model || d.brand} size="h-14 w-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#111111]">
                        {deviceTitle(d.brand, d.model) || 'Device not specified'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {d.brand ? (
                          <span className="rounded-full bg-[#F8F8F8] px-2 py-0.5 text-[0.65rem] font-bold text-[#035C6C]">{d.brand}</span>
                        ) : null}
                        {d.modelCode ? (
                          <span className="rounded-full bg-[#F3F3F3] px-2 py-0.5 text-[0.65rem] font-bold text-[#344054] ring-1 ring-[#ECECEC]">
                            {d.modelCode}
                          </span>
                        ) : null}
                        {d.isPrimary ? (
                          <span className="rounded-full bg-[#F3F3F3] px-2 py-0.5 text-[0.65rem] font-bold text-[#035C6C]">Primary Device</span>
                        ) : null}
                      </div>
                    </div>
                    {d.queuedIndex !== undefined ? (
                      <button
                        type="button"
                        onClick={() => removeQueuedDevice(d.queuedIndex)}
                        className="shrink-0 rounded-lg border border-[#ECECEC] px-2.5 py-1 text-xs font-bold text-[#666666] transition hover:border-red-300 hover:text-red-600"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 border-t border-dashed border-[#ECECEC] pt-3">
                    <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#98A2B3]">
                      Repair Services ({d.selectedServices.length})
                    </p>
                    {d.selectedServices.length ? (
                      <ul className="space-y-1">
                        {d.selectedServices.map((s, i) => (
                          <li key={s.id || i} className="flex min-w-0 items-center gap-2 break-words text-sm text-[#344054]">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-[0.6rem] font-bold text-[#035C6C]">
                              {i + 1}
                            </span>
                            {s.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#98A2B3]">No services selected yet.</p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#F8F8F8] px-3 py-2.5">
                    <span className="text-xs font-bold text-[#035C6C]">Estimated repair amount</span>
                    <span className="text-sm font-extrabold text-[#111111]">{money(d.estimatedAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-5 lg:sticky lg:top-4 lg:col-span-2">
          <div className="rounded-xl border border-[#ECECEC] bg-white p-4">
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-[#666666]">Bill Summary</p>
            <div className="space-y-2">
              {bookingDevices.map((d, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words text-[#344054]">
                    {deviceTitle(d.brand, d.model) || 'Device'}
                    <span className="ml-1.5 text-xs text-[#98A2B3]">
                      ({d.selectedServices.length} service{d.selectedServices.length === 1 ? '' : 's'})
                    </span>
                  </span>
                  <span className="shrink-0 font-bold text-[#111111]">{money(d.estimatedAmount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#ECECEC] pt-3">
              <span className="text-sm font-bold text-[#111111]">Grand Total</span>
              <span className="text-lg font-extrabold text-[#035C6C]">{money(grandTotal)}</span>
            </div>
            <p className="mt-2 text-[0.7rem] text-[#98A2B3]">Final amount may vary slightly based on parts availability and inspection.</p>
          </div>

          <div className="rounded-xl border border-[#ECECEC] bg-white p-4">
            <p className="mb-3 text-[0.7rem] font-bold uppercase tracking-wide text-[#666666]">Payment</p>
            <FormField label="Payment Mode">
              <select className={COMPACT_INPUT_CLS} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                <option value="">Select payment mode</option>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </FormField>
            <p className="mt-2 text-xs text-[#98A2B3]">Pick a mode to record money collected now. Leave it blank if the customer pays on delivery.</p>
          </div>
        </div>
      </div>
    </Section>
  );

  /**
   * Booking Confirmation — the 9th and true last tab. Gated on `confirmed`
   * itself (set only by a real successful submit(), never speculatively):
   * before that it shows a plain "nothing submitted yet" state rather than
   * a fake success screen, even if someone taps straight to this tab.
   * "Share Receipt"/"Barcode Print" link to the real, already-built
   * Receipt/QR pages for this booking id. "Assign Technician" opens the
   * shared AssignTechnicianModal (PATCH {TICKET_BASE}/tickets/{ticketId}),
   * with a per-device picker when several devices were booked.
   */
  const confirmedBookings = confirmed ? (confirmed.allBookings?.length ? confirmed.allBookings : [confirmed]) : [];

  const confirmationSection = (
    <Section title="Booking Confirmation" icon={CheckCircle2}>
      {!confirmed ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F3F3F3] px-4 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#98A2B3]">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-bold text-[#344054]">No booking submitted yet</p>
          <p className="max-w-xs text-xs text-[#98A2B3]">
            Complete the previous steps and submit from Service Booking Devices List to see your confirmation here.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Shop header — avatar, shop name, booking date & time (the app's receipt header). */}
          <div className="mx-auto flex max-w-3xl items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#C7E6EA] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- static public logo. */}
              <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-[#111111]">{shopLocation?.name || 'Your Shop'}</p>
              <p className="text-[11px] text-[#6B7280]">Booking Receipt</p>
            </div>
            <div className="shrink-0 text-right text-[11px]">
              <p className="flex items-center justify-end gap-1 font-bold text-[#111111]">
                <Calendar className="h-3 w-3 text-[#035C6C]" aria-hidden="true" />
                {fmtChipDate(draftReceivedAt)}
              </p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[#6B7280]">
                <Timer className="h-3 w-3 text-[#035C6C]" aria-hidden="true" />
                {fmtChipTime(draftReceivedAt)}
              </p>
            </div>
          </div>

          {/* Top success area — visual only, same data/handler as before */}
          <div className="relative overflow-hidden rounded-3xl bg-[#F8F8F8] px-4 py-8 text-center sm:px-6 sm:py-9">
            <span className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white ring-4 ring-white">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#035C6C] text-white">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </span>
            </span>
            <h3 className="relative text-2xl font-extrabold text-[#111111]">Thank You!</h3>
            <p className="relative mt-1 text-sm font-medium text-[#666666]">Your booking has been placed.</p>
            <button
              type="button"
              onClick={copyTrackingId}
              className="relative mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#035C6C] ring-1 ring-[#ECECEC] transition"
            >
              #{confirmed.bookingNumber}
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* The app's receipt: Customer Details · Device & Repair Details (every
              device) · Service Information — each repair issue with its own price,
              its Service Charge on a separate line, then the Estimated Repair Price. */}
          {(() => {
            const devices = confirmed.receiptDevices?.length ? confirmed.receiptDevices : [];
            const created = confirmed.allBookings?.length ? confirmed.allBookings : [confirmed];
            const many = devices.length > 1;
            const priceLines = devices.flatMap((d, i) => {
              const tag = many ? `Device ${i + 1} · ` : '';
              const lines = d.lines || [];
              return [
                ...lines.map((l) => ({ label: `${tag}${l.name}`, amount: l.price })),
                ...lines.filter((l) => l.charge > 0).map((l) => ({ label: `${tag}Service Charge – ${l.name}`, amount: l.charge })),
              ];
            });
            const total = devices.length
              ? devices.reduce((sum, d) => sum + (Number(d.estimatedAmount) || 0), 0)
              : Number(confirmed.pricing?.estimatedAmount) || 0;
            return (
              <div className="mx-auto max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-6">
                <ReceiptSection label="Customer Details">
                  <ReceiptRow icon={User} label="Customer Name" value={confirmed.customerName} />
                  <ReceiptRow icon={Phone} label="Mobile Number" value={confirmed.customerMobile} />
                  <ReceiptRow icon={MapPin} label="Address" value={shopAddress} />
                </ReceiptSection>

                <ReceiptSection label="Device & Repair Details">
                  {(devices.length ? devices : [{ brand: confirmed.brandName, model: confirmed.modelName, image: confirmed.deviceImage }]).map((d, i, all) => (
                    <div key={i} className={cx(i > 0 && 'mt-3 border-t border-[#F3F4F6] pt-3')}>
                      <div className="mb-2 flex items-center gap-2.5">
                        <Thumb url={d.image || created[i]?.deviceImage} name={d.model} size="h-10 w-10" />
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-extrabold text-[#111111]">
                            {[d.brand, d.model].filter(Boolean).join(' · ') || 'Device'}
                          </p>
                          {created[i] && bookingRef(created[i]) ? <p className="text-[11px] font-bold text-[#035C6C]">#{String(bookingRef(created[i])).replace(/^#/, '')}</p> : null}
                        </div>
                        {all.length > 1 ? <span className="ml-auto shrink-0 text-[11px] font-bold text-[#6B7280]">Device {i + 1}</span> : null}
                      </div>
                      {d.modelCode ? <ReceiptRow icon={Hash} label="Model No." value={d.modelCode} /> : null}
                      {d.variant ? <ReceiptRow icon={Info} label="Variant" value={d.variant} /> : null}
                      {d.imei ? <ReceiptRow icon={Hash} label="IMEI" value={d.imei} /> : null}
                      <ReceiptRow
                        icon={Wrench}
                        label="Repair Issues"
                        value={(d.lines || []).map((l) => (l.note ? `${l.name} (${l.note})` : l.name)).join(', ') || (created[i]?.services || []).map((x) => x.serviceName).join(', ')}
                      />
                      {(d.lines || []).some((l) => l.warranty) ? (
                        <ReceiptRow
                          icon={ShieldCheck}
                          label="Warranty"
                          value={(d.lines || []).filter((l) => l.warranty).map((l) => `${l.name}: ${l.warranty} Mo`).join(', ')}
                        />
                      ) : null}
                      {d.deviceMissingParts ? <ReceiptRow icon={ListChecks} label="Missing Parts" value={d.deviceMissingParts} /> : null}
                      <ReceiptRow icon={Timer} label="Estimated Time" value={`${fmtChipDate(draftReadyBy)} · ${fmtChipTime(draftReadyBy)}`} />
                    </div>
                  ))}
                </ReceiptSection>

                <ReceiptSection label="Service Information" last>
                  <ReceiptRow icon={Hash} label="Tracking ID" value={`#${confirmed.bookingNumber}`} bold />
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7280]">
                      <Timer className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
                      Status
                    </span>
                    <span className="rounded-full border border-[#C7E6EA] bg-[#E5F3F5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#024A57]">
                      {{ CREATED: 'Order Placed' }[confirmed.status] || confirmed.status || 'Order Placed'}
                    </span>
                  </div>
                  {priceLines.map((p, j) => (
                    <ReceiptRow key={j} icon={Receipt} label={p.label} value={money(p.amount)} />
                  ))}
                  <div className="mt-2 border-t border-dashed border-[#E5E7EB] pt-2">
                    <ReceiptRow icon={Receipt} label="Estimated Repair Price" value={money(total)} bold />
                  </div>
                </ReceiptSection>
              </div>
            );
          })()}

          {/* Booking confirmed status banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#035C6C] text-white">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#035C6C]">Booking confirmed!</p>
              <p className="text-xs font-medium text-[#666666]">Your request is ready for technician assignment.</p>
            </div>
          </div>

          {/* Action cards — same 3 actions/links, as compact white rows
              (icon chip + title/subtitle + chevron) instead of tall yellow tiles. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              type="button"
              disabled={!confirmedBookings.some((b) => b.ticketId)}
              onClick={() => {
                if (confirmedBookings.length > 1) setAssignPickerOpen((v) => !v);
                else setAssignTarget(confirmedBookings[0]);
              }}
              className={cx(CONFIRM_ACTION_CLS, 'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[#ECECEC]')}
            >
              <span className={CONFIRM_ACTION_ICON_CLS}>
                <UserCog className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#111111]">
                  {confirmedBookings.length === 1 && assignedTechs[confirmedBookings[0].ticketId] ? 'Reassign Technician' : 'Assign Technician'}
                </span>
                <span className="block truncate text-xs text-[#666666]">
                  {confirmedBookings.length === 1 && assignedTechs[confirmedBookings[0].ticketId]
                    ? `Assigned to ${assignedTechs[confirmedBookings[0].ticketId]}`
                    : confirmedBookings.length > 1
                      ? `Choose a device (${confirmedBookings.length})`
                      : 'Assign technician to repair'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:text-[#035C6C]" aria-hidden="true" />
            </button>
            <Link
              href={`/shop-home/services/bookings/view/receipt/?id=${encodeURIComponent(confirmed.id)}`}
              className={CONFIRM_ACTION_CLS}
            >
              <span className={CONFIRM_ACTION_ICON_CLS}>
                <Share2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#111111]">Share Receipt</span>
                <span className="block truncate text-xs text-[#666666]">Share booking details</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:text-[#035C6C]" aria-hidden="true" />
            </Link>
            <Link
              href={`/shop-home/services/bookings/view/qr/?id=${encodeURIComponent(confirmed.id)}`}
              className={CONFIRM_ACTION_CLS}
            >
              <span className={CONFIRM_ACTION_ICON_CLS}>
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#111111]">Barcode Print</span>
                <span className="block truncate text-xs text-[#666666]">Print booking label</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:text-[#035C6C]" aria-hidden="true" />
            </Link>
          </div>

          {/* Several devices booked: pick which one to assign */}
          {assignPickerOpen && confirmedBookings.length > 1 ? (
            <div className="overflow-hidden rounded-2xl border border-[#ECECEC] bg-[#F8F8F8]">
              {confirmedBookings.map((b) => (
                <div key={b.ticketId || b.bookingNumber} className="flex items-center justify-between gap-3 border-b border-[#ECECEC] px-4 py-3 last:border-b-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#111111]">{deviceTitle(b.brandName, b.modelName) || 'Device'}</p>
                    <p className="text-xs text-[#666666]">
                      #{b.bookingNumber}
                      {assignedTechs[b.ticketId] ? ` · Assigned to ${assignedTechs[b.ticketId]}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!b.ticketId}
                    onClick={() => setAssignTarget(b)}
                    className="shrink-0 rounded-lg bg-[#F3BF23] px-3 py-1.5 text-xs font-bold text-[#111111] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {assignedTechs[b.ticketId] ? 'Reassign' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <AssignTechnicianModal
            open={Boolean(assignTarget)}
            ticketId={assignTarget?.ticketId}
            currentTechnicianId={assignTarget ? assignedTechs[`${assignTarget.ticketId}:id`] : null}
            bookingLabel={assignTarget ? [`#${assignTarget.bookingNumber}`, deviceTitle(assignTarget.brandName, assignTarget.modelName)].filter(Boolean).join(' · ') : ''}
            onClose={() => setAssignTarget(null)}
            onAssigned={(ticket) => {
              const key = assignTarget?.ticketId;
              if (!key) return;
              setAssignedTechs((prev) => ({
                ...prev,
                [key]: ticket?.assignedTechnicianName || 'technician',
                [`${key}:id`]: ticket?.assignedTechnicianId || null,
              }));
            }}
          />

          {/* Bottom buttons — same actions/hrefs, pill hierarchy */}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className={cx(
                'rounded-full border-2 border-[#D0D5DD] bg-white px-6 py-2.5 text-sm font-bold text-[#344054] transition hover:border-[#035C6C] hover:text-[#035C6C]',
                FOCUS_RING,
              )}
            >
              Create another booking
            </button>
            <Link
              href="/shop-home/services/bookings"
              className={cx(
                'rounded-full bg-[#F3BF23] px-6 py-2.5 text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A]',
                FOCUS_RING,
              )}
            >
              View bookings
            </Link>
          </div>
        </div>
      )}
    </Section>
  );

  const sectionContent = {
    customer: customerSection,
    device: deviceSection,
    // Devices & Repair — one screen, as in the Partner App. Device Info heads
    // it; its old Price & Estimate summary is dropped (the editable section is
    // on the same screen now).
    repair: (
      <>
        {queuedDevices.length && !isEditing ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#C7E6EA] bg-[#E5F3F5] px-3.5 py-2.5 text-[13px] text-[#024A57]">
            <span className="font-extrabold">
              {queuedDevices.length} device{queuedDevices.length === 1 ? '' : 's'} already in this booking
            </span>
            <span className="min-w-0 truncate">
              · {queuedDevices.map((q) => [q.payload?.brandName, q.payload?.modelName].filter(Boolean).join(' ') || 'Device').join(', ')}
            </span>
          </div>
        ) : null}
        <div id="bs-part-deviceInfo" className="scroll-mt-28">{deviceInfoSection}</div>
        <div id="bs-part-problem" className="scroll-mt-28">{problemSection}</div>
        <div id="bs-part-pickup" className="scroll-mt-28">{pickupSection}</div>
      </>
    ),
    devicesList: bookingDevicesSection,
    confirmation: confirmationSection,
  };

  if (isEditing && !editTicket) {
    return (
      <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-8 text-center">
        {editError ? (
          <>
            <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#111111]">{editError}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditRetry((k) => k + 1)}
                className={cx('rounded-xl bg-[#035C6C] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#035C6C]', FOCUS_RING)}
              >
                Retry
              </button>
              <Link href="/shop-home/services/bookings/" className={cx('rounded-xl border border-[#ECECEC] bg-white px-4 py-2 text-sm font-bold text-[#111111]', FOCUS_RING)}>
                Back to Bookings
              </Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[#035C6C]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#666666]">Loading booking for re-estimate…</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#035C6C]/30 bg-[#E5F3F5] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Icon3D flat icon={Pencil} tone="green" size="md" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#024A57]">Re-Estimate</p>
              <p className="break-words text-base font-extrabold text-[#111111]">
                Editing {editTicket.trackingId ? `#${editTicket.trackingId}` : 'booking'}
                {form.customerName ? ` · ${form.customerName}` : ''}
              </p>
            </div>
          </div>
          <Link
            href="/shop-home/services/bookings/"
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C]',
              FOCUS_RING,
            )}
          >
            <X className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
            Cancel
          </Link>
        </div>
      ) : null}
      {/* Page actions (the header banner was removed; the page title lives in the top bar). */}
      <div className={cx('flex flex-wrap items-center justify-end gap-2', isEditing && 'hidden')}>
        <Link
          href="/shop-home/services/customers"
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C]',
            FOCUS_RING,
          )}
        >
          <History className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
          Customer History
        </Link>
        <button
          type="button"
          onClick={resetForm}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C]',
            FOCUS_RING,
          )}
        >
          <RotateCcw className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
          Reset
        </button>
      </div>

      {profileError ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{profileError}</span>
        </div>
      ) : null}

      {/* Step progress — one large white rounded container, each step a rich
          tile (number circle + icon + title + subtitle), chevrons between,
          matching a reference design's 4-step progress bar. There are 9 real
          steps here (not 4 — every existing tab is kept, none removed), so
          the row scrolls horizontally with a hidden scrollbar past the
          viewport width, same technique as before this redesign. */}
      <div className="overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F3F3F3] px-1.5 sm:px-3">
        <div
          className="flex flex-nowrap items-stretch justify-between gap-0 overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onWheel={(e) => {
            // Lets a plain (non-Shift) mouse wheel scroll this row
            // horizontally too, not just Shift+wheel/trackpad — only when
            // there's actually somewhere to scroll, and only takes over
            // vertical wheel motion (a trackpad's native horizontal swipe,
            // e.buttonwheel deltaX, is left alone).
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth) return;
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              el.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
        >
          {SECTIONS.map((s) => {
            const active = activeSection === s.key;
            // Not `disabled` — the click still runs handleTabClick so the user
            // gets sent to Devices List with a hint instead of a dead button.
            const locked = s.key === 'confirmation' && !confirmed;
            return (
              <div key={s.key} className="flex shrink-0 items-center">
                <button
                  ref={(el) => {
                    tabRefs.current[s.key] = el;
                  }}
                  type="button"
                  onClick={() => handleTabClick(s.key)}
                  aria-current={active ? 'step' : undefined}
                  aria-disabled={locked || undefined}
                  title={locked ? 'Submit the booking from Review & Confirm first' : s.label}
                  className={cx(
                    // Shorter/narrower tiles on phones so more steps fit before the row scrolls.
                    'relative flex h-[76px] min-w-[92px] flex-1 shrink-0 flex-col items-center justify-center gap-1.5 px-2 text-center transition sm:h-[92px] sm:min-w-[112px] sm:gap-2 sm:px-3',
                    FOCUS_RING,
                    active ? 'text-[#035C6C]' : locked ? 'cursor-not-allowed text-[#111111]/35' : 'text-[#111111]/70 hover:text-[#111111]',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-9 w-9 items-center justify-center rounded-full transition sm:h-10 sm:w-10',
                      active ? 'bg-[#035C6C] text-white' : locked ? 'text-[#111111]/35' : 'text-[#111111]',
                    )}
                  >
                    <MaterialIcon name={s.ms} filled className="h-[22px] w-[22px]" />
                  </span>
                  <span className={cx('whitespace-nowrap text-[13px] sm:text-[14px]', active ? 'font-semibold' : 'font-medium')}>{s.short}</span>
                  {active ? <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#035C6C]" aria-hidden="true" /> : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div className="space-y-4">
        {sectionContent[activeSection]}
      </div>

      {celebrating ? <BookingSuccessBurst onDone={() => setCelebrating(false)} /> : null}

      {/* Step footer — Previous / Next, or Confirm Booking on the last tab.
          Hidden once a booking is confirmed: nothing is left to estimate, and
          going back would only re-open the submitted form. The confirmation's
          own bottom buttons take over from there. */}
      <div
        className={cx(
          // Clears the iOS home indicator; on phones the buttons drop to a full-width row under the total.
          'sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 overflow-hidden rounded-[20px] border border-[#ECECEC] bg-[#F3F3F3]/95 p-3 backdrop-blur sm:p-4',
          activeSection === 'confirmation' && confirmed && 'hidden',
        )}
      >
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          {/* The total only means something once issues are priced: Customer / Device show just Previous / Next. */}
          {activeSection === 'repair' || activeSection === 'devicesList' ? (
            <div className="flex items-center gap-3">
              <Icon3D flat icon={Receipt} tone="green" size="md" />
              <div>
                <p className="text-xs font-semibold text-[#666666]">Estimated Total</p>
                <p className="text-lg font-extrabold text-[#111111]">{money(totals.total)}</p>
              </div>
            </div>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            {activeIndex > 0 ? (
              <button
                type="button"
                onClick={goPrev}
                className={cx(
                  'flex-1 rounded-xl border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F3F3F3] sm:flex-none',
                  FOCUS_RING,
                )}
              >
                Previous
              </button>
            ) : null}
            {activeSection === 'repair' && !isEditing ? (
              // Bulk booking, as in the app's Devices & Repair footer: queue this
              // device (validated) and start the next one for the same customer.
              <button
                type="button"
                onClick={addAnotherDevice}
                className={cx(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[#035C6C] bg-white px-4 py-2.5 text-sm font-bold text-[#035C6C] transition hover:bg-[#E5F3F5] sm:flex-none',
                  FOCUS_RING,
                )}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sm:hidden">Add Device</span>
                <span className="hidden sm:inline">Add Another Device</span>
              </button>
            ) : null}
            {activeSection === 'confirmation' ? null : activeSection === 'devicesList' ? (
              // The submit-triggering tab is devicesList specifically, not
              // just "whichever tab is last" (confirmation is now last, and
              // has nothing left to confirm) — this button and devicesList's
              // own "Submit Booking" bar both call the exact same submit(),
              // never two different code paths.
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className={cx(
                  'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#F3BF23] px-5 py-2.5 text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none',
                  FOCUS_RING,
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isEditing ? (submitting ? 'Saving…' : 'Save Re-Estimate') : submitting ? 'Creating booking…' : 'Confirm Booking'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className={cx(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#F3BF23] px-5 py-2.5 text-sm font-bold text-[#111111] transition hover:bg-[#E5B11A] sm:flex-none',
                  FOCUS_RING,
                )}
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
