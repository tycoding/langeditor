const animate = require('tailwindcss-animate')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['variant', '.dark &'],
  safelist: ['dark'],
  prefix: '',
  content: [
    './pages/**/*.{ts,tsx,vue}',
    './components/**/*.{ts,tsx,vue}',
    './app/**/*.{ts,tsx,vue}',
    './src/**/*.{ts,tsx,vue}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Prefer the Tailwind v4 token names used by host applications, while
        // retaining the editor's legacy HSL variables for existing consumers.
        border: 'var(--color-border, hsl(var(--border)))',
        input: 'var(--color-input, hsl(var(--input)))',
        ring: 'var(--color-ring, hsl(var(--ring)))',
        background: 'var(--color-background, hsl(var(--background)))',
        foreground: 'var(--color-foreground, hsl(var(--foreground)))',
        primary: {
          DEFAULT: 'var(--color-primary, hsl(var(--primary)))',
          foreground: 'var(--color-primary-foreground, hsl(var(--primary-foreground)))',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary, hsl(var(--secondary)))',
          foreground: 'var(--color-secondary-foreground, hsl(var(--secondary-foreground)))',
        },
        destructive: {
          DEFAULT: 'var(--color-destructive, hsl(var(--destructive)))',
          foreground: 'var(--color-destructive-foreground, hsl(var(--destructive-foreground)))',
        },
        muted: {
          DEFAULT: 'var(--color-muted, hsl(var(--muted)))',
          foreground: 'var(--color-muted-foreground, hsl(var(--muted-foreground)))',
        },
        accent: {
          DEFAULT: 'var(--color-accent, hsl(var(--accent)))',
          foreground: 'var(--color-accent-foreground, hsl(var(--accent-foreground)))',
        },
        selection: {
          DEFAULT: 'var(--color-selection, hsl(var(--selection)))',
          foreground: 'var(--color-selection-foreground, hsl(var(--selection-foreground)))',
        },
        popover: {
          DEFAULT: 'var(--color-popover, hsl(var(--popover)))',
          foreground: 'var(--color-popover-foreground, hsl(var(--popover-foreground)))',
        },
        card: {
          DEFAULT: 'var(--color-card, hsl(var(--card)))',
          foreground: 'var(--color-card-foreground, hsl(var(--card-foreground)))',
        },
        chart: {
          1: 'var(--color-chart-1, hsl(var(--chart-1)))',
          2: 'var(--color-chart-2, hsl(var(--chart-2)))',
          3: 'var(--color-chart-3, hsl(var(--chart-3)))',
          4: 'var(--color-chart-4, hsl(var(--chart-4)))',
          5: 'var(--color-chart-5, hsl(var(--chart-5)))',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: 0,
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: 0,
          },
        },
        'collapsible-down': {
          from: {
            height: 0,
          },
          to: {
            height: 'var(--radix-collapsible-content-height)',
          },
        },
        'collapsible-up': {
          from: {
            height: 'var(--radix-collapsible-content-height)',
          },
          to: {
            height: 0,
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'collapsible-down': 'collapsible-down 0.2s ease-in-out',
        'collapsible-up': 'collapsible-up 0.2s ease-in-out',
      },
    },
  },
  plugins: [animate],
}
