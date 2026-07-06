/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./extension/popup.html", "./src/**/*.{ts,tsx}"],
  // <html class="dark"> で制御。useAppearance が設定 (自動/ライト/ダーク) に応じて
  // クラスを付け外しする (自動 = OS 追従)。
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Hiragino Sans",
          "Yu Gothic",
          "Meiryo",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px -6px rgb(0 0 0 / 0.08)",
        pop: "0 12px 40px -8px rgb(0 0 0 / 0.28), 0 2px 8px rgb(0 0 0 / 0.08)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 200ms ease-out both",
        "fade-in": "fade-in 150ms ease-out both",
        "scale-in": "scale-in 160ms cubic-bezier(0.2, 0.9, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
