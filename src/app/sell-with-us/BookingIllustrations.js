/**
 * Flat illustrations for the Sell with Us journey cards (Booking and Repair) —
 * one per step, one shared style: white/light-grey shapes, #1E1E1E outlines/details,
 * #035C6C accents, small #F3BF23 highlights, #F84141 only on the "issue" dot.
 * All 240x160, decorative (aria-hidden) — the card's title carries the meaning.
 */

const G = '#035C6C';
const GL = '#E6F7EA'; // light green tint of #035C6C
const D = '#1E1E1E';
const Y = '#F3BF23';
const L = '#F3F3F3';
const M = '#DADADA';

function Frame({ children }) {
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full" aria-hidden="true">
      <ellipse cx="120" cy="146" rx="92" ry="8" fill={D} opacity="0.06" />
      {children}
    </svg>
  );
}

/** 1 · Select Device — laptop, tablet, phone and watch as choices, phone selected. */
export function SelectDeviceArt() {
  return (
    <Frame>
      {/* laptop */}
      <rect x="22" y="44" width="92" height="60" rx="5" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="29" y="51" width="78" height="46" rx="2" fill={L} />
      <rect x="36" y="58" width="34" height="5" rx="2.5" fill={M} />
      <rect x="36" y="68" width="52" height="5" rx="2.5" fill={M} />
      <path d="M12 106 H124 L118 114 H18 Z" fill={M} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      {/* tablet */}
      <rect x="128" y="36" width="52" height="74" rx="7" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="134" y="43" width="40" height="58" rx="3" fill={L} />
      <circle cx="154" cy="105" r="1.8" fill={D} />
      {/* phone (selected) */}
      <rect x="164" y="62" width="40" height="72" rx="8" fill="#FFFFFF" stroke={G} strokeWidth="3.5" />
      <rect x="170" y="70" width="28" height="52" rx="3" fill={GL} />
      <rect x="178" y="66" width="12" height="2.5" rx="1.25" fill={D} />
      <circle cx="204" cy="62" r="11" fill={G} />
      <path d="M198.5 62 l4 4 l7-8" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* watch */}
      <rect x="62" y="118" width="12" height="30" rx="4" fill={M} />
      <rect x="52" y="124" width="32" height="20" rx="6" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <circle cx="68" cy="134" r="4.5" fill="none" stroke={G} strokeWidth="2" />
      {/* highlight */}
      <circle cx="30" cy="30" r="4" fill={Y} />
      <circle cx="222" cy="112" r="3" fill={Y} />
    </Frame>
  );
}

/** 2 · Add Service — phone on the bench with a cracked screen, screwdriver, wrench and a chip. */
export function AddServiceArt() {
  return (
    <Frame>
      {/* phone */}
      <rect x="82" y="22" width="62" height="116" rx="11" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <rect x="89" y="32" width="48" height="94" rx="4" fill={L} />
      <path d="M100 46 l14 18 l-8 10 l16 20" fill="none" stroke={D} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <circle cx="122" cy="46" r="5" fill="#F84141" />
      <rect x="104" y="27" width="18" height="3" rx="1.5" fill={D} />
      {/* screwdriver */}
      <g transform="rotate(-38 176 70)">
        <rect x="160" y="40" width="14" height="36" rx="5" fill={G} />
        <rect x="165" y="76" width="4" height="40" rx="2" fill={D} />
        <rect x="163" y="44" width="8" height="3" rx="1.5" fill="#FFFFFF" opacity="0.7" />
      </g>
      {/* wrench */}
      <g transform="rotate(40 50 88)">
        <rect x="44" y="70" width="12" height="58" rx="6" fill="#FFFFFF" stroke={D} strokeWidth="3" />
        <path d="M38 62 a14 14 0 1 0 24 0 l-6 6 h-12 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      </g>
      {/* chip */}
      <rect x="170" y="112" width="36" height="24" rx="4" fill={GL} stroke={G} strokeWidth="2.5" />
      <rect x="180" y="118" width="16" height="12" rx="2" fill={G} />
      {[176, 184, 192, 200].map((x) => (
        <rect key={x} x={x} y="107" width="2.5" height="5" rx="1" fill={G} />
      ))}
      <circle cx="30" cy="36" r="4" fill={Y} />
      <circle cx="210" cy="30" r="3" fill={Y} />
    </Frame>
  );
}

/** 3 · Customer Details — profile card with avatar, contact lines and a phone field. */
export function CustomerDetailsArt() {
  return (
    <Frame>
      {/* back form */}
      <rect x="112" y="24" width="96" height="112" rx="9" fill={L} stroke={M} strokeWidth="2" />
      <rect x="124" y="40" width="60" height="6" rx="3" fill={M} />
      <rect x="124" y="54" width="72" height="12" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="124" y="74" width="72" height="12" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="124" y="94" width="72" height="12" rx="4" fill="#FFFFFF" stroke={G} strokeWidth="2" />
      <rect x="130" y="98" width="30" height="4" rx="2" fill={G} />
      {/* contact card */}
      <rect x="30" y="40" width="112" height="82" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <circle cx="62" cy="72" r="16" fill={GL} />
      <circle cx="62" cy="67" r="6.5" fill={G} />
      <path d="M50 84 a12 9 0 0 1 24 0" fill={G} />
      <rect x="86" y="60" width="44" height="6" rx="3" fill={D} />
      <rect x="86" y="72" width="34" height="5" rx="2.5" fill={M} />
      {/* phone line */}
      <rect x="44" y="98" width="86" height="14" rx="7" fill={L} />
      <path d="M53 101.5 c0 5 3.5 8.5 8.5 8.5 l1.5-2.2 -3-2 -1.4 1.4 c-1.6-.7-2.9-2-3.6-3.6 l1.4-1.4 -2-3 z" fill={G} />
      <rect x="68" y="103" width="50" height="4" rx="2" fill={D} opacity="0.7" />
      <circle cx="140" cy="40" r="10" fill={Y} />
      <path d="M135.5 40 l3 3 l5.5-6" fill="none" stroke={D} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** 4 · Schedule Booking — calendar with a picked date, a clock and a pickup pin. */
export function ScheduleBookingArt() {
  return (
    <Frame>
      {/* calendar */}
      <rect x="34" y="32" width="112" height="100" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <path d="M34 42 a10 10 0 0 1 10-10 h92 a10 10 0 0 1 10 10 v12 h-112 z" fill={G} />
      <rect x="58" y="24" width="6" height="18" rx="3" fill={D} />
      <rect x="116" y="24" width="6" height="18" rx="3" fill={D} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => {
          const on = r === 1 && c === 2;
          return <rect key={`${r}-${c}`} x={46 + c * 23} y={64 + r * 20} width="16" height="13" rx="3" fill={on ? G : L} />;
        }),
      )}
      <rect x="92" y="84" width="16" height="13" rx="3" fill="none" stroke={Y} strokeWidth="2.5" />
      {/* clock */}
      <circle cx="170" cy="104" r="26" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <circle cx="170" cy="104" r="20" fill={GL} />
      <path d="M170 92 v12 l9 6" fill="none" stroke={D} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="170" cy="104" r="2.5" fill={G} />
      {/* pin */}
      <path d="M190 22 c-11 0-19 8-19 18 0 13 19 30 19 30 s19-17 19-30 c0-10-8-18-19-18 z" fill={G} />
      <circle cx="190" cy="40" r="7" fill="#FFFFFF" />
      <ellipse cx="190" cy="72" rx="9" ry="3" fill={D} opacity="0.12" />
      <circle cx="24" cy="120" r="4" fill={Y} />
    </Frame>
  );
}

/** 4 · Estimation — itemised price estimate with a ₹ total, and a calculator. */
export function EstimationArt() {
  return (
    <Frame>
      {/* estimate sheet */}
      <rect x="36" y="22" width="104" height="120" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="50" y="36" width="46" height="6" rx="3" fill={D} />
      {[54, 70, 86].map((y) => (
        <g key={y}>
          <rect x="50" y={y} width="44" height="5" rx="2.5" fill={M} />
          <rect x="106" y={y} width="20" height="5" rx="2.5" fill={M} />
        </g>
      ))}
      <path d="M50 102 H126" stroke={M} strokeWidth="2" strokeDasharray="4 3" />
      <rect x="50" y="112" width="76" height="18" rx="6" fill={GL} />
      <text x="58" y="125.5" fontSize="12" fontWeight="800" fontFamily="Arial, sans-serif" fill={G}>₹</text>
      <rect x="92" y="118" width="28" height="6" rx="3" fill={G} />
      {/* calculator */}
      <rect x="150" y="54" width="58" height="80" rx="9" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="158" y="62" width="42" height="16" rx="3" fill={G} />
      <rect x="174" y="67" width="20" height="6" rx="3" fill="#FFFFFF" opacity="0.85" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={158 + c * 15} y={86 + r * 14} width="11" height="9" rx="2.5" fill={r === 2 && c === 2 ? Y : L} />
        )),
      )}
      <circle cx="30" cy="40" r="4" fill={Y} />
      <circle cx="214" cy="40" r="3" fill={G} />
    </Frame>
  );
}

/* Buying journey — same style. */

/** B1 · Explore — phone, tablet and laptop browsed through a search bar. */
export function ExploreArt() {
  return (
    <Frame>
      <rect x="34" y="20" width="172" height="22" rx="11" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <circle cx="52" cy="31" r="5.5" fill="none" stroke={G} strokeWidth="2.6" />
      <path d="M56 35 l4 4" stroke={G} strokeWidth="2.6" strokeLinecap="round" />
      <rect x="68" y="28" width="60" height="6" rx="3" fill={M} />
      <rect x="28" y="64" width="98" height="56" rx="5" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="35" y="71" width="84" height="42" rx="2" fill={L} />
      <path d="M18 122 H136 L130 130 H24 Z" fill={M} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <rect x="138" y="58" width="46" height="66" rx="7" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="144" y="65" width="34" height="50" rx="3" fill={GL} />
      <rect x="176" y="80" width="32" height="56" rx="7" fill="#FFFFFF" stroke={G} strokeWidth="3" />
      <rect x="181" y="87" width="22" height="40" rx="2" fill={GL} />
      <circle cx="24" cy="50" r="4" fill={Y} />
      <circle cx="220" cy="60" r="3" fill={Y} />
    </Frame>
  );
}

/** B2 · Select — variant options with one ticked and a tap on it. */
export function SelectArt() {
  return (
    <Frame>
      {[0, 1, 2].map((i) => {
        const on = i === 1;
        const x = 30 + i * 62;
        return (
          <g key={i}>
            <rect x={x} y="30" width="54" height="86" rx="9" fill="#FFFFFF" stroke={on ? G : D} strokeWidth={on ? 3.5 : 3} />
            <rect x={x + 15} y="40" width="24" height="42" rx="5" fill={on ? GL : L} stroke={on ? G : M} strokeWidth="2" />
            <rect x={x + 10} y="90" width="34" height="5" rx="2.5" fill={on ? D : M} />
            <rect x={x + 16} y="100" width="22" height="5" rx="2.5" fill={M} />
          </g>
        );
      })}
      <circle cx="146" cy="30" r="11" fill={G} />
      <path d="M140.5 30 l4 4 l7-8" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* tap */}
      <circle cx="132" cy="122" r="10" fill={Y} opacity="0.35" />
      <path d="M128 108 v18 l-4 -4 -3 3 8 10 h14 l3 -14 -8 -2 v-11 a4 4 0 0 0 -8 0 z" fill="#FFFFFF" stroke={D} strokeWidth="2.6" strokeLinejoin="round" />
    </Frame>
  );
}

/** B3 · Review — spec card with checks, a price tag and a warranty shield. */
export function ReviewArt() {
  return (
    <Frame>
      <rect x="30" y="24" width="112" height="116" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="44" y="36" width="30" height="42" rx="6" fill={GL} stroke={G} strokeWidth="2" />
      <rect x="82" y="40" width="46" height="6" rx="3" fill={D} />
      <rect x="82" y="52" width="36" height="5" rx="2.5" fill={M} />
      {[90, 106, 122].map((y) => (
        <g key={y}>
          <circle cx="50" cy={y} r="5" fill={G} />
          <path d={`M47.5 ${y} l2 2 l3.5 -4`} fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="62" y={y - 3} width="64" height="6" rx="3" fill={M} />
        </g>
      ))}
      {/* price tag */}
      <path d="M156 40 h36 l14 16 l-14 16 h-36 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6 z" fill={Y} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <text x="166" y="61" fontSize="15" fontWeight="800" fontFamily="Arial, sans-serif" fill={D}>₹</text>
      <rect x="178" y="52" width="14" height="5" rx="2.5" fill={D} />
      {/* warranty shield */}
      <path d="M180 88 l24 8 v18 c0 14 -10 22 -24 26 c-14 -4 -24 -12 -24 -26 v-18 z" fill={G} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M171 114 l6 6 l12 -13" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** B4 · Order — cart with the device, an order slip with address pin and a lock. */
export function OrderArt() {
  return (
    <Frame>
      {/* order slip */}
      <rect x="132" y="22" width="80" height="104" rx="9" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="144" y="34" width="40" height="6" rx="3" fill={D} />
      <path d="M152 52 c-6 0-10 4-10 9.5 0 7 10 15.5 10 15.5 s10-8.5 10-15.5 c0-5.5-4-9.5-10-9.5 z" fill={G} />
      <circle cx="152" cy="61" r="3.5" fill="#FFFFFF" />
      <rect x="168" y="56" width="32" height="5" rx="2.5" fill={M} />
      <rect x="168" y="66" width="24" height="5" rx="2.5" fill={M} />
      <rect x="144" y="88" width="56" height="16" rx="6" fill={GL} />
      <rect x="164" y="102" width="20" height="16" rx="3" fill={D} />
      <path d="M168 102 v-5 a6 6 0 0 1 12 0 v5" fill="none" stroke={D} strokeWidth="3" />
      <circle cx="174" cy="110" r="2.5" fill={Y} />
      {/* cart */}
      <path d="M20 50 h16 l12 52 h60 l10 -38 h-78" fill="none" stroke={D} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="54" y="40" width="26" height="44" rx="5" fill="#FFFFFF" stroke={G} strokeWidth="3" />
      <rect x="84" y="56" width="24" height="28" rx="3" fill={Y} stroke={D} strokeWidth="2.5" />
      <circle cx="58" cy="118" r="7" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <circle cx="100" cy="118" r="7" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
    </Frame>
  );
}

/** B5 · Receive — package delivered to the location pin, with a done check. */
export function ReceiveArt() {
  return (
    <Frame>
      <ellipse cx="170" cy="128" rx="34" ry="8" fill={GL} />
      <path d="M170 24 c-15 0-26 11-26 25 0 18 26 42 26 42 s26-24 26-42 c0-14-11-25-26-25 z" fill={G} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="170" cy="49" r="9" fill="#FFFFFF" />
      {/* box */}
      <path d="M34 72 l40 -16 l40 16 v46 l-40 16 l-40 -16 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M34 72 l40 16 l40 -16 M74 88 v46" fill="none" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M54 64 l40 16 v10" fill="none" stroke={Y} strokeWidth="5" strokeLinecap="round" />
      <rect x="84" y="98" width="20" height="14" rx="2" fill={L} stroke={D} strokeWidth="2" transform="rotate(-22 94 105)" />
      <circle cx="122" cy="44" r="12" fill={G} />
      <path d="M116 44 l4.5 4.5 l7.5 -8.5" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M128 104 q14 -8 26 4" fill="none" stroke={M} strokeWidth="3" strokeLinecap="round" strokeDasharray="5 5" />
      <circle cx="24" cy="44" r="4" fill={Y} />
    </Frame>
  );
}

/* Selling journey — same style. */

/** S1 · Create — seller profile on a phone with a plus badge. */
export function CreateAccountArt() {
  return (
    <Frame>
      <rect x="84" y="20" width="72" height="122" rx="12" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <rect x="92" y="32" width="56" height="98" rx="4" fill={L} />
      <rect x="110" y="25" width="20" height="3" rx="1.5" fill={D} />
      <circle cx="120" cy="58" r="15" fill={GL} />
      <circle cx="120" cy="54" r="6" fill={G} />
      <path d="M109 68 a11 8 0 0 1 22 0" fill={G} />
      <rect x="100" y="82" width="40" height="10" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="100" y="98" width="40" height="10" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="100" y="114" width="40" height="10" rx="5" fill={G} />
      <circle cx="160" cy="36" r="14" fill={Y} stroke={D} strokeWidth="3" />
      <path d="M160 29 v14 M153 36 h14" stroke={D} strokeWidth="3" strokeLinecap="round" />
      {/* store hint */}
      <path d="M26 90 h40 l-4 -14 h-32 z" fill={G} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <rect x="30" y="90" width="32" height="30" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="40" y="102" width="12" height="18" fill={GL} stroke={D} strokeWidth="2" />
      <circle cx="206" cy="100" r="3.5" fill={G} />
      <circle cx="200" cy="130" r="4" fill={Y} />
    </Frame>
  );
}

/** S2 · List — product listing form with photo upload and an add button. */
export function ListProductArt() {
  return (
    <Frame>
      <rect x="44" y="22" width="152" height="118" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="58" y="36" width="54" height="70" rx="7" fill={L} stroke={M} strokeWidth="2" strokeDasharray="5 4" />
      <rect x="72" y="46" width="26" height="44" rx="5" fill="#FFFFFF" stroke={D} strokeWidth="2.6" />
      <rect x="76" y="52" width="18" height="30" rx="2" fill={GL} />
      <rect x="124" y="40" width="58" height="6" rx="3" fill={D} />
      <rect x="124" y="56" width="58" height="12" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="124" y="76" width="58" height="12" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="130" y="80" width="12" height="4" rx="2" fill={Y} />
      <rect x="124" y="96" width="58" height="12" rx="4" fill="#FFFFFF" stroke={M} strokeWidth="1.5" />
      <rect x="58" y="116" width="124" height="14" rx="7" fill={G} />
      <circle cx="196" cy="24" r="14" fill={G} stroke={D} strokeWidth="3" />
      <path d="M196 17 v14 M189 24 h14" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="70" r="4" fill={Y} />
    </Frame>
  );
}

/** S3 · Orders — incoming order card with the device, an accept check and a bell. */
export function SellOrdersArt() {
  return (
    <Frame>
      <rect x="112" y="26" width="92" height="104" rx="9" fill={L} stroke={M} strokeWidth="2" />
      {[44, 64, 84].map((y) => (
        <g key={y}>
          <rect x="124" y={y} width="12" height="12" rx="3" fill={G} />
          <rect x="144" y={y + 3} width="48" height="6" rx="3" fill={M} />
        </g>
      ))}
      <rect x="30" y="40" width="112" height="84" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="42" y="52" width="26" height="40" rx="5" fill={GL} stroke={G} strokeWidth="2" />
      <rect x="78" y="54" width="50" height="6" rx="3" fill={D} />
      <rect x="78" y="66" width="36" height="5" rx="2.5" fill={M} />
      <text x="78" y="88" fontSize="12" fontWeight="800" fontFamily="Arial, sans-serif" fill={G}>₹</text>
      <rect x="88" y="80" width="24" height="6" rx="3" fill={G} />
      <rect x="42" y="102" width="86" height="12" rx="6" fill={G} />
      <path d="M78 108 l4 4 l8 -8" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* bell */}
      <path d="M40 24 c-8 0-12 6-12 13 v7 l-4 5 h32 l-4 -5 v-7 c0-7-4-13-12-13 z" fill={Y} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="40" cy="52" r="3.5" fill={D} />
      <circle cx="54" cy="24" r="5" fill="#F84141" />
    </Frame>
  );
}

/** S4 · Shipment — labelled box being loaded into a van. */
export function ShipmentArt() {
  return (
    <Frame>
      {/* van */}
      <path d="M96 52 h78 v62 h-78 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M174 70 h22 l16 18 v26 h-38 z" fill={G} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <rect x="180" y="76" width="14" height="12" rx="2" fill="#FFFFFF" />
      <circle cx="120" cy="118" r="10" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <circle cx="190" cy="118" r="10" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <path d="M108 70 h40" stroke={M} strokeWidth="4" strokeLinecap="round" />
      {/* box with label */}
      <path d="M26 74 l34 -14 l34 14 v42 l-34 14 l-34 -14 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M26 74 l34 14 l34 -14 M60 88 v42" fill="none" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M43 67 l34 14 v10" fill="none" stroke={Y} strokeWidth="5" strokeLinecap="round" />
      <rect x="66" y="96" width="20" height="14" rx="2" fill={L} stroke={D} strokeWidth="2" transform="rotate(-22 76 103)" />
      <path d="M36 36 h20 M44 26 h26" stroke={M} strokeWidth="3" strokeLinecap="round" />
      <circle cx="214" cy="44" r="4" fill={Y} />
    </Frame>
  );
}

/** S5 · Payment — wallet with a card, a paid receipt and a rupee coin. */
export function PaymentArt() {
  return (
    <Frame>
      {/* receipt */}
      <path d="M130 22 h74 v112 l-9 -6 -9 6 -9 -6 -9 6 -9 -6 -9 6 -9 -6 -11 6 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <rect x="142" y="36" width="40" height="6" rx="3" fill={D} />
      <rect x="142" y="50" width="50" height="5" rx="2.5" fill={M} />
      <rect x="142" y="62" width="40" height="5" rx="2.5" fill={M} />
      <circle cx="167" cy="96" r="16" fill={G} />
      <path d="M159 96 l6 6 l10 -11" fill="none" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* wallet */}
      <rect x="26" y="62" width="104" height="72" rx="10" fill={G} stroke={D} strokeWidth="3" />
      <rect x="38" y="46" width="72" height="30" rx="5" fill="#FFFFFF" stroke={D} strokeWidth="3" transform="rotate(-8 74 61)" />
      <rect x="46" y="54" width="30" height="5" rx="2.5" fill={Y} transform="rotate(-8 74 61)" />
      <rect x="26" y="74" width="104" height="60" rx="10" fill={G} stroke={D} strokeWidth="3" />
      <rect x="96" y="92" width="34" height="22" rx="6" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <circle cx="108" cy="103" r="4" fill={D} />
      {/* coin */}
      <circle cx="48" cy="34" r="14" fill={Y} stroke={D} strokeWidth="3" />
      <text x="48" y="39.5" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="Arial, sans-serif" fill={D}>₹</text>
    </Frame>
  );
}

/* Repair journey — same style as the booking set. */

/** R1 · Device Received — phone handed over at the service counter, checked in. */
export function DeviceReceivedArt() {
  return (
    <Frame>
      <rect x="20" y="104" width="200" height="12" rx="4" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="32" y="116" width="176" height="26" rx="3" fill={L} stroke={D} strokeWidth="3" />
      <rect x="44" y="124" width="40" height="5" rx="2.5" fill={M} />
      <rect x="92" y="34" width="44" height="70" rx="8" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <rect x="98" y="42" width="32" height="52" rx="3" fill={GL} />
      <rect x="108" y="38" width="12" height="2.5" rx="1.25" fill={D} />
      <path d="M150 44 h44 a6 6 0 0 1 6 6 v24 a6 6 0 0 1 -6 6 h-44 l-10 -18 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="152" cy="62" r="3" fill={D} />
      <rect x="162" y="54" width="28" height="5" rx="2.5" fill={D} />
      <rect x="162" y="65" width="20" height="5" rx="2.5" fill={M} />
      <circle cx="136" cy="34" r="11" fill={G} />
      <path d="M130.5 34 l4 4 l7-8" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="40" cy="44" r="4" fill={Y} />
      <circle cx="60" cy="80" r="3" fill={G} />
    </Frame>
  );
}

/** R2 · Diagnosis — phone with a diagnostic trace under a magnifying glass. */
export function DiagnosisArt() {
  return (
    <Frame>
      <rect x="54" y="22" width="64" height="116" rx="11" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <rect x="61" y="32" width="50" height="94" rx="4" fill={L} />
      <rect x="77" y="27" width="18" height="3" rx="1.5" fill={D} />
      <path d="M66 86 h10 l5 -12 l7 22 l6 -14 h14" fill="none" stroke={G} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="68" y="44" width="30" height="5" rx="2.5" fill={M} />
      <rect x="68" y="54" width="22" height="5" rx="2.5" fill={M} />
      <rect x="172" y="92" width="12" height="40" rx="6" fill={D} transform="rotate(-42 178 112)" />
      <circle cx="150" cy="70" r="30" fill="#FFFFFF" stroke={D} strokeWidth="4" />
      <circle cx="150" cy="70" r="22" fill={GL} />
      <path d="M140 70 l7 7 l13 -14" fill="none" stroke={G} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M196 34 l14 -10" stroke={D} strokeWidth="3" strokeLinecap="round" />
      <circle cx="194" cy="36" r="4" fill={Y} />
      <circle cx="34" cy="120" r="3.5" fill={Y} />
    </Frame>
  );
}

/** R3 · Repair — open phone with the board exposed, screwdriver at work, removed part. */
export function RepairArt() {
  return (
    <Frame>
      <rect x="44" y="26" width="72" height="112" rx="11" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <rect x="54" y="38" width="52" height="42" rx="4" fill={GL} stroke={G} strokeWidth="2.5" />
      <rect x="62" y="48" width="36" height="22" rx="3" fill={G} />
      <rect x="70" y="54" width="20" height="4" rx="2" fill="#FFFFFF" opacity="0.8" />
      <rect x="54" y="88" width="52" height="38" rx="4" fill={L} />
      <circle cx="66" cy="100" r="4" fill={D} />
      <circle cx="94" cy="100" r="4" fill={D} />
      <rect x="62" y="112" width="36" height="5" rx="2.5" fill={M} />
      <g transform="rotate(35 150 70)">
        <rect x="142" y="18" width="16" height="42" rx="6" fill={G} />
        <rect x="145" y="24" width="10" height="3" rx="1.5" fill="#FFFFFF" opacity="0.7" />
        <rect x="148" y="60" width="4" height="44" rx="2" fill={D} />
      </g>
      <rect x="150" y="104" width="54" height="30" rx="5" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="160" y="114" width="34" height="10" rx="2" fill={Y} />
      <circle cx="214" cy="92" r="4" fill={D} />
      <circle cx="28" cy="40" r="4" fill={Y} />
    </Frame>
  );
}

/** R4 · Quality Check — repaired phone beside a ticked test checklist. */
export function QualityCheckArt() {
  return (
    <Frame>
      <rect x="104" y="24" width="96" height="116" rx="9" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="132" y="18" width="40" height="14" rx="5" fill={L} stroke={D} strokeWidth="3" />
      {[48, 72, 96].map((y) => (
        <g key={y}>
          <rect x="116" y={y} width="16" height="16" rx="4" fill={G} />
          <path d={`M119.5 ${y + 8} l3.5 3.5 l6 -7`} fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="140" y={y + 5} width="46" height="6" rx="3" fill={M} />
        </g>
      ))}
      <rect x="116" y="120" width="16" height="12" rx="4" fill="none" stroke={M} strokeWidth="2" />
      <rect x="140" y="123" width="30" height="6" rx="3" fill={M} />
      <rect x="36" y="40" width="54" height="96" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3.5" />
      <rect x="42" y="49" width="42" height="76" rx="3" fill={GL} />
      <circle cx="63" cy="87" r="14" fill={G} />
      <path d="M56 87 l5 5 l9 -10" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M210 36 l2.5 6.5 l6.5 2.5 l-6.5 2.5 l-2.5 6.5 l-2.5 -6.5 l-6.5 -2.5 l6.5 -2.5 z" fill={Y} />
    </Frame>
  );
}

/** R5 · Ready / Delivered — packed box with the phone, a done badge and a delivery van. */
export function ReadyDeliveredArt() {
  return (
    <Frame>
      <path d="M34 66 l44 -18 l44 18 v52 l-44 18 l-44 -18 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M34 66 l44 18 l44 -18 M78 84 v52" fill="none" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M56 57 l44 18 v12" fill="none" stroke={Y} strokeWidth="5" strokeLinecap="round" />
      <rect x="60" y="24" width="30" height="40" rx="6" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="65" y="30" width="20" height="26" rx="2" fill={GL} />
      <circle cx="102" cy="30" r="11" fill={G} />
      <path d="M96.5 30 l4 4 l7 -8" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M136 84 h46 v34 h-46 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M182 94 h16 l12 12 v12 h-28 z" fill={G} stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <rect x="187" y="98" width="10" height="8" rx="1.5" fill="#FFFFFF" />
      <circle cx="152" cy="120" r="7" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <circle cx="196" cy="120" r="7" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <path d="M142 70 h22 M132 58 h14" stroke={M} strokeWidth="3" strokeLinecap="round" />
      <circle cx="214" cy="60" r="3.5" fill={Y} />
    </Frame>
  );
}

/** 5 · Booking Confirmed — booking slip with a big check, a boxed device and a sparkle. */
export function BookingConfirmedArt() {
  return (
    <Frame>
      {/* package */}
      <path d="M150 78 l40-16 l30 12 v42 l-40 16 l-30-12 z" fill="#FFFFFF" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M150 78 l30 12 l40-16 M180 90 v42" fill="none" stroke={D} strokeWidth="3" strokeLinejoin="round" />
      <path d="M165 72 l30 12 v10" fill="none" stroke={Y} strokeWidth="5" strokeLinecap="round" />
      {/* booking slip */}
      <rect x="30" y="26" width="104" height="118" rx="10" fill="#FFFFFF" stroke={D} strokeWidth="3" />
      <rect x="44" y="40" width="50" height="6" rx="3" fill={D} />
      <rect x="44" y="54" width="76" height="5" rx="2.5" fill={M} />
      <rect x="44" y="66" width="64" height="5" rx="2.5" fill={M} />
      <rect x="44" y="78" width="70" height="5" rx="2.5" fill={M} />
      <circle cx="82" cy="112" r="20" fill={G} />
      <path d="M72 112 l7 7 l13-14" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkle */}
      <path d="M200 26 l3 8 l8 3 l-8 3 l-3 8 l-3-8 l-8-3 l8-3 z" fill={Y} />
      <circle cx="222" cy="52" r="3" fill={G} />
    </Frame>
  );
}
