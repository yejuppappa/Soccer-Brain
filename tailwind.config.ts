import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem", /* 9px */
        md: ".375rem", /* 6px */
        sm: ".1875rem", /* 3px */
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        sidebar: {
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
        "sidebar-primary": {
          DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          border: "var(--sidebar-primary-border)",
        },
        "sidebar-accent": {
          DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "var(--sidebar-accent-border)"
        },
        status: {
          online: "rgb(34 197 94)",
          away: "rgb(245 158 11)",
          busy: "rgb(239 68 68)",
          offline: "rgb(156 163 175)",
        },
        sb: {
          bg: "rgb(var(--sb-bg) / <alpha-value>)",
          surface: "rgb(var(--sb-surface) / <alpha-value>)",
          "surface-alt": "rgb(var(--sb-surface-alt) / <alpha-value>)",
          "surface-hover": "rgb(var(--sb-surface-hover) / <alpha-value>)",
          skeleton: "rgb(var(--sb-skeleton-base) / <alpha-value>)",
          "skeleton-highlight": "rgb(var(--sb-skeleton-highlight) / <alpha-value>)",
          text: "rgb(var(--sb-text) / <alpha-value>)",
          "text-secondary": "rgb(var(--sb-text-secondary) / <alpha-value>)",
          "text-muted": "rgb(var(--sb-text-muted) / <alpha-value>)",
          "text-dim": "rgb(var(--sb-text-dim) / <alpha-value>)",
          "text-faint": "rgb(var(--sb-text-faint) / <alpha-value>)",
          border: "rgb(var(--sb-border) / <alpha-value>)",
          "border-subtle": "rgb(var(--sb-border-subtle) / <alpha-value>)",
          divider: "rgb(var(--sb-divider) / <alpha-value>)",
          primary: "rgb(var(--sb-primary) / <alpha-value>)",
          "primary-dark": "rgb(var(--sb-primary-dark) / <alpha-value>)",
          live: "rgb(var(--sb-live) / <alpha-value>)",
          win: "rgb(var(--sb-win) / <alpha-value>)",
          lose: "rgb(var(--sb-lose) / <alpha-value>)",
          draw: "rgb(var(--sb-draw) / <alpha-value>)",
          star: "hsl(var(--sb-star) / <alpha-value>)",
          "header-bg": "rgb(var(--sb-header-bg) / <alpha-value>)",
          "footer-bg": "rgb(var(--sb-footer-bg) / <alpha-value>)",
          "footer-active": "rgb(var(--sb-footer-active) / <alpha-value>)",
          "footer-inactive": "rgb(var(--sb-footer-inactive) / <alpha-value>)",
          "button-bg": "rgb(var(--sb-button-bg) / <alpha-value>)",
          "button-text": "rgb(var(--sb-button-text) / <alpha-value>)",
          "button-active-bg": "rgb(var(--sb-button-active-bg) / <alpha-value>)",
          "button-active-text": "rgb(var(--sb-button-active-text) / <alpha-value>)",
          "card-border": "rgb(var(--sb-card-border) / <alpha-value>)",
          icon: "rgb(var(--sb-icon) / <alpha-value>)",
          "icon-disabled": "rgb(var(--sb-icon-disabled) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
