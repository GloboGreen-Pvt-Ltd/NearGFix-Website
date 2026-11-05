/**
 * /sell-with-us — "Sell with NearGFix" seller homepage, opened from the customer
 * site header's "Sell with Us" button.
 *
 * Brand system (this page only): Inter for headings and
 * everything else (set on the route layout). Colour system: white page;
 * #1E1E1E headings/values, #666666 body; #F8F8F8 / #F3F3F3 cards only;
 * #035C6C brand accent + primary actions; #F3BF23 step numbers; #F84141
 * errors only. Sections are all white, separated by #F1F1F1 hairlines.
 *
 * Header: logo + Login only. Login opens BusinessLoginModal (business OTP
 * sign-in, same calls as /shopmanagement) on this page — no redirect. The
 * in-page Start Selling buttons go to /business/register (shop sign-up). The metrics strip only states facts the site already
 * publishes (siteContent.js: 15-day free trial, no card, ₹3,000/yr flat
 * plan, multi-shop switching) — no invented customer counts.
 */

import Image from 'next/image';
import Link from 'next/link';
import { msIcon } from '@/components/site/MaterialIcon';

import { BRAND } from '@/lib/siteContent';
import SellerLoginButton from './SellerLoginButton';
import {
  AddServiceArt,
  CreateAccountArt,
  ExploreArt,
  ListProductArt,
  OrderArt,
  PaymentArt,
  ReceiveArt,
  ReviewArt,
  SelectArt,
  SellOrdersArt,
  ShipmentArt,
  BookingConfirmedArt,
  CustomerDetailsArt,
  DeviceReceivedArt,
  DiagnosisArt,
  EstimationArt,
  QualityCheckArt,
  ReadyDeliveredArt,
  RepairArt,
  SelectDeviceArt,
} from './BookingIllustrations';

// Google Material Symbols (Outlined) — see src/components/site/MaterialIcon.js.
const BadgeCheck = msIcon("verified");
const BarChart3 = msIcon("bar_chart");
const Boxes = msIcon("inventory");
const CalendarDays = msIcon("calendar_month");
const CircleCheckBig = msIcon("check_circle");
const ClipboardList = msIcon("assignment");
const FileCheck2 = msIcon("fact_check");
const LayoutDashboard = msIcon("dashboard");
const ListPlus = msIcon("playlist_add");
const MapPin = msIcon("location_on");
const MonitorSmartphone = msIcon("devices");
const MousePointerClick = msIcon("touch_app");
const Package = msIcon("package_2");
const PackageCheck = msIcon("local_shipping");
const PackageOpen = msIcon("inventory_2");
const Search = msIcon("search");
const ShieldCheck = msIcon("verified_user");
const ShoppingCart = msIcon("shopping_cart");
const Smartphone = msIcon("smartphone");
const Store = msIcon("storefront");
const Truck = msIcon("local_shipping");
const User = msIcon("person");
const UserPlus = msIcon("person_add");
const Wallet = msIcon("account_balance_wallet");
const Wrench = msIcon("build");


const HEADING_FONT = 'font-[family-name:var(--font-inter)]';

const ROUTES = {
  register: '/business/register/',
};

const METRICS = [
  { value: '15 days', label: 'Free trial on sign-up' },
  { value: '₹0', label: 'No card needed to start' },
  { value: '₹3,000', label: 'Flat yearly plan, per shop' },
  { value: 'Multi-shop', label: 'Switch between your shops' },
];

const BENEFITS = [
  { icon: ListPlus, title: 'Easy product listing', text: 'Add devices by brand and model from the NearGFix catalogue — no long forms.' },
  { icon: MapPin, title: 'Wider customer reach', text: 'Customers nearby find your shop and your listings on the NearGFix app.' },
  { icon: ClipboardList, title: 'Simple order management', text: 'Bookings, pickups and deliveries in one list, with status at a glance.' },
  { icon: ShieldCheck, title: 'Secure payments', text: 'Every payment is recorded against the order, with receipts and invoices.' },
];

// Journeys, in page order: Booking -> Repair -> Buy -> Sell. All three render through JourneySection.
const BOOKING_JOURNEY = [
  { icon: Smartphone, art: SelectDeviceArt, title: 'Select Device', text: 'Choose your device category, brand and model.' },
  { icon: Wrench, art: AddServiceArt, title: 'Add Service', text: 'Select the issue or repair service your device needs.' },
  { icon: User, art: CustomerDetailsArt, title: 'Customer Details', text: 'Enter customer and contact information.' },
  { icon: CalendarDays, art: EstimationArt, title: 'Estimation', text: 'Review the service price estimate before you confirm.' },
  { icon: CircleCheckBig, art: BookingConfirmedArt, title: 'Booking Confirmed', text: 'Review the details and confirm your service booking.' },
];

const REPAIR_JOURNEY = [
  { icon: PackageOpen, art: DeviceReceivedArt, title: 'Device Received', text: 'Your device is received and checked by the service team.' },
  { icon: Search, art: DiagnosisArt, title: 'Diagnosis', text: 'Technician inspects the device and identifies the issue.' },
  { icon: Wrench, art: RepairArt, title: 'Repair', text: 'Approved repair work is carried out by the technician.' },
  { icon: BadgeCheck, art: QualityCheckArt, title: 'Quality Check', text: 'The repaired device is tested before completion.' },
  { icon: Truck, art: ReadyDeliveredArt, title: 'Ready / Delivered', text: 'Your device is ready for pickup or delivery.' },
];

const BUY_JOURNEY = [
  { icon: MonitorSmartphone, art: ExploreArt, title: 'Explore', text: 'Browse available mobiles, tablets, laptops and other devices.' },
  { icon: MousePointerClick, art: SelectArt, title: 'Select', text: 'Choose the device, model, variant and condition you prefer.' },
  { icon: FileCheck2, art: ReviewArt, title: 'Review', text: 'Check device details, specifications, price and warranty information.' },
  { icon: ShoppingCart, art: OrderArt, title: 'Order', text: 'Confirm your delivery details and place the order securely.' },
  { icon: Package, art: ReceiveArt, title: 'Receive', text: 'Receive your device safely at your selected delivery location.' },
];

const SELL_JOURNEY = [
  { icon: UserPlus, art: CreateAccountArt, title: 'Create', text: 'Register your seller account with your mobile number.' },
  { icon: ListPlus, art: ListProductArt, title: 'List', text: 'Add the devices and products you want to sell.' },
  { icon: ClipboardList, art: SellOrdersArt, title: 'Orders', text: 'Receive and confirm customer orders.' },
  { icon: Truck, art: ShipmentArt, title: 'Shipment', text: 'Prepare the device and hand it over or dispatch it.' },
  { icon: Wallet, art: PaymentArt, title: 'Payment', text: 'Receive payment securely against the order.' },
];

const TOOLS = [
  { icon: LayoutDashboard, title: 'Seller Dashboard', text: 'Today’s orders, pickups and deliveries in one view.' },
  { icon: Boxes, title: 'Inventory Management', text: 'Keep stock, models and prices up to date as you sell.' },
  { icon: PackageCheck, title: 'Order Tracking', text: 'Follow every order from booking to delivery.' },
  { icon: BarChart3, title: 'Sales Reports', text: 'Revenue, profit and customer reports by month.' },
];

const FOOTER_LINKS = [
  { label: 'About', href: '/about/' },
  { label: 'Support', href: '/faq/' },
  { label: 'Terms', href: '/terms/' },
  { label: 'Privacy', href: '/privacy/' },
  { label: 'Contact', href: '/contact/' },
];

const BTN_PRIMARY =
  'inline-flex h-11 items-center justify-center rounded-[10px] bg-[#035C6C] px-6 text-[15px] font-semibold text-white transition hover:bg-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

function Container({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-6 lg:px-10 ${className}`}>{children}</div>;
}

function SectionHeading({ title, text }) {
  return (
    <div className="max-w-2xl">
      <h2 className={`${HEADING_FONT} text-[28px] font-semibold leading-tight sm:text-[34px]`}>{title}</h2>
      {text ? <p className="mt-3 text-[16px] leading-relaxed text-[#666666]">{text}</p> : null}
    </div>
  );
}

function Brand() {
  return (
    <Link href="/sell-with-us/" className="flex shrink-0 items-center gap-2.5">
      <Image src={BRAND.logo} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" />
      <span className="leading-tight">
        {/* Logo wordmark: Raleway 500, 30px, -2px tracking, squeezed to 92% width, brand green. */}
        <span className="ggfix-logo-text block origin-left scale-x-[0.92] font-[family-name:var(--font-raleway)] text-[30px] font-medium leading-none tracking-[-2px] text-[#035C6C]">
          {BRAND.name}
        </span>
        <span className="mt-1 block text-[12px] font-medium text-[#666666]">Repair · Buy · Sell with NearGFix</span>
      </span>
    </Link>
  );
}

/**
 * One journey row: 5 equal step cards (yellow number, white icon circle, title + text below).
 * The icon is the focus: a white circle with a hairline green border, soft green shadow and a
 * faint blurred green glow behind it; on desktop hover the card lifts 2px and the circle a
 * little more. Shared by all four journeys so they stay identical.
 */
function JourneySection({ id, title, text, steps, divider }) {
  return (
    <section id={id} className={`scroll-mt-20 bg-white py-14 md:py-[72px] ${divider ? 'border-t border-[#F1F1F1]' : ''}`}>
      <Container>
        <SectionHeading title={title} text={text} />
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {steps.map(({ icon: Icon, art: Art, title: stepTitle, text: stepText }, i) =>
            Art ? (
            // Illustrated card: number, large illustration, title and text all inside one card.
            <li key={stepTitle} className="group">
              <div className="flex h-full flex-col overflow-hidden rounded-[16px] border border-[#F3F3F3] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-[250ms] ease-out lg:group-hover:-translate-y-0.5 lg:group-hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)]">
                <div className="relative bg-[#F8F8F8] px-4 pb-2 pt-9">
                  <span className="absolute left-3 top-3 flex h-[29px] w-[29px] items-center justify-center rounded-full bg-[#F3BF23] text-[13px] font-bold text-[#1E1E1E]">{i + 1}</span>
                  <div className="mx-auto aspect-[3/2] w-full max-w-[240px] transition-transform duration-[250ms] ease-out lg:group-hover:scale-[1.02]">
                    <Art />
                  </div>
                </div>
                <div className="flex-1 px-4 pb-5 pt-4">
                  <h3 className="text-[17px] font-bold text-[#1E1E1E]">{stepTitle}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#666666]">{stepText}</p>
                </div>
              </div>
            </li>
            ) : (
            <li key={stepTitle} className="group">
              <div className="relative flex h-40 items-center justify-center rounded-[16px] border border-[#EEEEEE] bg-[#F8F8F8] transition-all duration-[250ms] ease-out sm:aspect-[4/3] sm:h-auto lg:group-hover:-translate-y-[3px] lg:group-hover:border-[rgba(3,92,108,0.22)] lg:group-hover:shadow-[0_10px_28px_rgba(0,0,0,0.07)]">
                <span className="absolute left-3 top-3 flex h-[29px] w-[29px] items-center justify-center rounded-full bg-[#F3BF23] text-[13px] font-bold text-[#1E1E1E]">{i + 1}</span>
                <span className="relative flex items-center justify-center">
                  <span className="pointer-events-none absolute h-[76px] w-[76px] rounded-full bg-[rgba(3,92,108,0.07)] blur-[10px]" aria-hidden="true" />
                  <span className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full border border-[rgba(3,92,108,0.14)] bg-white shadow-[0_6px_20px_rgba(3,92,108,0.10)] transition-all duration-[250ms] ease-out lg:group-hover:border-[rgba(3,92,108,0.24)] lg:group-hover:shadow-[0_8px_22px_rgba(3,92,108,0.14)]">
                    <Icon className="h-[30px] w-[30px] text-[#035C6C] transition-transform duration-[250ms] ease-out lg:group-hover:scale-105" strokeWidth={2} aria-hidden="true" />
                  </span>
                </span>
              </div>
              <h3 className="mt-4 text-[17px] font-bold text-[#1E1E1E]">{stepTitle}</h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#666666]">{stepText}</p>
            </li>
            ),
          )}
        </ol>
      </Container>
    </section>
  );
}

function SellerHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#EEEEEE] bg-white">
      <Container className="flex h-16 items-center justify-between gap-3 sm:gap-6">
        <Brand />
        <SellerLoginButton />
      </Container>
    </header>
  );
}

export default function SellWithUsPage() {
  return (
    <>
      <SellerHeader />

      <main>
        {/* Hero — public/sell-with-us-hero.jpg (1920x1080): devices on the right, a flat #EFF0F2
            left side that the section colour matches, so the text sits on the photo's own
            backdrop. xl+: the whole photo, fitted to the section height and anchored right, beside
            the text; below xl: text first, then the device side of the photo. The photo's top
            6px (a thin white strip in the file) is clipped. Shown as a rounded card inside the
            page container (white margin around it), the photo clipped to its curved corners. */}
        <section className="bg-white pb-8 pt-4 sm:pb-10 sm:pt-6">
          <Container>
        <div className="relative overflow-hidden rounded-[18px] bg-[#EFF0F2] lg:rounded-[20px]">
          <div className="absolute -top-[6px] bottom-0 left-0 right-0 hidden xl:block">
            <Image src="/sell-with-us-hero.jpg" alt="" fill priority sizes="1240px" className="object-contain object-right" />
          </div>
          <div className="relative px-6 py-10 sm:px-10 md:py-14 xl:flex xl:h-[360px] xl:items-center xl:px-14 xl:py-0">
            <div className="max-w-[620px] xl:max-w-[540px]">
              <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#035C6C]">Sell with NearGFix</p>
              <h1 className={`${HEADING_FONT} mt-3 text-[32px] font-semibold leading-[1.12] sm:text-[40px] xl:text-[44px]`}>
                Grow Your Business with <span className="mt-1 block text-[calc(0.82em-4px)] leading-none text-[#035C6C]">NearGFix</span>
              </h1>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#555555]">
                List your devices, reach more customers, manage orders, and grow your business with one simple platform.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={ROUTES.register} className={BTN_PRIMARY}>
                  Start Selling
                </Link>
              </div>
            </div>
          </div>
          {/* Below xl: the photo below the text, cropped to its device side. */}
          <div className="relative -mt-[6px] h-[200px] overflow-hidden sm:h-[260px] md:h-[300px] xl:hidden">
            <Image src="/sell-with-us-hero.jpg" alt="" fill priority sizes="100vw" className="object-cover object-right-bottom" />
          </div>
        </div>
          </Container>
        </section>

        {/* Metrics */}
        <section aria-label="At a glance" className="border-y border-[#EEEEEE] bg-white">
          <Container className="grid grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                className={`px-2 py-7 text-center ${i % 2 === 1 ? 'border-l border-[#EEEEEE]' : ''} ${i >= 2 ? 'border-t border-[#EEEEEE] lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}
              >
                <p className={`${HEADING_FONT} text-[22px] font-semibold text-[#035C6C] sm:text-[26px]`}>{m.value}</p>
                <p className="mt-1 text-[14px] text-[#666666]">{m.label}</p>
              </div>
            ))}
          </Container>
        </section>

        {/* Why sell with NearGFix */}
        <section id="why" className="scroll-mt-20 bg-white py-14 md:py-[72px]">
          <Container>
            <SectionHeading
              title="Why Choose NearGFix for Repair, Buy & Sell"
              text="A simpler way to repair devices, discover the right products, and sell with confidence — all through one trusted platform."
            />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-[16px] border border-[#EEEEEE] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                  <Icon className="h-6 w-6 text-[#035C6C]" strokeWidth={1.8} aria-hidden="true" />
                  <h3 className="mt-4 text-[17px] font-bold">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#666666]">{text}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Journeys: Booking -> Repair -> Buy -> Sell */}
        <JourneySection id="booking-journey" title="Your Booking Journey with NearGFix" text="Book your device service in a few simple steps." steps={BOOKING_JOURNEY} />
        <JourneySection id="repair-journey" title="Your Repair Journey with NearGFix" text="Track your device repair from booking to delivery." steps={REPAIR_JOURNEY} divider />
        <JourneySection id="buy-journey" title="Your Buying Journey with NearGFix" text="Buy quality devices in a few simple steps." steps={BUY_JOURNEY} divider />
        <JourneySection id="journey" title="Your Selling Journey with NearGFix" text="Start selling in a few simple steps." steps={SELL_JOURNEY} divider />

        {/* Growth tools */}
        <section id="tools" className="scroll-mt-20 border-t border-[#F1F1F1] bg-white py-14 md:py-[72px]">
          <Container>
            <SectionHeading title="Tools to help you grow faster" text="The same tools NearGFix shops use every day, in the app and on the web dashboard." />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex flex-col rounded-[16px] border border-[#EEEEEE] bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
                  <Icon className="h-6 w-6 text-[#035C6C]" strokeWidth={1.8} aria-hidden="true" />
                  <h3 className="mt-4 text-[17px] font-bold">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[#666666]">{text}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="bg-white py-14">
          <Container>
            <div className="flex flex-col items-start gap-6 rounded-[18px] border border-[#EEEEEE] bg-[#F3F3F3] px-7 py-10 md:flex-row md:items-center md:justify-between md:px-12">
              <div className="max-w-xl">
                <h2 className={`${HEADING_FONT} text-[28px] font-semibold leading-tight sm:text-[32px]`}>Ready to start selling?</h2>
                <p className="mt-2 text-[16px] leading-relaxed text-[#666666]">Join NearGFix and manage your selling journey from one simple dashboard.</p>
              </div>
              <Link href={ROUTES.register} className={`${BTN_PRIMARY} w-full shrink-0 sm:w-auto`}>
                Start Selling
              </Link>
            </div>
          </Container>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EEEEEE] bg-[#F8F8F8]">
        <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <Brand />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.label} href={l.href} className="text-[14px] font-medium text-[#5F5F5F] hover:text-[#035C6C]">
                {l.label}
              </Link>
            ))}
          </nav>
        </Container>
        <Container className="border-t border-[#EEEEEE] py-5">
          <p className="flex items-start gap-2 text-[13px] text-[#666666] sm:items-center">
            <Store className="h-4 w-4 shrink-0" aria-hidden="true" />© {new Date().getFullYear()} GloboGreen System Technology Private Limited. All rights reserved.
          </p>
        </Container>
      </footer>
    </>
  );
}

