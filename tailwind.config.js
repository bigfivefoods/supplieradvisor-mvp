/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          900: '#0f172a',
        },
        accent: {
          500: '#00b4d8',
          400: '#22d3ee',
        },
      },
      boxShadow: {
        premium: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
      },
      zIndex: {
        header: '200',
        drawer: '190',
      },
    },
  },
  plugins: [],
  // Keep critical landing chrome utilities even if scan misses a path
  safelist: [
    'fixed',
    'sticky',
    'inset-0',
    'top-0',
    'left-0',
    'right-0',
    'z-40',
    'z-50',
    'z-[100]',
    'z-[200]',
    'z-header',
    'z-drawer',
    'hidden',
    'flex',
    'md:flex',
    'lg:flex',
    'md:hidden',
    'lg:hidden',
    'backdrop-blur-md',
    'backdrop-blur-xl',
    'bg-white/90',
    'bg-white/95',
    'bg-white',
  ],
};
