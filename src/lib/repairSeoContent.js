/**
 * Hand-written copy for the repair landing pages (/repair/<slug>/ and their
 * brand pages). Keyed by the master-data device-category CODE.
 *
 * Rules this copy follows — keep them when editing:
 *   - Only describe what the platform really does: NearGFix connects customers to
 *     partner repair shops within 20 km; pickup is offered by pickup-enabled
 *     shops; the shop quotes and the customer approves before work starts;
 *     progress is tracked live. Each shop sets its own prices and parts.
 *   - No prices, turnaround promises, warranty terms, ratings or city claims —
 *     those vary per shop or are not published (see the seo-decisions note).
 *   - Write for the customer with the broken device, not for a search engine.
 *
 * The brands, models and the full list of repair services on each page are NOT
 * here — they come from master data at build time (src/lib/repairCatalog.js).
 */

/** The real NearGFix repair journey, shared by every category page. */
export const REPAIR_STEPS = [
  {
    title: 'Choose your device',
    description: 'Pick the category, brand and model so the shop knows exactly what it is repairing.',
    icon: 'Smartphone',
  },
  {
    title: 'Tell us what is wrong',
    description:
      'Select the repair you need. Not sure what the fault is? Send an enquiry and nearby shops can look at the problem before you commit.',
    icon: 'ClipboardList',
  },
  {
    title: 'Pick a nearby shop',
    description:
      'Compare NearGFix partner shops within 20 km. Book a doorstep pickup with a pickup-enabled shop, or take the device in yourself.',
    icon: 'Store',
  },
  {
    title: 'Approve the price first',
    description: 'The shop checks the device and sends a quote. No work starts until you approve it.',
    icon: 'BadgeCheck',
  },
  {
    title: 'Track it until it is back',
    description: 'Follow every stage live, from accepted to ready, with the receipt and invoice saved to your order.',
    icon: 'Truck',
  },
];

export const REPAIR_CATEGORY_CONTENT = {
  MOBILE: {
    slug: 'mobile',
    label: 'Mobile',
    deviceNoun: 'phone',
    devicePlural: 'phones',
    h1: 'Mobile Phone Repair Services',
    metaTitle: 'Mobile Phone Repair Near You – Screen & Battery',
    metaDescription:
      'Get your mobile phone repaired by a NearGFix partner shop near you — screen and battery replacement, charging port, camera, water damage and more.',
    intro: [
      'A cracked screen, a battery that dies by lunchtime or a phone that will not charge can stop your day. NearGFix connects you with verified repair shops within 20 km so you can get your smartphone fixed without guessing where to go.',
      'Choose your phone model, pick the problem, and compare nearby shops. Many offer doorstep pickup, and you approve the price before any work begins — whether it is an iPhone, a Samsung Galaxy or a Vivo, Oppo, Xiaomi, Realme or OnePlus handset.',
    ],
    issues: [
      { title: 'Screen replacement', text: 'Cracked or shattered glass, or a screen that has come loose from the frame. The shop replaces the damaged display assembly so touch and picture work as they should.' },
      { title: 'Display repair', text: 'Green or pink lines, dark patches, flickering or a black screen while the phone still rings. These usually point to a faulty display panel or its connector.' },
      { title: 'Touch not working', text: 'Parts of the screen that ignore your finger, or "ghost" taps you did not make. Often a damaged digitiser, sometimes a software fault the shop can rule out first.' },
      { title: 'Battery replacement', text: 'A phone that drains fast, shuts down at 20%, or a battery that has swollen and lifts the back panel. A swollen battery should be replaced promptly and not charged.' },
      { title: 'Charging problem', text: 'Charging only at an angle, very slow charging, or no charging at all. The cause can be the cable, the port, the charging circuit or the battery itself.' },
      { title: 'Charging port repair', text: 'Dust and lint packed into the port, bent pins or a loose socket. Cleaning or replacing the port often brings normal charging back.' },
      { title: 'Speaker repair', text: 'Crackling, muffled or no sound on calls or music. The earpiece or loudspeaker may be blocked, water-damaged or worn out.' },
      { title: 'Microphone repair', text: 'Callers cannot hear you, or voice notes record silence. A blocked or failed microphone is a common, usually quick fix.' },
      { title: 'Camera repair', text: 'Blurry photos, a camera that will not focus, a cracked lens cover or a black camera screen. The shop can replace the lens glass or the camera module.' },
      { title: 'Water damage', text: 'Dropped in water or caught in the rain? Switch the phone off, do not charge it, and get it checked quickly — corrosion spreads the longer it sits.' },
      { title: 'Phone not turning on', text: 'No logo, no vibration, no charging light. It could be a dead battery, a power button fault or a motherboard issue; the shop diagnoses it before quoting.' },
      { title: 'Software problems', text: 'Boot loops, apps crashing, a phone stuck on the logo or after a failed update. Software repairs may need a reset, so back up your data if you can.' },
      { title: 'Network problem', text: 'No signal, "No SIM" errors or calls that drop while others around you have coverage. The fault may be the SIM tray, antenna or network hardware.' },
      { title: 'Overheating', text: 'A phone that gets hot during light use or while charging. A failing battery, a charging fault or a blocked component can all be the cause.' },
      { title: 'Performance issues', text: 'Lag, freezing or storage that is always full. A shop can check for hardware faults and help with software clean-up where it applies.' },
    ],
    faqs: [
      { question: 'How much does a mobile screen replacement cost?', answer: 'It depends on your phone model and the replacement part the shop uses. Each NearGFix partner shop sets its own price, and you see the quote and approve it before any work starts.' },
      { question: 'Can my phone be repaired without visiting the shop?', answer: 'Yes, if you choose a pickup-enabled shop. Confirm your address and a time slot, and the shop collects the phone and delivers it back after the repair.' },
      { question: 'Will I lose my data during the repair?', answer: 'Hardware repairs such as a screen, battery or charging port do not normally touch your data, but back up your phone first if you can. Software repairs can require a reset — the shop will tell you before doing it.' },
      { question: 'I do not know what is wrong with my phone. Can I still get help?', answer: 'Yes. Send an enquiry describing the problem and nearby shops can respond. You can message them before deciding on a repair.' },
    ],
  },

  TABLET: {
    slug: 'tablet',
    label: 'Tablet',
    deviceNoun: 'tablet',
    devicePlural: 'tablets',
    h1: 'Tablet Repair Services',
    metaTitle: 'Tablet Repair Services Near You – iPad & Android',
    metaDescription:
      'Find tablet repair near you with NearGFix — iPad and Android tablet screen, battery, charging port and software repairs by verified partner shops.',
    intro: [
      'Tablets do a lot of work — online classes, video calls, streaming and office documents — so a broken screen or a battery that will not hold charge is a real problem. NearGFix helps you find a verified repair shop near you for iPads and Android tablets from Samsung, Lenovo, Xiaomi, Realme and more.',
      'Pick your tablet model and the fault, compare nearby partner shops, and book a doorstep pickup where the shop offers it. You approve the quote before the repair starts and can follow its progress live.',
    ],
    issues: [
      { title: 'Cracked screen or glass', text: 'Large screens crack easily when dropped. The shop replaces the glass or the full display, depending on how your model is built.' },
      { title: 'Display faults', text: 'Lines, dead spots, a dim backlight or a blank screen with sound still playing usually mean a display or connector fault.' },
      { title: 'Touch not responding', text: 'Areas of the screen that do not register taps, or erratic touch, often after a fall or pressure on the glass.' },
      { title: 'Battery draining fast', text: 'An older tablet that no longer lasts a class or a film. A battery replacement can restore normal use.' },
      { title: 'Charging port problems', text: 'Loose cables, intermittent charging or no charging at all — often a worn or dirty port.' },
      { title: 'Buttons and speakers', text: 'Stuck power or volume buttons, crackling speakers or a dead headphone jack.' },
      { title: 'Software and update issues', text: 'A tablet stuck on the logo, crashing apps or a failed update. Back up first if you can, as a reset may be needed.' },
      { title: 'Wi-Fi and connectivity', text: 'Wi-Fi or Bluetooth that keeps dropping, or a SIM tablet that will not find a network.' },
    ],
    faqs: [
      { question: 'Can you repair an iPad as well as Android tablets?', answer: 'NearGFix lists Apple iPads alongside Android brands such as Samsung, Lenovo and Xiaomi. Choose your exact model and you will see the shops near you that can take the repair.' },
      { question: 'How long does a tablet repair take?', answer: 'It depends on the fault and on whether the shop has the part in stock. The shop gives you an estimate with the quote, and you can track every stage in the app.' },
      { question: 'Is it worth repairing an old tablet?', answer: 'Often yes — a new battery or screen costs far less than a new tablet. You see the shop’s price before agreeing, so you can decide whether the repair makes sense.' },
    ],
  },

  LAPTOP: {
    slug: 'laptop',
    label: 'Laptop',
    deviceNoun: 'laptop',
    devicePlural: 'laptops',
    h1: 'Laptop Repair Services',
    metaTitle: 'Laptop Repair Services Near You – Screen & Battery',
    metaDescription:
      'Laptop repair near you with NearGFix — screen, keyboard, battery, charging, hinge, overheating and software repairs for HP, Dell, Lenovo, Apple and more.',
    intro: [
      'When your laptop stops working, so does your work or study. NearGFix helps you find a verified laptop repair shop within 20 km for brands such as HP, Dell, Lenovo, Asus, Acer and Apple MacBook.',
      'Choose your laptop model and the problem, compare nearby partner shops, and approve the quote before work begins. Where the shop offers pickup, it can collect the laptop from your door.',
    ],
    issues: [
      { title: 'Screen replacement', text: 'A cracked panel, lines across the display, or a screen that stays black while the laptop runs. The shop replaces the panel or checks the display cable.' },
      { title: 'Keyboard and touchpad', text: 'Keys that stick or do not type, a spill on the keyboard, or a touchpad that jumps or stops clicking.' },
      { title: 'Battery replacement', text: 'A battery that lasts minutes, will not charge past a certain level, or has swollen and lifted the keyboard or base.' },
      { title: 'Not charging', text: 'The charger light is on but the laptop will not charge. The fault may be the adapter, the DC jack or USB-C port, or the charging circuit.' },
      { title: 'Hinge and body damage', text: 'A loose or broken hinge, a cracked base or a lid that will not stay open. Left alone, a bad hinge can damage the screen cable.' },
      { title: 'Overheating and fan noise', text: 'Loud fans, a hot base and sudden shutdowns usually mean dust build-up, dried thermal paste or a failing fan.' },
      { title: 'Slow performance and upgrades', text: 'Long boot times and freezing. Moving to an SSD or adding RAM, where your model allows it, can make an older laptop feel new.' },
      { title: 'Software, virus and OS issues', text: 'Blue screens, a laptop stuck on boot, malware or a corrupted operating system. Data backup and recovery can be discussed with the shop first.' },
    ],
    faqs: [
      { question: 'Do you repair MacBooks?', answer: 'Apple is among the laptop brands listed on NearGFix. Select your MacBook model to see the repairs available and the partner shops near you.' },
      { question: 'Can a shop recover data from a laptop that will not start?', answer: 'Many faults leave the drive intact. Data backup and recovery are listed repair options — describe the problem and the shop will tell you what is possible before you approve anything.' },
      { question: 'Should I repair or upgrade my slow laptop?', answer: 'An SSD or a RAM upgrade often fixes slowness for much less than a new laptop. The shop can check whether your model supports it and quote before doing the work.' },
    ],
  },

  SMARTWATCHES: {
    slug: 'smartwatch',
    label: 'Smartwatch',
    deviceNoun: 'smartwatch',
    devicePlural: 'smartwatches',
    h1: 'Smartwatch Repair Services',
    metaTitle: 'Smartwatch Repair Services Near You',
    metaDescription:
      'Smartwatch repair near you with NearGFix — screen, battery, charging, strap, sensor and button repairs for Apple Watch, Samsung, Amazfit, boAt, Noise and more.',
    intro: [
      'Smartwatches take knocks every day, and a cracked screen or a battery that will not last the day makes them hard to rely on. NearGFix connects you with partner shops near you that repair watches from Apple, Samsung, Amazfit, boAt, Noise, OnePlus and other brands.',
      'Pick your watch model and the problem, compare shops within 20 km, and approve the price before the repair starts.',
    ],
    issues: [
      { title: 'Cracked screen', text: 'Smartwatch glass is small but exposed. The shop replaces the glass or the display assembly to match your model.' },
      { title: 'Display or touch faults', text: 'A blank screen, dead pixels or a display that does not respond to taps and swipes.' },
      { title: 'Battery not lasting', text: 'A watch that needs charging twice a day or switches off unexpectedly may need a new battery.' },
      { title: 'Not charging', text: 'The watch does not react on its charger. Dirty or corroded charging contacts, the charger or the battery can be at fault.' },
      { title: 'Buttons and crown', text: 'A stuck side button or a crown that no longer turns or clicks.' },
      { title: 'Sensor problems', text: 'Heart-rate, SpO2 or step readings that are missing or clearly wrong, often caused by a scratched or faulty sensor window.' },
      { title: 'Bluetooth and pairing', text: 'A watch that keeps disconnecting from your phone or will not pair at all.' },
      { title: 'Speaker and microphone', text: 'No sound on calling watches, or callers who cannot hear you.' },
    ],
    faqs: [
      { question: 'Can my smartwatch screen be replaced?', answer: 'For many models, yes. Select your watch to see the screen and display repairs listed for it, then compare the shops near you and their quotes.' },
      { question: 'Is a smartwatch still water-resistant after a repair?', answer: 'Water resistance depends on the seals after the watch has been opened. Ask the shop before approving the repair, and avoid swimming with the watch until they confirm it.' },
      { question: 'My watch will not charge. Should I replace the charger?', answer: 'Try cleaning the charging contacts and another charger first. If it still does not charge, a shop can test the battery and the charging circuit.' },
    ],
  },

  AUDIO_DEVICE: {
    slug: 'audio',
    label: 'Audio Device',
    deviceNoun: 'audio device',
    devicePlural: 'audio devices',
    h1: 'Earbuds, Headphone & Speaker Repair',
    metaTitle: 'Earbuds, Headphone & Speaker Repair Near You',
    metaDescription:
      'Repair earbuds, headphones and Bluetooth speakers near you with NearGFix — battery, charging case, sound, Bluetooth and button repairs by partner shops.',
    intro: [
      'Wireless earbuds, headphones and Bluetooth speakers are easy to drop and hard to live without. NearGFix helps you find partner shops near you that repair audio devices from Apple, boAt, JBL, Sony, OnePlus, Noise, Realme and more.',
      'Choose your device and the fault, compare shops within 20 km, and approve the quote before anything is opened up.',
    ],
    issues: [
      { title: 'No sound from one side', text: 'One earbud or ear cup has gone quiet or crackles. It can be a blocked mesh, a pairing fault or a failed driver.' },
      { title: 'Battery draining quickly', text: 'Earbuds or a speaker that used to last hours and now die quickly usually need a battery check.' },
      { title: 'Charging case problems', text: 'Earbuds that do not charge in the case, or a case that will not charge itself — often dirty contacts or a faulty case battery.' },
      { title: 'Bluetooth and pairing', text: 'Devices that keep dropping the connection, will not pair, or only connect one earbud at a time.' },
      { title: 'Microphone problems', text: 'Callers cannot hear you clearly, or the mic picks up only noise.' },
      { title: 'Buttons and touch controls', text: 'Touch controls that do not respond, or a power or volume button that is stuck.' },
      { title: 'Physical damage', text: 'Broken headbands, hinges, cracked casings or worn ear cushions on headphones and speakers.' },
      { title: 'Water damage', text: 'A speaker or earbuds exposed to water or sweat. Dry them, do not charge them, and get them checked.' },
    ],
    faqs: [
      { question: 'Can wireless earbuds be repaired?', answer: 'Many faults can be — charging contacts, case batteries, pairing problems and some sound issues. Select your model to see the repairs listed and the shops near you.' },
      { question: 'Can you repair a Bluetooth speaker that will not charge?', answer: 'Often yes. The fault is usually the charging port, the battery or the charging board, and the shop will check which before quoting.' },
      { question: 'Is it worth repairing earbuds?', answer: 'For premium earbuds and headphones, a repair is usually far cheaper than replacing them. You see the shop’s price first, so you can decide.' },
    ],
  },
};
