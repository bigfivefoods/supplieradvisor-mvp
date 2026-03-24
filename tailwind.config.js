/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          50: "#f8fafc",
          100: "#f1f5f9",
          900: "#0f172a",
        },
        accent: {
          500: "#00b4d8",   // SupplierAdvisor blue
          400: "#22d3ee",
        },
      },
      boxShadow: {
        premium: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
      },
    },
  },
  plugins: [],
}