/**
 * Design Tokens - VPS Console Professional Theme
 * Centralized design system configuration
 */

// ============================================
// COLOR PALETTE (Oklch for better perception)
// ============================================

export const colors = {
  // Primary - Professional Blue
  primary: {
    50: 'oklch(97% 0.02 250)',
    100: 'oklch(94% 0.04 250)',
    200: 'oklch(88% 0.08 250)',
    300: 'oklch(78% 0.14 250)',
    400: 'oklch(68% 0.18 250)',
    500: 'oklch(60% 0.2 250)',   // Main
    600: 'oklch(52% 0.18 250)',
    700: 'oklch(45% 0.15 250)',
    800: 'oklch(38% 0.12 250)',
    900: 'oklch(30% 0.08 250)',
  },

  // Success - Vibrant Green
  success: {
    50: 'oklch(97% 0.03 145)',
    100: 'oklch(94% 0.06 145)',
    200: 'oklch(88% 0.12 145)',
    300: 'oklch(78% 0.16 145)',
    400: 'oklch(72% 0.19 145)',  // Main
    500: 'oklch(65% 0.18 145)',
    600: 'oklch(55% 0.15 145)',
    700: 'oklch(45% 0.12 145)',
    800: 'oklch(38% 0.08 145)',
    900: 'oklch(28% 0.05 145)',
  },

  // Warning - Amber
  warning: {
    50: 'oklch(98% 0.03 85)',
    100: 'oklch(95% 0.08 85)',
    200: 'oklch(90% 0.14 85)',
    300: 'oklch(82% 0.17 85)',
    400: 'oklch(75% 0.18 85)',   // Main
    500: 'oklch(68% 0.17 85)',
    600: 'oklch(58% 0.15 85)',
    700: 'oklch(48% 0.12 85)',
    800: 'oklch(40% 0.08 85)',
    900: 'oklch(30% 0.05 85)',
  },

  // Destructive - Red
  destructive: {
    50: 'oklch(97% 0.02 25)',
    100: 'oklch(94% 0.05 25)',
    200: 'oklch(88% 0.12 25)',
    300: 'oklch(75% 0.18 25)',
    400: 'oklch(65% 0.22 25)',
    500: 'oklch(60% 0.22 25)',   // Main
    600: 'oklch(52% 0.2 25)',
    700: 'oklch(45% 0.16 25)',
    800: 'oklch(38% 0.12 25)',
    900: 'oklch(28% 0.08 25)',
  },

  // Accent - Purple/Violet
  accent: {
    50: 'oklch(97% 0.02 280)',
    100: 'oklch(94% 0.05 280)',
    200: 'oklch(88% 0.1 280)',
    300: 'oklch(78% 0.14 280)',
    400: 'oklch(70% 0.15 280)',  // Main
    500: 'oklch(62% 0.18 280)',
    600: 'oklch(52% 0.16 280)',
    700: 'oklch(45% 0.14 280)',
    800: 'oklch(38% 0.1 280)',
    900: 'oklch(28% 0.06 280)',
  },

  // Neutral Gray
  gray: {
    50: 'oklch(98% 0.005 250)',
    100: 'oklch(96% 0.005 250)',
    200: 'oklch(92% 0.008 250)',
    300: 'oklch(86% 0.01 250)',
    400: 'oklch(70% 0.015 250)',
    500: 'oklch(55% 0.015 250)',
    600: 'oklch(45% 0.015 250)',
    700: 'oklch(35% 0.015 250)',
    800: 'oklch(25% 0.015 250)',
    900: 'oklch(15% 0.015 250)',
    950: 'oklch(10% 0.015 250)',
  },
} as const;

// ============================================
// SPACING SCALE (based on 4px grid)
// ============================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
} as const;

// ============================================
// BORDER RADIUS
// ============================================

export const borderRadius = {
  none: '0',
  sm: '0.25rem',    // 4px
  DEFAULT: '0.5rem', // 8px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.25rem', // 20px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

// ============================================
// SHADOWS
// ============================================

export const shadows = {
  // Subtle shadows
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000',

  // Glow shadows for dark mode
  'glow-sm': '0 0 15px oklch(60% 0.2 250 / 0.2)',
  'glow-md': '0 0 25px oklch(60% 0.2 250 / 0.25)',
  'glow-lg': '0 0 40px oklch(60% 0.2 250 / 0.3)',
  'glow-success': '0 0 20px oklch(72% 0.19 145 / 0.3)',
  'glow-warning': '0 0 20px oklch(75% 0.18 85 / 0.3)',
  'glow-error': '0 0 20px oklch(60% 0.22 25 / 0.3)',

  // Glass effect shadows
  glass: '0 8px 32px rgb(0 0 0 / 0.12)',
  'glass-lg': '0 25px 50px -12px rgb(0 0 0 / 0.2)',
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],        // 12px
    sm: ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
    base: ['1rem', { lineHeight: '1.5rem' }],       // 16px
    lg: ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
    xl: ['1.25rem', { lineHeight: '1.75rem' }],     // 20px
    '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
    '5xl': ['3rem', { lineHeight: '1' }],           // 48px
    '6xl': ['3.75rem', { lineHeight: '1' }],        // 60px
  },
  fontWeight: {
    thin: '100',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ============================================
// Z-INDEX SCALE
// ============================================

export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',      // Base elements
  20: '20',      // Dropdowns
  30: '30',      // Fixed headers
  40: '40',      // Modals
  50: '50',      // Tooltips
  60: '60',      // Notifications
  70: '70',      // Overlays
  80: '80',      // Maximum priority
  90: '90',
  100: '100',
} as const;

// ============================================
// TRANSITIONS
// ============================================

export const transitions = {
  duration: {
    fastest: '50ms',
    faster: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },
  timing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    // Custom easing
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    snappy: 'cubic-bezier(0.2, 0, 0, 1)',
  },
} as const;

// ============================================
// BREAKPOINTS
// ============================================

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================
// STATUS COLORS (semantic)
// ============================================

export const statusColors = {
  healthy: {
    bg: 'oklch(97% 0.03 145)',
    text: 'oklch(45% 0.12 145)',
    border: 'oklch(88% 0.12 145)',
    dot: 'oklch(72% 0.19 145)',
  },
  warning: {
    bg: 'oklch(98% 0.03 85)',
    text: 'oklch(48% 0.12 85)',
    border: 'oklch(90% 0.14 85)',
    dot: 'oklch(75% 0.18 85)',
  },
  error: {
    bg: 'oklch(97% 0.02 25)',
    text: 'oklch(45% 0.16 25)',
    border: 'oklch(88% 0.12 25)',
    dot: 'oklch(60% 0.22 25)',
  },
  info: {
    bg: 'oklch(97% 0.02 250)',
    text: 'oklch(45% 0.15 250)',
    border: 'oklch(88% 0.08 250)',
    dot: 'oklch(60% 0.2 250)',
  },
  neutral: {
    bg: 'oklch(96% 0.005 250)',
    text: 'oklch(45% 0.015 250)',
    border: 'oklch(92% 0.008 250)',
    dot: 'oklch(70% 0.015 250)',
  },
} as const;

// ============================================
// CHART COLORS
// ============================================

export const chartColors = {
  light: {
    primary: 'oklch(60% 0.2 250)',
    secondary: 'oklch(70% 0.15 280)',
    success: 'oklch(65% 0.18 145)',
    warning: 'oklch(68% 0.17 85)',
    danger: 'oklch(60% 0.22 25)',
    info: 'oklch(65% 0.15 200)',
    grid: 'oklch(92% 0.008 250)',
    text: 'oklch(45% 0.015 250)',
  },
  dark: {
    primary: 'oklch(70% 0.18 250)',
    secondary: 'oklch(75% 0.14 280)',
    success: 'oklch(72% 0.19 145)',
    warning: 'oklch(75% 0.18 85)',
    danger: 'oklch(65% 0.2 25)',
    info: 'oklch(70% 0.14 200)',
    grid: 'oklch(25% 0.015 250)',
    text: 'oklch(70% 0.015 250)',
  },
} as const;

// ============================================
// GLASSMORPHISM PRESETS
// ============================================

export const glass = {
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(255, 255, 255, 0.3)',
    blur: '12px',
  },
  dark: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    blur: '20px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.08)',
    blur: '24px',
  },
} as const;

// Export all tokens
export const designTokens = {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
  zIndex,
  transitions,
  breakpoints,
  statusColors,
  chartColors,
  glass,
} as const;

export default designTokens;
