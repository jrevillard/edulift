/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    // ConnectionStatusBanner color classes
    'bg-red-50', 'border-red-200', 'text-red-800',
    'dark:bg-red-950', 'dark:border-red-800', 'dark:text-red-200',
    'bg-yellow-50', 'border-yellow-200', 'text-yellow-800',
    'dark:bg-yellow-950', 'dark:border-yellow-800', 'dark:text-yellow-200',
    'bg-white/50', 'hover:bg-white/80', 'hover:bg-white/20',
    'border-current'
  ],
  theme: {
    extend: {
      colors: {
        // Theme colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Use CSS variables for all semantic colors (modern approach)
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        
        // Semantic status colors
        success: "hsl(var(--success))",
        "success-foreground": "hsl(var(--success-foreground))",
        "success-muted": "hsl(var(--success-muted))",
        "success-muted-foreground": "hsl(var(--success-muted-foreground))",
        
        warning: "hsl(var(--warning))",
        "warning-foreground": "hsl(var(--warning-foreground))",
        "warning-muted": "hsl(var(--warning-muted))",
        "warning-muted-foreground": "hsl(var(--warning-muted-foreground))",
        
        info: "hsl(var(--info))",
        "info-foreground": "hsl(var(--info-foreground))",
        "info-muted": "hsl(var(--info-muted))",
        "info-muted-foreground": "hsl(var(--info-muted-foreground))",
        
        // Interactive states
        "focus-ring": "hsl(var(--focus-ring))",
        "hover-muted": "hsl(var(--hover-muted))",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
