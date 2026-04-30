import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        meridian: {
          50: "var(--meridian-50)",
          100: "var(--meridian-100)",
          200: "var(--meridian-200)",
          300: "var(--meridian-300)",
          400: "var(--meridian-400)",
          500: "var(--meridian-500)",
          600: "var(--meridian-600)",
          700: "var(--meridian-700)",
          800: "var(--meridian-800)",
          900: "var(--meridian-900)",
          950: "var(--meridian-950)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
