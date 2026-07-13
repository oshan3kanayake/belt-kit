import type { Config } from "tailwindcss";

/**
 * BELT-KIT — "Enterprise Clean" theme.
 * Professional SaaS look: white surfaces, slate neutrals, a single
 * restrained blue accent, subtle borders and shadows.
 * The historic token NAMES (burgundy, rosegold, ink, line, canvas, surface)
 * are preserved and remapped, so every existing utility class flips to the
 * new look without renaming anything across the app.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA",
        surface: "#FFFFFF",
        "surface-muted": "#F2F4F7",
        burgundy: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
          deep: "#172554",
        },
        rosegold: {
          50: "#F0F9FF",
          100: "#E0F2FE",
          200: "#BAE6FD",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0284C7",
          700: "#0369A1",
          800: "#075985",
          900: "#0C4A6E",
        },
        ink: {
          DEFAULT: "#111827",
          soft: "#4B5563",
          faint: "#9CA3AF",
        },
        line: "#E5E7EB",
        viz: {
          indigo: "#2563EB",
          teal: "#0891B2",
          violet: "#7C3AED",
          sky: "#38BDF8",
          amber: "#F59E0B",
          rose: "#E11D48",
          emerald: "#059669",
          slate: "#64748B",
        },
      },
      fontFamily: {
        serif: ["var(--font-jost)", "system-ui", "sans-serif"],
        sans: ["var(--font-jost)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(17, 24, 39, 0.05)",
        luxe: "0 4px 12px -2px rgba(17, 24, 39, 0.08), 0 2px 4px -2px rgba(17, 24, 39, 0.04)",
        "luxe-lg": "0 20px 40px -12px rgba(17, 24, 39, 0.15)",
        glow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
        "brutal-sm": "0 1px 2px 0 rgba(17, 24, 39, 0.05)",
        "brutal-lime": "0 4px 12px -2px rgba(17, 24, 39, 0.08)",
        "brutal-cyan": "0 4px 12px -2px rgba(17, 24, 39, 0.08)",
      },
      backgroundImage: {
        "rosegold-sheen": "linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)",
        "burgundy-deep": "linear-gradient(150deg, #1D4ED8 0%, #172554 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
