/**
 * siteContent.js — the single source of truth for the public NearGFix marketing site.
 *
 * Every string in here is real product copy taken from the shipping NearGFix
 * customer app, shop app and subscription model. Pages MUST import from this
 * module rather than hardcoding copy, so facts (prices, limits, contact
 * details) never diverge between pages.
 *
 * Plain data only — no JSX, no React imports. Icons are referenced by NAME
 * (a string) and resolved through the explicit lookup map in
 * src/components/site/ui.js, which keeps lucide-react tree-shakeable and
 * static-export safe.
 */

/* -------------------------------------------------------------------------- */
/* Brand                                                                       */
/* -------------------------------------------------------------------------- */

export const BRAND = {
  name: 'NearGFix',
  company: 'GloboGreen',
  tagline: 'Repair · Buy · Sell — at your fingertips',
  taglineShort: 'Fast. Trusted. Tech Solutions',
  taglineLong: 'Repair, Buy, Sell or Pickup – All in one place!',
  /* No adoption / social-proof line lives here on purpose. NearGFix has not
     published its apps yet, so any "trusted by N shops across India" claim
     would be unverifiable. Do not add one back without real, citable numbers. */
  description:
    'NearGFix is a multi-tenant platform connecting mobile repair shops and customers — book repairs, schedule doorstep pickups, sell your old phone, and manage your entire repair shop from one app.',
  website: 'www.globogreen.in',
  websiteUrl: 'https://www.globogreen.in',
  email: 'support@neargfix.com',
  emailHref: 'mailto:support@neargfix.com',
  phone: '+91 81241 23452',
  phoneHref: 'tel:+918124123452',
  whatsapp: '+91 81241 23452',
  whatsappHref: 'https://wa.me/918124123452',
  logo: '/logo.png',
  logoAlt: 'NearGFix logo',
  customerAppName: 'NearGFix - Customer',
  shopAppName: 'NearGFix Shop',
  appsStatus: 'Coming soon to Play Store & App Store',
};

/* -------------------------------------------------------------------------- */
/* Navigation                                                                  */
/* -------------------------------------------------------------------------- */

/* Repair / Sell / Buy are in-page anchors to the home detail sections. The     */
/* shop-owner landing (/shop) and Pricing are deliberately NOT in the primary   */
/* nav any more — they live in FOOTER_NAV below so neither page is orphaned.    */
export const SITE_NAV = [
  { href: '/', label: 'Home' },
  { href: '/repair', label: 'Repair' },
  { href: '/#sell', label: 'Sell Device' },
  { href: '/#buy', label: 'Buy Devices' },
  { href: '/nearby-shops', label: 'Nearby Shops' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export const FOOTER_NAV = [
  {
    title: 'Customers',
    links: [
      { href: '/', label: 'For Customers' },
      { href: '/repair', label: 'Book a repair' },
      { href: '/sell', label: 'Sell your device' },
      { href: '/buy', label: 'Buy refurbished' },
      { href: '/nearby-shops', label: 'Shops near you' },
    ],
  },
  /* The SEO landing pages (src/app/(customer)/repair/[category]) — linked from
     every page here so each one is reachable and crawlable. Slugs must match
     REPAIR_CATEGORY_CONTENT in src/lib/repairSeoContent.js. */
  {
    title: 'Repair services',
    links: [
      { href: '/repair/mobile', label: 'Mobile phone repair' },
      { href: '/repair/tablet', label: 'Tablet repair' },
      { href: '/repair/laptop', label: 'Laptop repair' },
      { href: '/repair/smartwatch', label: 'Smartwatch repair' },
      { href: '/repair/audio', label: 'Earbuds & speaker repair' },
    ],
  },
  {
    title: 'Shop owners',
    links: [
      { href: '/sell-with-us', label: 'For Shops' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About NearGFix' },
      { href: '/contact', label: 'Contact us' },
      { href: '/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/disclaimer', label: 'Disclaimer' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Home — the menu section (section 2), one group per customer journey         */
/* -------------------------------------------------------------------------- */

export const HOME_MENU = {
  eyebrow: 'What NearGFix does',
  title: 'Three things you can do with your device',
  subtitle:
    'Repair it, sell it or replace it — all against the exact model you own, and all handled by the same verified shops near you.',
};

/* `action` is the verb prefix CategoryRail puts in front of each tile label     */
/* ("Repair Mobile", "Sell Laptop"). `href` is an in-page anchor to the matching */
/* detail section further down the home page.                                    */
export const HOME_MENU_GROUPS = [
  {
    key: 'repair',
    action: 'Repair',
    /* A real page, not an in-page anchor like sell/buy — /repair exists. */
    href: '/repair',
    title: 'Repair your device',
    blurb:
      'Book a doorstep pickup or an in-shop repair, quoted against your exact model — and approve the estimate before any work starts.',
    cta: 'See how a repair works',
  },
  {
    key: 'sell',
    action: 'Sell',
    href: '#sell',
    title: 'Sell your old device',
    blurb:
      'Answer a short condition check and several nearby shops send you quotations — you compare the offers and accept the one you like.',
    cta: 'See how selling works',
  },
  {
    key: 'buy',
    action: 'Buy',
    href: '#buy',
    title: 'Buy refurbished & accessories',
    blurb:
      'Refurbished handsets, accessories and spares listed by the same verified shops that carry out the repairs.',
    cta: 'See what you can buy',
  },
];

/* -------------------------------------------------------------------------- */
/* Near Shops (/nearby-shops)                                                  */
/* The live /shops and /shops/nearby responses carry ONLY name, address,        */
/* latitude, longitude, isOpen — plus distanceKm on /nearby. No ratings, no      */
/* photos, no opening hours, no phone numbers. Copy here must not promise them.  */
/* -------------------------------------------------------------------------- */

export const NEARBY = {
  eyebrow: 'Nearby Shops',
  title: 'Find nearby NearGFix shops',
  subtitle:
    'Share your location and we will list the NearGFix shops within 20 km, closest first, with the name, address and whether the shop is open right now.',
  radiusKm: 20,
  ctaLabel: 'Use my location',
  ctaLabelRetry: 'Update my location',
  clearLabel: 'Clear location',
  permissionHint:
    'Your browser will ask for permission. Your coordinates are stored in this browser to sort shops by distance, and are sent to a third-party geocoding service only to turn them into a place name — see our Privacy Policy.',
  loadingLabel: 'Finding shops near you…',
  emptyNearbyTitle: 'No NearGFix shops within 20 km yet',
  emptyNearbyBody:
    'We are onboarding shops region by region. Browse every shop on the platform below, or contact us and we will tell you when one opens near you.',
  allShopsTitle: 'All NearGFix shops',
  allShopsBody:
    'Every shop currently live on the platform. Turn on location to see which of them are within 20 km of you.',
  errorTitle: 'We could not load shops right now',
  errorBody:
    'The shop directory did not respond. Refresh the page in a moment, or contact us and we will help you find a shop.',
  deniedTitle: 'Location permission was declined',
  deniedBody:
    'No problem — every NearGFix shop is listed below. You can allow location later to sort them by distance.',
  openLabel: 'Open now',
  closedLabel: 'Closed now',
  /* Set expectations explicitly so the sparse cards read as intentional. */
  dataNote:
    'Shop listings show name, address, distance and open/closed status only. For services, prices or a phone number, contact the shop through the NearGFix app.',
};

/* -------------------------------------------------------------------------- */
/* Site search — client-side only, over bundled content. No backend call.      */
/* -------------------------------------------------------------------------- */

export const SEARCH_PLACEHOLDER = 'Search devices, repairs and answers…';

/* buildSearchIndex lives at the bottom of this file, after DEVICE_CATEGORIES   */
/* and FAQS are declared.                                                       */

/* -------------------------------------------------------------------------- */
/* Customer app — the four hero tiles (verbatim subtitles + badges)            */
/* -------------------------------------------------------------------------- */

export const CUSTOMER_SERVICES = [
  {
    key: 'repair',
    title: 'Repair',
    subtitle: 'Doorstep & in-shop repair service',
    badge: null,
    icon: 'Wrench',
    href: '/#repair',
  },
  {
    key: 'sell',
    title: 'Sell',
    subtitle: 'Get the best resale value',
    badge: 'BEST VALUE',
    icon: 'IndianRupee',
    href: '/#sell',
  },
  {
    key: 'buy',
    title: 'Buy',
    subtitle: 'Accessories & more',
    badge: 'SHOP',
    icon: 'ShoppingBag',
    href: '/#buy',
  },
  {
    key: 'pickup',
    title: 'Pickup',
    subtitle: 'Doorstep collection',
    badge: 'DOORSTEP',
    icon: 'Truck',
    href: '/#pickup',
  },
];

export const CUSTOMER_TABS = ['Home', 'Repair', 'Sell', 'Buy', 'Profile'];

export const ENQUIRY_CARD = {
  title: 'Service Enquiry',
  description: 'Chat with nearby repair shops — pick one and message directly',
  icon: 'MessageSquare',
};

/** Still exported for reuse, but no longer rendered on the home page. */
export const LOCATION_COPY =
  'We use your location to show pickup-enabled repair shops nearby and to set your default delivery address.';

/* -------------------------------------------------------------------------- */
/* Customer journeys                                                           */
/* -------------------------------------------------------------------------- */

export const REPAIR_STEPS = [
  {
    title: 'Pick your device',
    description:
      'Drill down from category to brand, series, model and variant so the shop knows exactly what it is working on.',
    icon: 'Smartphone',
  },
  {
    title: 'Choose the repair service',
    description:
      'Select what needs fixing and add a note or a voice recording describing the problem in your own words.',
    icon: 'Wrench',
  },
  {
    title: 'Review your report',
    description:
      'See the device, the selected services and the estimate summary on one screen before anything is booked.',
    icon: 'ClipboardList',
  },
  {
    title: 'Enquiry or doorstep pickup',
    description:
      'Message nearby shops to compare, or go straight to a doorstep pickup from a pickup-enabled shop.',
    icon: 'Route',
  },
  {
    title: 'Choose a shop near you',
    description:
      'Browse pickup-enabled shops within a 20 km radius, check their details and ratings, and pick one.',
    icon: 'MapPin',
  },
  {
    title: 'Address and pickup slot',
    description:
      'Confirm your address and choose a collection slot that suits you, from the slots that shop actually collects in.',
    icon: 'CalendarClock',
  },
  {
    title: 'Track it live',
    description:
      'Follow every status change on a full event timeline, approve the repair estimate, and download your receipt and invoice.',
    icon: 'Navigation',
  },
];

export const SELL_STEPS = [
  {
    title: 'Select your device',
    description: 'Category, brand, series, model and variant.',
    icon: 'Smartphone',
  },
  {
    title: 'Working or dead',
    description: 'Tell us whether the device switches on at all.',
    icon: 'BatteryCharging',
  },
  {
    title: 'Screening questions',
    description: 'A short set of questions about the overall health of the device.',
    icon: 'CircleHelp',
  },
  {
    title: 'Screen condition',
    description: 'Cracks, scratches, dead pixels or display lines.',
    icon: 'MonitorSmartphone',
  },
  {
    title: 'Functional issues',
    description: 'Camera, speaker, mic, buttons, charging and network faults.',
    icon: 'Stethoscope',
  },
  {
    title: 'Device configuration',
    description: 'Confirm the RAM, storage and colour of your handset.',
    icon: 'Cpu',
  },
  {
    title: 'Accessories & warranty',
    description: 'Box, charger, bill and whether the device is still in warranty.',
    icon: 'Package',
  },
  {
    title: 'Add photos',
    description: 'Upload real photos of the device so shops can quote accurately.',
    icon: 'Camera',
  },
  {
    title: 'Your address',
    description: 'Where the device should be collected from.',
    icon: 'MapPin',
  },
  {
    title: 'Compare quotations',
    description:
      'Multiple nearby shops send you quotations. You compare them side by side and accept the best one — that is the whole point.',
    icon: 'Handshake',
    highlight: true,
  },
];

export const SELL_HIGHLIGHT = {
  title: 'Multiple shops bid. You pick the winner.',
  description:
    'Most resale apps give you one take-it-or-leave-it number. NearGFix sends your device details to nearby shops and lets several of them quote — so you compare real offers and accept the one you like.',
};

export const BUY_FEATURES = [
  {
    title: 'Refurbished devices',
    description: 'Second-hand handsets listed by the same verified shops that do the repairs.',
    icon: 'Smartphone',
  },
  {
    title: 'Accessories & spares',
    description: 'Chargers, cables, cases, screen guards and spare parts, browsable by category.',
    icon: 'ShoppingBag',
  },
  {
    title: 'Product details & cart',
    description: 'Full listings with photos and specs, a normal cart, and order history under My Orders.',
    icon: 'Package',
  },
];

export const CUSTOMER_EXTRAS = [
  {
    title: 'Shops within 20 km',
    description:
      'Shop discovery finds repair shops near you inside a 20 km radius, with details and ratings on each.',
    icon: 'MapPin',
  },
  {
    title: 'Chat directly with a shop',
    description:
      'A proper inbox and message threads between you and the shop — ask before you book, follow up after.',
    icon: 'MessageCircle',
  },
  {
    title: 'All your orders in one place',
    description:
      'My Orders splits into Buy, Sell, Pickup, Enquiry and Service, each with Pending, Completed and Cancelled.',
    icon: 'ListChecks',
  },
  {
    title: 'Manage devices & addresses',
    description:
      'Save the devices you own and multiple delivery addresses so your next booking takes seconds.',
    icon: 'Smartphone',
  },
  {
    title: 'Estimates you approve',
    description:
      'Nothing gets repaired at a surprise price — you see the estimate and approve it from inside the app.',
    icon: 'BadgeCheck',
  },
  {
    title: 'Biometric App Lock',
    description:
      'Lock the app behind Face ID or your fingerprint. Sign in with phone and OTP or a password.',
    icon: 'ScanFace',
  },
];

/* -------------------------------------------------------------------------- */
/* Shop app                                                                    */
/* -------------------------------------------------------------------------- */

export const SHOP_TABS = ['Home', 'Bookings', 'Invoices', 'Buy', 'Sell', 'Settings'];

export const SHOP_QUICK_ACTIONS = [
  'New Booking',
  'Pickup',
  'All Bookings',
  'Invoices',
  'Booking Status',
  'Enquiry',
];

export const SHOP_DASHBOARD_STATS = [
  { label: 'Bookings', hint: 'all-time' },
  { label: 'Active', hint: 'in pipeline' },
  { label: 'Delivered', hint: 'handed back to the customer' },
];

export const SHOP_FEATURES = [
  {
    key: 'bookings',
    title: 'Bookings that follow a real lifecycle',
    description:
      'Every job moves through Service Accepted, Technician Assigned, In Service Process, Work Completed, Out for Delivery and Delivered — plus a Work Pending state while a quote awaits customer approval.',
    icon: 'ClipboardList',
    points: [
      'Dashboard counters for all-time, active and delivered jobs',
      'Booking status board and full booking timeline',
      'Work Pending state for quoted jobs awaiting approval',
    ],
  },
  {
    key: 'intake',
    title: 'IMEI and QR scan intake',
    description:
      'The booking wizard identifies the handset by IMEI scan or QR scan and auto-fills the brand and model, so you are not typing model numbers at the counter.',
    icon: 'ScanLine',
    points: [
      'Identify device by IMEI scan or QR scan',
      'Colour, storage and device information capture',
      'Falls back to the manual category → brand → model picker',
    ],
  },
  {
    key: 'security',
    title: 'Device security & missing parts',
    description:
      'Record the unlock PIN or pattern and note any missing parts at intake, so there is no argument about what came in with the device.',
    icon: 'LockKeyhole',
    points: [
      'Device PIN / pattern captured at intake',
      'Missing parts checklist on the booking',
      'Services, price estimate and customer details in the same wizard',
    ],
  },
  {
    key: 'technicians',
    title: 'Technicians get their own app view',
    description:
      'Assign a technician during intake. They see only their assigned tickets, update status, add repair notes and upload repair images from the same app.',
    icon: 'HardHat',
    points: [
      'Assigned tickets list and status updates',
      'Repair notes and repair image uploads',
      'Apply for leave, upload KYC, manage profile',
    ],
  },
  {
    key: 'employees',
    title: 'Employees, attendance and payroll records',
    description:
      'Add staff, take geofenced daily attendance, approve leave, and pull the reports you actually need at month end.',
    icon: 'Users',
    points: [
      'Geofenced daily attendance for all staff',
      'Leave requests and approvals, permission, late-hours report',
      'Salary report, payslips, salary advances, shift details',
      'Working records, pickup report and staff report',
    ],
  },
  {
    key: 'pickup',
    title: 'Doorstep pickup service',
    description:
      'Accept pickup requests, assign a pickup person, and control exactly when and where you collect.',
    icon: 'Truck',
    points: [
      'Pickup request queue with list and detail views',
      'Configurable slot timings',
      'Configurable pickup zones',
    ],
  },
  {
    key: 'inventory',
    title: 'Inventory & marketplace',
    description:
      'Track your stock, and buy or sell spare parts and gadgets through the in-app marketplace with listings, orders and a cart.',
    icon: 'Boxes',
    points: [
      'Inventory management',
      'Marketplace buy and sell for spare parts and gadgets',
      'Listings, orders and cart',
    ],
  },
  {
    key: 'invoicing',
    title: 'Invoices, labels and reports',
    description:
      'Generate invoices and delivery invoices, print barcode labels for devices on the bench, and run the reports that tell you how the shop is doing.',
    icon: 'Receipt',
    points: [
      'Invoice generator and delivery invoice',
      'Barcode / label printing',
      'Billing report, booking status report, previous bookings report',
    ],
  },
  {
    key: 'kyc',
    title: 'Guided KYC onboarding',
    description:
      'A five-screen flow — intro, upload, review, pending, view — gets your shop verified without a phone call.',
    icon: 'ShieldCheck',
    points: [
      'Aadhar and PAN required',
      'GST or Udyam — either one satisfies the requirement',
      'Track verification status inside the app',
    ],
  },
  {
    key: 'chat',
    title: 'Chat with your customers',
    description:
      'Answer enquiries from customers browsing nearby shops and keep the conversation attached to the job.',
    icon: 'MessageCircle',
    points: [
      'Customer ↔ shop message threads',
      'Push notifications for new activity',
      'Service Enquiry leads from the customer app',
    ],
  },
  {
    key: 'multishop',
    title: 'Run more than one shop',
    description:
      'Switch between your shops inside the app, and share any of them instantly with a shop QR code.',
    icon: 'Building2',
    points: [
      'Multi-shop switching',
      'Shop QR code — “Share your shop instantly”',
      'Per-shop staff, bookings and inventory',
    ],
  },
  {
    key: 'applock',
    title: 'App Lock on the counter device',
    description:
      'The shop phone or tablet sits on a counter all day. Lock the app behind a fingerprint, pattern or PIN.',
    icon: 'Lock',
    points: ['Fingerprint unlock', 'Pattern unlock', 'PIN unlock'],
  },
];

export const TICKET_LIFECYCLE = [
  {
    status: 'Service Accepted',
    description: 'The booking is confirmed and the device is logged into the shop.',
  },
  {
    status: 'Technician Assigned',
    description: 'A named technician owns the job and sees it in their own app view.',
  },
  {
    status: 'In Service Process',
    description: 'Diagnosis and repair are under way, with notes and images added as work happens.',
  },
  {
    status: 'Work Completed',
    description: 'The repair is finished and the device is ready to go back.',
  },
  {
    status: 'Out for Delivery',
    description: 'The device is on its way back to the customer.',
  },
  {
    status: 'Delivered',
    description: 'Handed over, with the invoice and service receipt available in the app.',
  },
];

export const PARTNER_BENEFITS = {
  title: 'NearGFix Partner Benefits',
  items: ['Verified shop perks', 'Faster payouts', 'Priority support'],
};

/* -------------------------------------------------------------------------- */
/* Pricing — EXACT. Do not round, do not embellish.                            */
/* -------------------------------------------------------------------------- */

export const PLANS = [
  {
    key: 'free-trial',
    name: 'Free Trial',
    price: '₹0',
    priceNote: 'for 15 days',
    period: '15 days',
    summary:
      'Auto-granted the moment you register your shop. No card required — you are running bookings the same afternoon.',
    highlight: false,
    badge: null,
    cta: { label: 'Start free trial', href: '/contact' },
    bullets: [
      'New Service Booking',
      'Up to 2 Shops',
      'Buy Products — Unlimited',
      'Sell Products — up to 5 orders',
      'Up to 3 Employees per Shop',
    ],
    excluded: ['Pickup Service'],
    limits: [
      { label: 'Shops', value: 'Up to 2' },
      { label: 'Employees per shop', value: 'Up to 3' },
      { label: 'Sell orders', value: 'Up to 5' },
      { label: 'Buy products', value: 'Unlimited' },
      { label: 'Pickup Service', value: 'Not included' },
    ],
  },
  {
    key: 'basic',
    name: 'Basic',
    price: '₹3,000',
    priceNote: 'per year, for 1 shop',
    period: 'per year',
    secondaryPrice: '₹2,500 per shop per year when you have 2 or more shops',
    summary:
      'Everything unlocked — unlimited shops, unlimited employees, unlimited sell orders, and the doorstep Pickup Service included.',
    highlight: true,
    badge: 'RECOMMENDED',
    cta: { label: 'Talk to sales', href: '/contact' },
    bullets: [
      'New Service Booking',
      'Pickup Service',
      'Buy Products — Unlimited',
      'Sell Products — Unlimited',
      'Unlimited Employees',
      'Multiple Shops',
    ],
    excluded: [],
    limits: [
      { label: 'Shops', value: 'Unlimited' },
      { label: 'Employees per shop', value: 'Unlimited' },
      { label: 'Sell orders', value: 'Unlimited' },
      { label: 'Buy products', value: 'Unlimited' },
      { label: 'Pickup Service', value: 'Included' },
    ],
  },
];

export const MULTI_SHOP_PRICING = [
  { shops: 1, label: '1 shop', price: '₹3,000' },
  { shops: 2, label: '2 shops', price: '₹5,000' },
  { shops: 3, label: '3 shops', price: '₹7,500' },
  { shops: 4, label: '4 shops', price: '₹10,000' },
  { shops: 5, label: '5 shops', price: '₹12,500' },
];

export const PRICING_NOTE =
  'Prices are per year. From your second shop onwards each shop is ₹2,500 per year instead of ₹3,000. There is no online checkout — talk to us and we will set your plan up.';

/**
 * Feature comparison grid for the pricing page. `free` / `basic` are either a
 * boolean (rendered as a tick or a dash) or a short string.
 */
export const PLAN_COMPARISON = [
  { feature: 'New Service Booking', free: true, basic: true },
  { feature: 'Buy Products', free: 'Unlimited', basic: 'Unlimited' },
  { feature: 'Sell Products', free: 'Up to 5 orders', basic: 'Unlimited' },
  { feature: 'Shops', free: 'Up to 2', basic: 'Unlimited' },
  { feature: 'Employees per shop', free: 'Up to 3', basic: 'Unlimited' },
  { feature: 'Pickup Service', free: false, basic: true },
  { feature: 'Duration', free: '15 days', basic: '1 year' },
];

/* -------------------------------------------------------------------------- */
/* Support                                                                     */
/* -------------------------------------------------------------------------- */

export const SUPPORT_TOPICS = [
  {
    key: 'track-order',
    title: 'Track an order',
    description:
      'Find any Repair, Pickup, Buy or Sell order under My Orders and follow its live status and full event history.',
    icon: 'Navigation',
  },
  {
    key: 'refund',
    title: 'Refund status',
    description:
      'Check where a refund has reached, and get help if it has not landed when you expected it to.',
    icon: 'Wallet',
  },
  {
    key: 'return-cancel',
    title: 'Return or cancel',
    description:
      'Cancel a booking or pickup you no longer need, or start a return on something you bought.',
    icon: 'RefreshCw',
  },
  {
    key: 'warranty',
    title: 'Warranty',
    description:
      'Questions about the warranty on a completed repair or on a device you bought through NearGFix.',
    icon: 'ShieldCheck',
  },
];

export const SUPPORT_CHANNELS = [
  { key: 'call', label: 'Call us', value: BRAND.phone, href: BRAND.phoneHref, icon: 'Phone' },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    value: BRAND.whatsapp,
    href: BRAND.whatsappHref,
    icon: 'MessageCircle',
  },
  { key: 'email', label: 'Email', value: BRAND.email, href: BRAND.emailHref, icon: 'Mail' },
];

/* -------------------------------------------------------------------------- */
/* About                                                                       */
/* -------------------------------------------------------------------------- */

export const ABOUT = {
  headline: 'One platform for the repair shop and the person walking into it.',
  body: [
    'NearGFix is built by GloboGreen as a multi-tenant platform for mobile repair shops — the shop side is a full point-of-sale, technician, employee and inventory system, and the customer side is an app that lets anyone book a repair, request a doorstep pickup, sell an old handset or buy a refurbished one.',
    'Most repair shops run on a paper register and a WhatsApp group. Most customers have no idea what is happening to their phone after they hand it over. NearGFix closes both gaps with the same system: the shop gets a real ticket lifecycle, and the customer gets to watch it move.',
    'The platform runs on 12 backend services covering authentication, orders, tickets, pickup, marketplace, subscriptions, master device data and more — so a shop that starts with one counter can add shops, staff and a pickup fleet without changing anything about how it works.',
  ],
};

export const ABOUT_VALUES = [
  {
    title: 'No surprise pricing',
    description:
      'Customers approve the repair estimate before work starts. Shops publish a plan that costs ₹3,000 a year — that is the whole price list.',
    icon: 'BadgeCheck',
  },
  {
    title: 'Built for how shops really work',
    description:
      'IMEI scan at the counter, device PIN written down at intake, missing parts logged, geofenced attendance for staff. Details that only matter if you have stood behind that counter.',
    icon: 'Store',
  },
  {
    title: 'Competition on the customer’s side',
    description:
      'When you sell a device, several nearby shops quote and you choose. When you need a repair, you compare shops within 20 km before you commit.',
    icon: 'Handshake',
  },
];

export const PLATFORM_FACTS = [
  { value: '15', unit: 'days', label: 'Free trial, auto-granted at registration' },
  { value: '20', unit: 'km', label: 'Radius for finding repair shops near you' },
  { value: '6', unit: 'stages', label: 'In the repair ticket lifecycle' },
  { value: '12', unit: 'services', label: 'Backend services running the platform' },
];

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

export const FAQ_CATEGORIES = ['For customers', 'For shop owners'];

export const FAQS = [
  /* ---- customers ---- */
  {
    category: 'For customers',
    question: 'How do I book a repair?',
    answer:
      'Open the Repair tab and pick your device by category, brand, series, model and variant. Choose the repair service you need, review the report, then either send an enquiry to nearby shops or book a doorstep pickup with a pickup-enabled shop. Confirm your address and a pickup slot, and you are done.',
  },
  {
    category: 'For customers',
    question: 'How far away can the shops be?',
    answer:
      'Shop discovery shows repair shops within a 20 km radius of your location, along with their details and ratings. We use your location to show pickup-enabled repair shops nearby and to set your default delivery address.',
  },
  {
    category: 'For customers',
    question: 'What is the difference between an enquiry and a doorstep pickup?',
    answer:
      'An enquiry lets you chat with nearby repair shops first — pick one and message it directly before committing. A doorstep pickup books a pickup-enabled shop to come and collect the device from your address at a slot you choose.',
  },
  {
    category: 'For customers',
    question: 'Can I see what is happening to my device?',
    answer:
      'Yes. Every booking has live order tracking and a full service event history, so you can see it move through Service Accepted, Technician Assigned, In Service Process, Work Completed, Out for Delivery and Delivered.',
  },
  {
    category: 'For customers',
    question: 'Will I be charged something I did not agree to?',
    answer:
      'No. The shop sends a repair estimate and you approve it inside the app before the work is carried out. When the job is finished you get a service receipt and an invoice in the app.',
  },
  {
    category: 'For customers',
    question: 'How does selling my old phone work?',
    answer:
      'The Sell flow walks you through your device, whether it is working or dead, a short set of screening questions, screen condition, functional issues, configuration, accessories and warranty, photos, and your address. Multiple nearby shops then send you quotations — you compare them and pick the best one.',
  },
  {
    category: 'For customers',
    question: 'Do I have to accept the first quote I get?',
    answer:
      'No, and that is the point. Several nearby shops can quote on the same device. You compare the offers side by side in the app and accept whichever one you prefer.',
  },
  {
    category: 'For customers',
    question: 'What can I buy on NearGFix?',
    answer:
      'The Buy tab has refurbished devices and accessories listed by shops on the platform, organised into categories with full product details and a cart. Your purchases appear under the Buy tab in My Orders.',
  },
  {
    category: 'For customers',
    question: 'Where do I find my past orders?',
    answer:
      'Profile → My Orders. It is split into Buy, Sell, Pickup, Enquiry and Service, and each of those has Pending, Completed and Cancelled views.',
  },
  {
    category: 'For customers',
    question: 'How do I sign in, and is the app secure?',
    answer:
      'Sign in with your phone number and an OTP, or with a password — and reset a forgotten password over OTP. You can also switch on biometric App Lock so the app needs Face ID or your fingerprint before it opens.',
  },
  {
    category: 'For customers',
    question: 'I need to track a refund, return something, or ask about warranty. Where do I go?',
    answer: `Profile → Customer Support covers tracking a Repair, Pickup, Buy or Sell order, refund status, returns and cancellations, and warranty questions. You can reach us by call, WhatsApp or email — ${BRAND.phone} or ${BRAND.email}.`,
  },
  {
    category: 'For customers',
    question: 'Where do I download the apps?',
    answer: `The NearGFix customer app and the NearGFix shop app are ${BRAND.appsStatus.toLowerCase()}. Contact us and we will tell you the moment they go live.`,
  },

  /* ---- shop owners ---- */
  {
    category: 'For shop owners',
    question: 'How long is the free trial and what does it cost?',
    answer:
      'The Free Trial is ₹0 for 15 days and it is granted automatically the moment you register as a shop owner. There is no card required to start it.',
  },
  {
    category: 'For shop owners',
    question: 'What are the limits during the free trial?',
    answer:
      'Up to 2 shops, up to 3 employees per shop, and up to 5 Sell orders. Buying products is unlimited. Pickup Service is not included in the trial — it comes with the Basic plan.',
  },
  {
    category: 'For shop owners',
    question: 'What does the paid plan cost?',
    answer:
      'The Basic plan is ₹3,000 per year for one shop. If you run two or more shops it is ₹2,500 per shop per year — so 2 shops is ₹5,000, 3 shops is ₹7,500, 4 shops is ₹10,000 and 5 shops is ₹12,500 per year.',
  },
  {
    category: 'For shop owners',
    question: 'How do I pay? Is there online checkout?',
    answer:
      'There is no self-serve payment gateway on NearGFix. Talk to our team and we will set your plan up for you. Contact details are on the Contact page.',
  },
  {
    category: 'For shop owners',
    question: 'What documents do I need for KYC?',
    answer:
      'Aadhar and PAN are both required. On top of that you need either a GST certificate or an Udyam registration — one of the two is enough. The app walks you through intro, upload, review, pending and view.',
  },
  {
    category: 'For shop owners',
    question: 'Can I run more than one shop from one login?',
    answer:
      'Yes. Multi-shop switching is built in, and each shop keeps its own staff, bookings and inventory. On the Basic plan the number of shops is unlimited; on the Free Trial you get up to 2.',
  },
  {
    category: 'For shop owners',
    question: 'How do my technicians use it?',
    answer:
      'Technicians get their own view of the app. They see the tickets assigned to them, update the status, add repair notes, upload repair images, apply for leave, upload their KYC and manage their profile.',
  },
  {
    category: 'For shop owners',
    question: 'Does it handle staff attendance and salary?',
    answer:
      'Yes. Daily attendance for all staff is geofenced to the shop, and you get leave requests and approvals, permission, a late-hours report, salary report, payslips, salary advances, shift details, working records, a pickup report and a staff report.',
  },
  {
    category: 'For shop owners',
    question: 'How fast is it to take a device in at the counter?',
    answer:
      'The intake wizard identifies the device by IMEI scan or QR scan and fills in the brand and model for you. You then capture colour and storage, device information, the security PIN or pattern, missing parts, the services needed, a price estimate, customer details and the assigned technician.',
  },
  {
    category: 'For shop owners',
    question: 'Do I have to offer doorstep pickup?',
    answer:
      'No — it is optional, and only Basic-plan shops have it. If you switch it on you control your own pickup zones and slot timings, and pickup requests arrive as their own queue with list and detail views.',
  },
  {
    category: 'For shop owners',
    question: 'Can I print invoices and labels?',
    answer:
      'Yes. There is an invoice generator, a separate delivery invoice, and barcode or label printing for devices on the bench. Reports cover billing, booking status and previous bookings.',
  },
  {
    category: 'For shop owners',
    question: 'Is my shop data separate from other shops?',
    answer:
      'NearGFix is multi-tenant — your bookings, customers, staff, inventory and invoices belong to your shop and are only reachable by your own logins. Owners, technicians and customers each authenticate separately and only see what their role allows.',
  },
  {
    category: 'For shop owners',
    question: 'The counter device is shared. Can I lock the app?',
    answer:
      'Yes. App Lock secures the shop app behind a fingerprint, a pattern or a PIN, which matters when the device sits on an open counter all day.',
  },
];

/* -------------------------------------------------------------------------- */
/* CTAs used across pages                                                      */
/* -------------------------------------------------------------------------- */

export const CTA = {
  getApp: { label: 'Get the app', href: '/contact' },
  startTrial: { label: 'Start free trial', href: '/contact' },
  talkToSales: { label: 'Talk to sales', href: '/contact' },
  contact: { label: 'Contact us', href: '/contact' },
  forShops: { label: 'For Shops', href: '/shop' },
  seePricing: { label: 'See pricing', href: '/pricing' },
  /* The shop-owner sign-in door — POST /auth/login, gated to SHOP_OWNER /
     SHOP_LOGIN accounts by src/lib/shopAuth.js. Kept distinct from
     `forShops` (the marketing page selling the idea of joining) since they
     are different destinations for different audiences. */
  businessLogin: { label: 'Business Login', href: '/sell-with-us/?login=1' },
};

/* -------------------------------------------------------------------------- */
/* Legal page metadata (content lives on the pages themselves)                 */
/* -------------------------------------------------------------------------- */

export const LEGAL_UPDATED = 'July 2026';

/* -------------------------------------------------------------------------- */
/* Device categories — mirrors GET /master/device-categories                   */
/* The rows below are the bundled fallback: the master-data service is plain    */
/* HTTP on a bare IP, so a browser on an HTTPS origin cannot reach it. The      */
/* site must render correctly from these alone.                                 */
/* -------------------------------------------------------------------------- */

export const DEVICE_CATEGORY_ORDER = ['MOBILE', 'TABLET', 'LAPTOP', 'SMARTWATCHES', 'AUDIO_DEVICE'];

export const DEVICE_CATEGORIES = [
  {
    code: 'MOBILE',
    name: 'Mobile',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1781182037/ggifx/categories/biokhpckuqpmqbotsk0a.png',
    blurb: 'Screens, batteries, charging ports and more',
  },
  {
    code: 'TABLET',
    name: 'Tablet',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1781182085/ggifx/categories/pruw6dhr8odhivex0fc3.png',
    blurb: 'Display, battery and charging repairs',
  },
  {
    code: 'LAPTOP',
    name: 'Laptop',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1781182111/ggifx/categories/oyp7ejqjqqo8td4zcjv2.png',
    blurb: 'Diagnostics, parts, servicing and upgrades',
  },
  {
    code: 'SMARTWATCHES',
    name: 'Smartwatch',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1781182103/ggifx/categories/ar7j8fyaiae3ankbcbsp.png',
    blurb: 'Glass, straps, batteries and pairing issues',
  },
  {
    code: 'AUDIO_DEVICE',
    name: 'Audio Device',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1781182021/ggifx/categories/admnqqazvivjox1x1tyf.png',
    blurb: 'Earbuds and headphones — sound, charging, fit',
  },
];

export const DEVICE_CATEGORY_SECTION = {
  eyebrow: 'Devices we cover',
  title: 'Start with your device, not a guess',
  subtitle:
    'Every category opens a full catalogue — brand, series, model and variant — so you pick the exact handset you own. The shop books and quotes against that device instead of a rough description.',
};

/* Normalise + order raw /master/device-categories rows. Pure and defensive:    */
/* bad input falls back to the bundled list, and it never throws.               */
export const sortDeviceCategories = (rows) => {
  if (!Array.isArray(rows)) return DEVICE_CATEGORIES;

  const bundled = new Map(DEVICE_CATEGORIES.map((row) => [row.code, row]));

  const normalised = rows
    .filter((row) => row && typeof row === 'object' && row.isActive !== false)
    .map((row) => {
      const code = typeof row.code === 'string' ? row.code : '';
      const known = bundled.get(code);
      const imageUrl =
        (typeof row.imageUrl === 'string' && row.imageUrl) ||
        (typeof row.imageBase64 === 'string' && row.imageBase64
          ? `data:image/png;base64,${row.imageBase64}`
          : '') ||
        (known ? known.imageUrl : '');

      return {
        // Kept so callers can match rows that reference a category by id (e.g. Buy listings).
        id: row.id ?? null,
        code,
        name: (typeof row.name === 'string' && row.name) || (known ? known.name : code),
        imageUrl,
        blurb: known ? known.blurb : '',
      };
    });

  const rank = (code) => {
    const index = DEVICE_CATEGORY_ORDER.indexOf(code);
    return index === -1 ? DEVICE_CATEGORY_ORDER.length : index;
  };

  return normalised.sort((a, b) => {
    const delta = rank(a.code) - rank(b.code);
    if (delta !== 0) return delta;
    return String(a.name).localeCompare(String(b.name));
  });
};

/* -------------------------------------------------------------------------- */
/* Search index                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build the flat list the navbar search filters over. Pure, synchronous and
 * defensive — every field is coerced and any malformed row is dropped rather
 * than thrown on, because this runs on every keystroke in the header.
 *
 * `haystack` is lowercased and deliberately includes the FAQ answer body, so a
 * search for a word that only appears in an answer still surfaces the question.
 *
 * @returns {Array<{type:'category'|'faq', label:string, hint:string, href:string, haystack:string}>}
 */
export const buildSearchIndex = () => {
  const text = (value) => (typeof value === 'string' ? value.trim() : '');

  const categories = (Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : [])
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const label = text(row.name) || text(row.code);
      if (!label) return null;
      return {
        type: 'category',
        label,
        hint: 'Device category',
        href: '/#repair',
        haystack: [label, text(row.code), text(row.blurb), 'repair sell buy device']
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    })
    .filter(Boolean);

  const faqs = (Array.isArray(FAQS) ? FAQS : [])
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const label = text(row.question);
      if (!label) return null;
      return {
        type: 'faq',
        label,
        hint: 'FAQ',
        href: '/faq',
        haystack: [label, text(row.answer), text(row.category)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    })
    .filter(Boolean);

  return categories.concat(faqs);
};

/* -------------------------------------------------------------------------- */
/* Hero banners (/master/banners)                                              */
/* -------------------------------------------------------------------------- */
/* Admin-managed slides from master-data. These bundled rows are the fallback   */
/* source of truth: the hero must still look right when the backend is          */
/* unreachable — which it WILL be once this site is served over HTTPS, since     */
/* master-data is plain HTTP on a bare IP. Verified live 2026-07-20.             */
/* STANDARD BANNER SIZE: 1028x366 px (~2.81:1). The carousel frame is locked to  */
/* locked to that ratio, so art authored at any other shape is cropped by         */
/* object-cover. Publish this size to whoever produces the banners.               */
/* NOTE: the bundled fallback below is the original 1774x887 (2:1) slide, so it   */
/* loses a little off its top and bottom until it is re-exported at 1028x366.    */

export const BANNERS = [
  {
    id: 'ab688053-4c63-4e41-8635-1f9f156204e2',
    title: 'Slider-1',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1784549220/ggfix/master/banners/ltj5ujtyusud1himeef8.png',
    sortOrder: 1,
  },
  {
    id: 'd2bb100a-e804-4c69-bebb-1743707bdc75',
    title: 'Repair',
    imageUrl:
      'https://res.cloudinary.com/dg6c0g4gi/image/upload/v1784551908/ggfix/master/banners/xikqabvsc0df7y51av9z.png',
    sortOrder: 2,
  },
];

/** The platform's standard banner size, published to the admin. */
export const BANNER_ASPECT = { width: 1028, height: 366 };

/** Milliseconds each slide holds before the carousel advances. */
export const BANNER_INTERVAL_MS = 5000;

/**
 * Normalise raw /master/banners rows for the hero carousel.
 *
 * Drops inactive rows, sorts by sortOrder, and resolves the image: the admin can
 * store EITHER a hosted imageUrl OR an inline imageBase64 blob, so a row with only
 * base64 is turned into a data: URI (the same thing the mobile apps do). Rows with
 * neither are dropped rather than rendered as an empty frame.
 *
 * linkTarget is deliberately IGNORED: it holds a mobile-app route name (e.g. a
 * screen id), not a web URL, so using it as an href would produce dead links.
 *
 * Defensive by design — never throws, and falls back to the bundled BANNERS when
 * given anything unusable.
 */
export const sortBanners = (rows) => {
  if (!Array.isArray(rows)) return BANNERS;

  const usable = rows
    .filter((row) => row && row.isActive !== false)
    .map((row) => {
      const raw = typeof row.imageUrl === 'string' ? row.imageUrl.trim() : '';
      const b64 = typeof row.imageBase64 === 'string' ? row.imageBase64.trim() : '';
      const imageUrl = raw || (b64 ? `data:image/png;base64,${b64}` : '');
      if (!imageUrl) return null;
      return {
        id: row.id || imageUrl,
        title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'NearGFix',
        imageUrl,
        sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return usable.length ? usable : BANNERS;
};
