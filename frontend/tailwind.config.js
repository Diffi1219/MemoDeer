/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--p-50)',
          100: 'var(--p-100)',
          200: 'var(--p-200)',
          300: 'var(--p-300)',
          400: 'var(--p-400)',
          500: 'var(--p-500)',
          600: 'var(--p-600)',
          700: 'var(--p-700)',
          800: 'var(--p-800)',
          900: 'var(--p-900)',
        },
        surface: {
          0: 'var(--s-0)',
          50: 'var(--s-50)',
          100: 'var(--s-100)',
          200: 'var(--s-200)',
          300: 'var(--s-300)',
          400: 'var(--s-400)',
          500: 'var(--s-500)',
          600: 'var(--s-600)',
          700: 'var(--s-700)',
          800: 'var(--s-800)',
          900: 'var(--s-900)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          light: 'var(--accent-light)',
          dark: 'var(--accent-dark)',
        },
        warning: {
          50: 'var(--warning-light)',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#f87171',
          500: 'var(--warning)',
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        glow: 'var(--shadow-glow)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        glacial: 'var(--duration-glacial)',
      },
      transitionTimingFunction: {
        'out': 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
        'spring': 'var(--ease-spring)',
        'bounce': 'var(--ease-bounce)',
        'smooth': 'var(--ease-smooth)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 300ms var(--ease-out)',
        'page-enter': 'pageEnter 300ms var(--ease-out)',
        'page-exit': 'pageExit 150ms var(--ease-in-out)',
        'pop-in': 'popIn 400ms var(--ease-spring)',
        'toast-in': 'toastIn 400ms var(--ease-spring)',
        'toast-out': 'toastOut 200ms var(--ease-in-out)',
        'modal-sheet-center': 'modalScaleIn 200ms var(--ease-spring)',
        'modal-sheet': 'modalSlideUp 250ms var(--ease-out)',
        'antler-grow': 'antlerGrow 1.5s var(--ease-in-out) infinite',
        'dot-bounce': 'dotBounce 1.4s infinite ease-in-out both',
      },
      animationDelay: {
        0: '0ms',
        50: '50ms',
        100: '100ms',
        150: '150ms',
        160: '160ms',
        200: '200ms',
        250: '250ms',
        300: '300ms',
        320: '320ms',
        350: '350ms',
        400: '400ms',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function ({ addUtilities, matchUtilities, theme }) {
      // animation-delay 工具类
      matchUtilities(
        {
          'animation-delay': (value) => ({
            'animation-delay': value,
          }),
        },
        { values: theme('animationDelay') }
      )
      // stagger 延迟工具 — 用于列表项
      addUtilities({
        '.stagger-delay-1': { 'animation-delay': '0ms' },
        '.stagger-delay-2': { 'animation-delay': '50ms' },
        '.stagger-delay-3': { 'animation-delay': '100ms' },
        '.stagger-delay-4': { 'animation-delay': '150ms' },
        '.stagger-delay-5': { 'animation-delay': '200ms' },
        '.stagger-delay-6': { 'animation-delay': '250ms' },
        '.stagger-delay-7': { 'animation-delay': '300ms' },
        '.stagger-delay-8': { 'animation-delay': '350ms' },
        '.stagger-delay-9': { 'animation-delay': '400ms' },
        '.stagger-delay-10': { 'animation-delay': '450ms' },
      })
    },
  ],
}
