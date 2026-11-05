/**
 * Multi-colour card accents for the marketing pages (Contact, FAQ, About).
 * Pick with `tone(i)` so a grid cycles through the palette. Full class
 * strings only — Tailwind can't see classes built at runtime.
 *
 *   chip    solid gradient icon tile (white glyph)
 *   soft    light card / tile background
 *   text    accent text on white
 *   ring    matching border
 *   bar     thin top accent strip
 */
export const TONES = [
  { key: 'teal', chip: 'bg-gradient-to-br from-[#0A6F80] to-[#035C6C] text-white', soft: 'bg-[#E5F3F5]', text: 'text-[#035C6C]', ring: 'border-[#C7E6EA]', bar: 'bg-[#035C6C]' },
  { key: 'green', chip: 'bg-gradient-to-br from-[#2ED3B7] to-[#01AC77] text-white', soft: 'bg-[#E7F8F1]', text: 'text-[#047857]', ring: 'border-[#A7E9CF]', bar: 'bg-[#01AC77]' },
  { key: 'blue', chip: 'bg-gradient-to-br from-[#5EA2FF] to-[#1570EF] text-white', soft: 'bg-[#EEF4FF]', text: 'text-[#1559C7]', ring: 'border-[#C3D8FD]', bar: 'bg-[#1570EF]' },
  { key: 'orange', chip: 'bg-gradient-to-br from-[#FDB022] to-[#F79009] text-white', soft: 'bg-[#FFF6E8]', text: 'text-[#B54708]', ring: 'border-[#FEDF89]', bar: 'bg-[#F79009]' },
  { key: 'purple', chip: 'bg-gradient-to-br from-[#A48AFB] to-[#7F56D9] text-white', soft: 'bg-[#F4F1FF]', text: 'text-[#6941C6]', ring: 'border-[#D9CFFD]', bar: 'bg-[#7F56D9]' },
  { key: 'pink', chip: 'bg-gradient-to-br from-[#FD6F8E] to-[#E31B54] text-white', soft: 'bg-[#FFF1F3]', text: 'text-[#C01048]', ring: 'border-[#FECDD6]', bar: 'bg-[#E31B54]' },
  { key: 'navy', chip: 'bg-gradient-to-br from-[#1F5A9E] to-[#05366E] text-white', soft: 'bg-[#EAF0F8]', text: 'text-[#05366E]', ring: 'border-[#C5D5EA]', bar: 'bg-[#05366E]' },
];

export const tone = (i) => TONES[i % TONES.length];

/** Look a tone up by key ('green', 'blue' …). */
export const toneOf = (key) => TONES.find((t) => t.key === key) || TONES[0];
