// Theme colours are hex CSS variables, so Tailwind can't add alpha to them by
// itself; without this, opacity utilities like `bg-ink/40` generate no CSS.
const withAlpha = cssVar =>
  `color-mix(in srgb, var(${cssVar}) calc(<alpha-value> * 100%), transparent)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: withAlpha('--bg'),
        surface: withAlpha('--surface'),
        ink: withAlpha('--ink'),
        muted: withAlpha('--muted'),
        line: withAlpha('--line'),
        brand: {
          DEFAULT: withAlpha('--brand'),
          hover: withAlpha('--brand-hover'),
        },
        severity: {
          critical: withAlpha('--sev-critical'),
          high: withAlpha('--sev-high'),
          medium: withAlpha('--sev-medium'),
          low: withAlpha('--sev-low'),
          fixed: withAlpha('--sev-fixed'),
        },
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'sans-serif'],
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['20px', '28px'],
        xl: ['28px', '34px'],
        '2xl': ['44px', '52px'],
        '3xl': ['72px', '76px'],
      },
      borderRadius: {
        sm: '3px',
        md: '6px',
        lg: '10px',
      },
    },
  },
  plugins: [],
}
