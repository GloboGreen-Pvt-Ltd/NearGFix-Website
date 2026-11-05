/**
 * AppBenefitsSection — "Why customers love the NearGFix app": a full-width
 * section (heading, benefit cards, download strip) used on the home page
 * (#repair) and /repair, so both pages always say the same thing. Every
 * benefit is a feature the customer app actually has.
 */

import {
  BadgeCheck,
  BellRing,
  FileText,
  MapPin,
  Navigation,
  Repeat,
  Smartphone,
  Truck,
  UserCheck,
} from 'lucide-react';

import StoreBadges from '@/components/site/StoreBadges';
import { SectionHeading } from '@/components/site/ui';

const BENEFITS = [
  { icon: Navigation, title: 'Live repair tracking', text: 'Follow every step — accepted, in repair, ready, delivered — as the shop updates it.', tone: 'from-[#E5F3F5] to-[#CFF2DA] text-[#024A57]' },
  { icon: Truck, title: 'Doorstep pickup & delivery', text: 'Book a pickup slot; the device is collected and returned to your door.', tone: 'from-[#EEF5FF] to-[#D6E7FF] text-[#175CD3]' },
  { icon: MapPin, title: 'Verified shops near you', text: 'Find trusted repair shops nearby and book in a few taps.', tone: 'from-[#FFF6EA] to-[#FFE3BF] text-[#B54708]' },
  { icon: BadgeCheck, title: 'Approve the price first', text: 'See the estimate before work starts — no surprise charges.', tone: 'from-[#F5EFFF] to-[#E4D6FF] text-[#6941C6]' },
  { icon: FileText, title: 'Receipt, invoice & warranty', text: 'Your service receipt and digital invoice stay in the app.', tone: 'from-[#E8FAF8] to-[#C8F1EC] text-[#107569]' },
  { icon: Repeat, title: 'Buy & sell devices', text: 'Get an instant quote to sell, or buy devices and spares nearby.', tone: 'from-[#FFF0F3] to-[#FFD9E1] text-[#C01048]' },
  { icon: BellRing, title: 'Instant updates', text: 'Notifications for every status change, quote and pickup.', tone: 'from-[#FEFBE8] to-[#FDF0B6] text-[#A15C07]' },
  { icon: UserCheck, title: 'Saved devices & addresses', text: 'Keep your devices and addresses on file to book again in seconds.', tone: 'from-[#F0F9FF] to-[#D3EDFC] text-[#026AA2]' },
];

export default function AppBenefitsSection() {
  return (
    <div>
      <SectionHeading
        eyebrow="NearGFix App"
        title="Why customers love the NearGFix app"
        subtitle="Repair, track, buy and sell — everything for your device in one app."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, title, text, tone }) => (
          <li key={title} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 ${tone}`}>
            <Icon className="pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 opacity-[0.1]" aria-hidden="true" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="relative mt-4 text-base font-extrabold text-brand-ink">{title}</p>
            <p className="relative mt-1 text-sm leading-relaxed text-brand-muted">{text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-3xl bg-brand-700 px-6 py-6 text-center sm:flex-row sm:px-8 sm:text-left">
        <div className="flex items-center gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white sm:flex">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-extrabold text-white">Get the NearGFix app</p>
            <p className="text-sm text-brand-100">Book repairs, track them live and manage everything from your phone.</p>
          </div>
        </div>
        <StoreBadges tone="dark" align="left" caption="" />
      </div>
    </div>
  );
}
