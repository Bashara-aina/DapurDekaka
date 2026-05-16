import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#C8102E',
          'red-dark': '#8B0000',
          'red-light': '#E8394F',
          'red-muted': '#F5C6CC',
          cream: '#F0EAD6',
          'cream-dark': '#E0D4BC',
          'cream-darker': '#C8B89A',
          gold: '#C9A84C',
          navy: '#1B2A4A',
          'navy-light': '#2D3F6B',
        },
        surface: {
          white: '#FFFFFF',
          off: '#FAFAF8',
          cream: '#F0EAD6',
        },
        text: {
          primary: '#1A1A1A',
          secondary: '#6B6B6B',
          disabled: '#ABABAB',
          inverse: '#FFFFFF',
        },
        admin: {
          sidebar: '#0F172A',
          'sidebar-text': '#94A3B8',
          'sidebar-active': '#FFFFFF',
          'sidebar-hover': '#1E293B',
          content: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
        'button': '0 1px 2px rgba(200,16,46,0.3)',
        'button-hover': '0 4px 12px rgba(200,16,46,0.4)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'badge': '6px',
        'pill': '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(200,16,46,0.4)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgba(200,16,46,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};

export default config;