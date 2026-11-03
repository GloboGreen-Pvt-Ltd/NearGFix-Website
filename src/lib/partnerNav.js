/**
 * partnerNav.js — single source of truth for the NearGFix Partner Dashboard
 * navigation (sidebar, breadcrumbs, page titles). Every route under
 * /shop-home/* is either the Dashboard itself or a leaf item listed here.
 *
 * Leaf items without a real page yet (i.e. almost all of them — see the
 * catch-all at src/app/shop-home/[...slug]/page.js) render an honest
 * "Coming soon" state rather than fake data or a dead link. When a real
 * page is built at one of these paths, Next.js gives it routing priority
 * over the catch-all automatically — nothing here needs to change.
 *
 * Route stability: every `slug` below is unchanged from before this file's
 * 2026-09 sidebar redesign, even where the requested IA used a different
 * path (e.g. a flat `/shop-home/employees/*` instead of the existing
 * `/shop-home/employee/*`, or `/shop-home/dashboard` instead of the
 * existing `/shop-home` root). Renaming a slug here would 404 every
 * bookmark/link to it and, for the four real pages (book-service, pickups,
 * employee/team, account/business-profile, account/settings), break actual
 * shipped functionality — so this redesign only ever changes labels, icons,
 * descriptions, grouping and order, never a slug a real or stub page
 * already answers to.
 *
 * "Shop Profile" and "Business Settings" (the `settings` section's first
 * two items) are the same two routes the profile dropdown has always linked
 * to (`account/business-profile`, `account/settings`) — they used to be
 * reachable ONLY from there ("ACCOUNT_ITEMS", not shown in the sidebar).
 * The 2026-09 redesign surfaces them in the sidebar's new Settings section
 * too, so they are defined once, right here, and both places point at the
 * same two objects — see accountProfileItem/accountSettingsItem below.
 */

import {
  Bell,
  BarChart3,
  Calendar,
  CalendarCheck,
  Clock,
  CreditCard,
  FileText,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Package,
  Receipt,
  PlusCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

export const DASHBOARD_ITEM = {
  key: 'dashboard',
  label: 'Dashboard',
  href: '/shop-home',
  icon: LayoutDashboard,
  description: 'Business overview — bookings, revenue, service activity, employee activity and alerts.',
};

// Reused by both the sidebar's Settings section and, unchanged, wherever
// else account-menu destinations are surfaced — one definition, not two.
const accountProfileItem = {
  key: 'business-profile',
  label: 'Business Profile',
  slug: 'account/business-profile',
  icon: Store,
  description: 'Your shop/business information.',
};
const accountSettingsItem = {
  key: 'account-settings',
  label: 'Account Settings',
  slug: 'account/settings',
  icon: Settings,
  description: 'Account preferences and security settings.',
};

export const PARTNER_NAV = [
  {
    key: 'services',
    label: 'Services',
    icon: Wrench,
    items: [
      { key: 'book-service', label: 'Book Service', slug: 'services/book-service', icon: PlusCircle, description: 'Create a new repair/service booking.' },
      { key: 'pickups', label: 'Pickups', slug: 'services/pickups', icon: Truck, description: 'Track and manage device pickup bookings.' },
      { key: 'bookings', label: 'Jobs', slug: 'services/bookings', icon: ListChecks, description: 'View and manage all repair and service jobs.' },
      // Not in the Services menu (as in the app, Invoice is a tile on the Bookings rail);
      // kept here so the Invoice pages still get their title and breadcrumb.
      { key: 'invoice', inSection: false, label: 'Invoice', slug: 'services/invoice', icon: Receipt, description: 'Bookings with an invoice generated.' },
      { key: 'customers', inSection: false, label: 'Customers', slug: 'services/customers', icon: Users, description: 'Manage customer profiles, contact information, booking history and service records.' },
      { key: 'enquiries', inSection: false, label: 'Enquiry', slug: 'services/enquiries', icon: MessageSquare, description: 'Manage customer enquiries and convert them into service bookings.' },
      { key: 'marketplace', inSection: false, label: 'Buy', slug: 'services/marketplace', icon: ShoppingBag, description: 'Browse devices and products listed in the NearGFix marketplace.' },
      // Sidebar shortcut into the Sell a Device flow (step 1, choose a category) — same page the Dashboard's Sell card opens.
      { key: 'sell', inSection: false, label: 'Sell', slug: 'sell/select-brand', icon: Tag, description: 'Sell a device — choose its category, brand and model.' },
      { key: 'model-compatibility', label: 'Model Compatibility', slug: 'services/model-compatibility', icon: Smartphone, description: 'Check and manage device models and supported repair/service compatibility.' },
      { key: 'delivery', inSection: false, label: 'Delivery', slug: 'services/delivery', icon: Package, description: 'Manage completed repairs that are ready for delivery or return to customers.' },
    ],
  },
  {
    key: 'employee',
    label: 'Employee',
    icon: Users,
    items: [
      { key: 'team', label: 'Team', slug: 'employee/team', icon: Users, description: 'View, add, edit, activate, deactivate and manage employees.' },
      { key: 'attendance', label: 'Attendance', slug: 'employee/attendance', icon: CalendarCheck, description: 'Monitor employee attendance, late check-ins, permissions and leaves.' },
      { key: 'job-report', label: 'Job Report', slug: 'employee/job-report', icon: BarChart3, description: 'Monitor technician work records and assigned service tasks.' },
      { key: 'pickup-report', label: 'Pickup Report', slug: 'employee/pickup-report', icon: Truck, description: 'Monitor pickup person assignments and completed pickups.' },
      { key: 'leave', label: 'Leave', slug: 'employee/leave', icon: Calendar, description: 'View, approve, reject and manage employee leave requests.' },
      { key: 'permissions', label: 'Permissions', slug: 'employee/permissions', icon: ShieldCheck, description: 'Manage short-time employee permission requests.' },
      // Removed from the Employee menu on request; the pages still exist at their URLs.
      { key: 'shift-schedule', inSection: false, label: 'Shift Management', slug: 'employee/shift-schedule', icon: Clock, description: 'View employee work schedules and check-in/check-out details.' },
      { key: 'salary', inSection: false, label: 'Salary & Payslips', slug: 'employee/salary', icon: IndianRupee, description: 'Manage salary records, advances, monthly salary reports and payslips.' },
      { key: 'tasks', inSection: false, label: 'Staff Tasks', slug: 'employee/tasks', icon: ListChecks, description: 'Assign and track employee tasks.' },
      { key: 'performance', inSection: false, label: 'Performance', slug: 'employee/performance', icon: BarChart3, description: 'Monitor employee productivity and performance.' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: BarChart3,
    items: [
      { key: 'overview', label: 'Business Overview', slug: 'reports/overview', icon: BarChart3, inSection: false, description: 'Total bookings, revenue, completed/pending services and customer growth.' },
      { key: 'revenue', label: 'Revenue Report', slug: 'reports/revenue', icon: IndianRupee, description: 'Daily, weekly and monthly revenue, pending payments and payment methods.' },
      { key: 'reports-service-report', label: 'Service Status', slug: 'reports/service-report', icon: BarChart3, description: 'Booking status counts, working-pending jobs and month-by-month snapshots.' },
      { key: 'employee-report', inSection: false, label: 'Employee Report', slug: 'reports/employee-report', icon: Users, description: 'Attendance, productivity, completed tasks and leave statistics.' },
      { key: 'reports-pickup-report', inSection: false, label: 'Pickup Report', slug: 'reports/pickup-report', icon: Truck, description: 'Total, completed and pending pickups, and pickup employee performance.' },
      { key: 'cash-book', label: 'Cash Book', slug: 'reports/cash-book', icon: Wallet, description: 'Manage cash-in and cash-out records.' },
      { key: 'booking-report', inSection: false, label: 'Booking Report', slug: 'reports/booking-report', icon: ListChecks, description: 'View booking statistics and trends.' },
      { key: 'delivery-report', inSection: false, label: 'Delivery Report', slug: 'reports/delivery-report', icon: Package, description: 'View delivered-device statistics.' },
      { key: 'customer-report', inSection: false, label: 'Customer Report', slug: 'reports/customer-report', icon: Users, description: 'View customer activity and service history.' },
      { key: 'sales-report', inSection: false, label: 'Sales Report', slug: 'reports/sales-report', icon: ShoppingBag, description: 'View Buy/Sell transaction reports.' },
      { key: 'expense-report', inSection: false, label: 'Expense Report', slug: 'reports/expense-report', icon: IndianRupee, description: 'Track business expenses.' },
      { key: 'payment-report', inSection: false, label: 'Payment Report', slug: 'reports/payment-report', icon: CreditCard, description: 'Analyze payment methods and transaction details.' },
      { key: 'profit-loss', inSection: false, label: 'Profit & Loss', slug: 'reports/profit-loss', icon: BarChart3, description: 'Compare business income against expenses.' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      accountProfileItem,
      accountSettingsItem,
      { key: 'subscription', ownerOnly: true, label: 'Subscription & Plan', slug: 'settings/subscription', icon: CreditCard, description: 'Manage subscription, employee seat limits and billing.' },
      { key: 'notifications', label: 'Notifications', slug: 'settings/notifications', icon: Bell, description: 'Manage notification preferences.' },
    ],
  },
];

/** Every leaf item, each with its full href attached — flattened once for lookups. */
export const PARTNER_NAV_FLAT = PARTNER_NAV.flatMap((section) =>
  section.items.map((item) => ({ ...item, href: `/shop-home/${item.slug}`, section })),
);

/** Every slug the catch-all route ([...slug]) must pre-render under output:'export'. */
export const ALL_STUB_SLUGS = PARTNER_NAV_FLAT.map((item) => item.slug);

/**
 * Resolve the current pathname to { title, breadcrumb, sectionKey }.
 * sectionKey tells the sidebar which section to keep expanded.
 */
const sellStep = (title) => ({ title, breadcrumb: ['Dashboard', 'Sell on NearGFix', title] });
const FLOW_PAGES = {
  '/shop-home/sell/select-brand': { title: 'Sell on NearGFix', breadcrumb: ['Dashboard', 'Sell on NearGFix'] },
  '/shop-home/sell/select-model': sellStep('Select Model'),
  '/shop-home/sell/sales-category': sellStep('What are you selling?'),
  '/shop-home/sell/select-variant': sellStep('Your Device'),
  '/shop-home/sell/description': sellStep('Choose Description'),
  '/shop-home/sell/screening': sellStep('Screening Question'),
  '/shop-home/sell/screen-condition': sellStep('Screen Condition'),
  '/shop-home/sell/functional': sellStep('Functional'),
  '/shop-home/sell/device-config': sellStep('Device Configuration'),
  '/shop-home/sell/accessories': sellStep('Accessories & Warranty'),
  '/shop-home/sell/images': sellStep('Device Photos'),
  '/shop-home/sell/spare-parts': sellStep('Spare Parts'),
  '/shop-home/sell/price': sellStep('Sell your Gadget'),
  '/shop-home/sell/listed': sellStep('Listed'),
  '/shop-home/services/marketplace/details': { title: 'Listing Details', breadcrumb: ['Services', 'Buy', 'Listing Details'] },
  '/shop-home/services/marketplace/cart': { title: 'My Cart', breadcrumb: ['Services', 'Buy', 'My Cart'] },
  '/shop-home/settings/subscription/checkout': { title: 'Checkout', breadcrumb: ['Settings', 'Subscription & Plan', 'Checkout'] },
  '/shop-home/settings/subscription/receipt': { title: 'Receipt', breadcrumb: ['Settings', 'Subscription & Plan', 'Receipt'] },
};

export function resolveNavContext(pathname) {
  const clean = String(pathname || '').replace(/\/+$/, '') || '/shop-home';

  if (clean === '/shop-home') {
    return { title: 'Dashboard', breadcrumb: ['Dashboard'], sectionKey: null };
  }

  // Sell a Device step pages (reached from the Dashboard or the sidebar's Sell link).
  const flowPage = FLOW_PAGES[clean];
  if (flowPage) return { ...flowPage, sectionKey: null };

  const match = PARTNER_NAV_FLAT.find((item) => item.href === clean);
  if (match) {
    return {
      title: match.label,
      breadcrumb: [match.section.label, match.label],
      sectionKey: match.section.key,
    };
  }

  return { title: 'Dashboard', breadcrumb: ['Dashboard'], sectionKey: null };
}

/** Find a leaf item by its slug array (from the catch-all route params). */
export function findNavItemBySlug(slugParts) {
  const slug = Array.isArray(slugParts) ? slugParts.join('/') : String(slugParts || '');
  return PARTNER_NAV_FLAT.find((item) => item.slug === slug) || null;
}
