/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // ── TARAQOB DESIGN SYSTEM ──
      colors: {
        // Primary Navy
        navy: {
          950: '#060D14',
          900: '#0D1B2A',
          800: '#122236',
          700: '#1A3048',
          600: '#1E3A5F',
          500: '#2A4F7A',
          400: '#3D6B9E',
          300: '#5A8BC0',
          200: '#8BB4D8',
          100: '#C5D9ED',
          50:  '#EBF2F9',
        },
        // Warm Gold
        gold: {
          900: '#3D2A08',
          800: '#6B4A0F',
          700: '#8F6415',
          600: '#B47D1A',
          500: '#C9943A',
          400: '#D4A853',
          300: '#E0C07A',
          200: '#EDD9A8',
          100: '#F5EDD4',
          50:  '#FBF7EE',
        },
        // Muted Teal
        teal: {
          900: '#0A1F1E',
          800: '#0F3330',
          700: '#154744',
          600: '#1A5C58',
          500: '#2A7B75',
          400: '#3D9E97',
          300: '#5DBCB5',
          200: '#8FD4CE',
          100: '#C2EAE7',
          50:  '#EBF8F7',
        },
        // Signal Status
        signal: {
          'no-trade':   '#6B7280',
          'watch':      '#3B82F6',
          'conditional':'#D97706',
          'active':     '#059669',
          'exit':       '#7C3AED',
          'invalidated':'#DC2626',
          'closed':     '#374151',
          'draft':      '#9CA3AF',
          'pending':    '#F59E0B',
        },
        // Risk Levels
        risk: {
          low:     '#059669',
          medium:  '#D97706',
          high:    '#EA580C',
          extreme: '#DC2626',
        },
        // Neutrals
        surface: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },

      fontFamily: {
        arabic: ['"IBM Plex Sans Arabic"', '"Noto Kufi Arabic"', 'sans-serif'],
        latin:  ['"Instrument Serif"', '"Georgia"', 'serif'],
        mono:   ['"IBM Plex Mono"', 'monospace'],
        sans:   ['"IBM Plex Sans Arabic"', '"IBM Plex Sans"', 'sans-serif'],
      },

      fontSize: {
        'display-2xl': ['4.5rem',  { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl':  ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg':  ['3rem',    { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-md':  ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm':  ['1.875rem',{ lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-xs':  ['1.5rem',  { lineHeight: '1.25' }],
        'body-xl':     ['1.25rem', { lineHeight: '1.75' }],
        'body-lg':     ['1.125rem',{ lineHeight: '1.75' }],
        'body-md':     ['1rem',    { lineHeight: '1.6' }],
        'body-sm':     ['0.875rem',{ lineHeight: '1.6' }],
        'body-xs':     ['0.75rem', { lineHeight: '1.5' }],
        'label-lg':    ['0.875rem',{ lineHeight: '1', letterSpacing: '0.08em', fontWeight: '500' }],
        'label-md':    ['0.75rem', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '500' }],
        'label-sm':    ['0.625rem',{ lineHeight: '1', letterSpacing: '0.1em',  fontWeight: '600' }],
      },

      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '26':  '6.5rem',
        '30':  '7.5rem',
      },

      borderRadius: {
        'xs':  '0.25rem',
        'sm':  '0.375rem',
        'md':  '0.5rem',
        'lg':  '0.75rem',
        'xl':  '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },

      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
        'card-md': '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
        'card-lg': '0 4px 16px rgba(0,0,0,0.1), 0 16px 48px rgba(0,0,0,0.08)',
        'glow-gold':  '0 0 24px rgba(201,148,58,0.25)',
        'glow-teal':  '0 0 24px rgba(42,123,117,0.25)',
        'glow-navy':  '0 0 32px rgba(13,27,42,0.4)',
        'inset-sm':   'inset 0 1px 0 rgba(255,255,255,0.05)',
      },

      backgroundImage: {
        'gradient-radial':    'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':     'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'noise':              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        'mesh-dark':          'radial-gradient(at 20% 20%, rgba(42,123,117,0.15) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(201,148,58,0.1) 0px, transparent 50%), radial-gradient(at 50% 50%, rgba(13,27,42,1) 0px, transparent 80%)',
        'mesh-light':         'radial-gradient(at 20% 20%, rgba(42,123,117,0.06) 0px, transparent 50%), radial-gradient(at 80% 80%, rgba(201,148,58,0.05) 0px, transparent 50%)',
      },

      animation: {
        'fade-in':      'fadeIn 0.4s ease-out forwards',
        'fade-up':      'fadeUp 0.5s ease-out forwards',
        'fade-up-slow': 'fadeUp 0.8s ease-out forwards',
        'slide-in-r':   'slideInRight 0.4s ease-out forwards',
        'slide-in-l':   'slideInLeft 0.4s ease-out forwards',
        'pulse-gold':   'pulseGold 2s ease-in-out infinite',
        'counter':      'counter 1s ease-out forwards',
        'shimmer':      'shimmer 2s linear infinite',
        'float':        'float 3s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(201,148,58,0)' },
          '50%':      { opacity: '0.8', boxShadow: '0 0 0 8px rgba(201,148,58,0.1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },

      transitionTimingFunction: {
        'spring':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth':  'cubic-bezier(0.4, 0, 0.2, 1)',
        'elegant': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
    },
  },
  plugins: [],
}
