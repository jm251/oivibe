import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        bullish: "hsl(var(--bullish))",
        bearish: "hsl(var(--bearish))",
        warning: "hsl(var(--warning))",
        panel: "hsl(var(--panel))",
        "panel-foreground": "hsl(var(--panel-foreground))"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        neon: "0 0 20px rgba(0, 255, 126, 0.15)",
        danger: "0 0 20px rgba(255, 77, 77, 0.15)"
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(95, 105, 125, 0.2) 1px, transparent 0)",
        glow: "radial-gradient(circle at center, rgba(0,255,126,0.18) 0%, rgba(0,0,0,0) 62%)"
      },
      keyframes: {
        pulseRise: {
          "0%": { opacity: "0.35", transform: "scale(0.98)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      animation: {
        pulseRise: "pulseRise .5s ease-out"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;