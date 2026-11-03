/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light admin theme (GG Shop India reference). Token NAMES are kept for
        // compatibility with existing usages: `dark` = page/input background,
        // `card` = raised surface (cards, modals, tables). `panel` stays the
        // dark sidebar chrome.
        admin: {
          dark: '#f1f5f9', // page + input background (light gray)
          card: '#ffffff', // cards / modals / table surfaces (white)
          panel: '#1C3053', // sidebar chrome (Partner App brand navy)
          border: '#e2e8f0', // hairline borders
          accent: '#035C6C', // Partner App teal — buttons, active nav, links
          muted: '#64748b', // secondary text
        },

        // Public marketing site palette (mirrors the GGFIX mobile apps).
        // Teal (Partner App, Nov 2026) is the primary brand + action colour.
        brand: {
          50: '#E5F3F5',
          100: '#C7E6EA',
          200: '#9FD3DA',
          300: '#6BB8C3',
          400: '#357D89',
          500: '#0A6F80',
          600: '#035C6C',
          700: '#024A57',
          800: '#023A44',
          900: '#012B33',
          DEFAULT: '#035C6C',
          light: '#357D89',
          dark: '#024A57',
          soft: '#E5F3F5',
          // Neutral/surface tokens used across the marketing pages.
          ink: '#0F172A', // primary body + heading text
          // Secondary text. Must clear AA (4.5:1) on EVERY light surface it is
          // used on, not just white — the site's default section tone is
          // `page` and pills/labels sit on `soften`. #64748B passed on white
          // (4.83) but failed on soften (4.39) and page (4.48); this value
          // clears 5.3:1 on all four (white / page / soften / brand-50).
          muted: '#5A6678',
          subtle: '#94A3B8', // decorative text only — never body copy
          page: '#F6F7F9', // page background
          card: '#FFFFFF', // card surface
          line: '#E5E7EB', // hairline border
          strong: '#D1D5DB', // emphasised border
          soften: '#F1F3F5', // muted fill / alternating surface
        },

        // Orange accent — used sparingly: badges, highlight numbers, one CTA.
        accent: {
          50: '#FFF8E5',
          100: '#FFEFC2',
          200: '#FFE08A',
          300: '#FFD152',
          400: '#FFBE29',
          500: '#FAA700',
          600: '#B87A00',
          700: '#8C5A00',
          800: '#6B4500',
          900: '#4D3200',
          DEFAULT: '#FAA700',
          light: '#FFBE29',
          dark: '#D98F00',
          soft: '#FFEFC2',
        },

        // Status colours shared by both surfaces.
        status: {
          success: '#609138',
          warning: '#F3BF23',
          danger: '#F84141',
          info: '#0788C9',
        },
      },

      borderRadius: {
        xl: '16px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px',
      },

      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        lift: '0 8px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.05)',
        glow: '0 10px 30px rgba(3, 92, 108, 0.18)',
      },

      maxWidth: {
        prose: '65ch',
      },

      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
      },

      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        shake: 'shake 0.35s ease-in-out',
      },
    },
  },
  plugins: [],
};
