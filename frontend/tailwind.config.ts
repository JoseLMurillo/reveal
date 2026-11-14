import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4EFE4",
        "paper-raised": "#FFFDF8",
        ink: "#24231F",
        brown: "#705C48",
        yellow: "#E6B83F",
        red: "#9C4439",
        cream: "#E9E0D0",
        border: "#D8CEBC",
        muted: "#7A6A56",
        success: "#4F6B4A",
        warning: "#8A5A12",
      },
      fontFamily: {
        display: ["Fraunces Variable", "Fraunces", "Georgia", "serif"],
        sans: ["Inter Variable", "Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 8vw, 6rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "heading-lg": ["2rem", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "heading-md": ["1.5rem", { lineHeight: "1.25" }],
        "heading-sm": ["1.25rem", { lineHeight: "1.3" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.08em" }],
        micro: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.08em" }],
      },
      maxWidth: {
        reading: "680px",
        gallery: "1200px",
        admin: "1440px",
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(36,35,31,0.06), 0 8px 24px rgba(36,35,31,0.06)",
        lift: "0 2px 4px rgba(36,35,31,0.08), 0 16px 40px rgba(36,35,31,0.10)",
        press: "inset 0 1px 2px rgba(36,35,31,0.12)",
      },
      transitionTimingFunction: {
        film: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        sprocket: {
          from: { backgroundPositionX: "0" },
          to: { backgroundPositionX: "24px" },
        },
      },
      animation: {
        "fade-up": "fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
