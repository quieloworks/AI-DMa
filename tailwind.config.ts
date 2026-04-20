import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
          tertiary: "var(--color-bg-tertiary)",
        },
        ink: {
          DEFAULT: "var(--color-text-primary)",
          soft: "var(--color-text-secondary)",
          hint: "var(--color-text-hint)",
        },
        line: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          bg: "var(--color-accent-bg)",
          text: "var(--color-accent-text)",
        },
        coral: {
          50: "#FAECE7",
          200: "#F0997B",
          400: "#D85A30",
          600: "#993C1D",
          800: "#712B13",
        },
        amber: {
          50: "#FAEEDA",
          200: "#EF9F27",
          400: "#BA7517",
          600: "#854F0B",
          800: "#633806",
        },
        neutralRamp: {
          50: "#F1EFE8",
          200: "#B4B2A9",
          400: "#888780",
          600: "#5F5E5A",
          800: "#444441",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.4s ease both",
      },
    },
  },
  plugins: [],
};
export default config;
