/**
 * Framer Motion Variants & Utilities
 * Immersive Bento Design System
 */

import { Variants, Transition } from 'framer-motion';

// ============================================
// TRANSITION PRESETS
// ============================================

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: 'tween',
  ease: [0.4, 0, 0.2, 1],
  duration: 0.4,
};

export const fastTransition: Transition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.2,
};

export const slowTransition: Transition = {
  type: 'tween',
  ease: [0.4, 0, 0.2, 1],
  duration: 0.6,
};

// ============================================
// FADE VARIANTS
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0,
    transition: fastTransition,
  },
};

export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: fastTransition,
  },
};

export const fadeInDown: Variants = {
  hidden: { 
    opacity: 0, 
    y: -20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: fastTransition,
  },
};

export const fadeInLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -20,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: springTransition,
  },
};

export const fadeInRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 20,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: springTransition,
  },
};

// ============================================
// SCALE VARIANTS
// ============================================

export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: fastTransition,
  },
};

export const scaleInCenter: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

// ============================================
// STAGGER CONTAINERS
// ============================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

// ============================================
// CARD VARIANTS
// ============================================

export const cardHover: Variants = {
  initial: { 
    scale: 1,
    boxShadow: '0 0 0 rgba(14, 165, 233, 0)',
  },
  hover: { 
    scale: 1.02,
    boxShadow: '0 0 30px rgba(14, 165, 233, 0.15)',
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  tap: { 
    scale: 0.98,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
};

export const cardHoverGlow: Variants = {
  initial: { 
    scale: 1,
    boxShadow: '0 0 0 rgba(14, 165, 233, 0), 0 0 0 rgba(168, 85, 247, 0)',
  },
  hover: { 
    scale: 1.02,
    boxShadow: '0 0 30px rgba(14, 165, 233, 0.2), 0 0 60px rgba(168, 85, 247, 0.1)',
    transition: springTransition,
  },
  tap: { 
    scale: 0.98,
  },
};

export const cardHoverSubtle: Variants = {
  initial: { 
    y: 0,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  hover: { 
    y: -4,
    boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
    transition: springTransition,
  },
};

// ============================================
// BUTTON VARIANTS
// ============================================

export const buttonTap: Variants = {
  initial: { scale: 1 },
  tap: { 
    scale: 0.95,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

export const buttonHover: Variants = {
  initial: { 
    scale: 1,
    boxShadow: '0 0 0 rgba(14, 165, 233, 0)',
  },
  hover: { 
    scale: 1.05,
    boxShadow: '0 0 20px rgba(14, 165, 233, 0.3)',
    transition: springTransition,
  },
  tap: { 
    scale: 0.95,
  },
};

// ============================================
// LIST ITEM VARIANTS
// ============================================

export const listItem: Variants = {
  hidden: { 
    opacity: 0, 
    x: -10,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: { 
    opacity: 0, 
    x: 10,
    transition: fastTransition,
  },
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageTransition: Variants = {
  hidden: { 
    opacity: 0,
  },
  visible: { 
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
      when: 'beforeChildren',
      staggerChildren: 0.1,
    },
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

export const pageSlide: Variants = {
  hidden: { 
    opacity: 0,
    x: 20,
  },
  visible: { 
    opacity: 1,
    x: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0,
    x: -20,
    transition: fastTransition,
  },
};

// ============================================
// SIDEBAR/MENU VARIANTS
// ============================================

export const sidebarVariants: Variants = {
  open: {
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  closed: {
    x: '-100%',
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
};

export const menuItemVariants: Variants = {
  open: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  closed: {
    opacity: 0,
    x: -20,
    transition: fastTransition,
  },
};

// ============================================
// MODAL/OVERLAY VARIANTS
// ============================================

export const overlayVariants: Variants = {
  hidden: { 
    opacity: 0,
  },
  visible: { 
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

export const modalVariants: Variants = {
  hidden: { 
    opacity: 0,
    scale: 0.95,
    y: 10,
  },
  visible: { 
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: { 
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: fastTransition,
  },
};

// ============================================
// TOOLTIP VARIANTS
// ============================================

export const tooltipVariants: Variants = {
  hidden: { 
    opacity: 0,
    scale: 0.9,
    y: 5,
  },
  visible: { 
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
};

// ============================================
// SKELETON/LOADING VARIANTS
// ============================================

export const skeletonPulse: Variants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================
// NOTIFICATION/TOAST VARIANTS
// ============================================

export const notificationVariants: Variants = {
  hidden: { 
    opacity: 0,
    y: -20,
    scale: 0.95,
  },
  visible: { 
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: { 
    opacity: 0,
    x: 100,
    transition: fastTransition,
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a custom stagger container with specific timing
 */
export const createStaggerContainer = (
  staggerChildren: number = 0.1,
  delayChildren: number = 0.1
): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

/**
 * Pre-defined directional fade variants
 */
export const fadeInUpCustom = (distance: number = 20): Variants => ({
  hidden: { opacity: 0, y: distance },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: springTransition,
  },
});

export const fadeInDownCustom = (distance: number = 20): Variants => ({
  hidden: { opacity: 0, y: -distance },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: springTransition,
  },
});

export const fadeInLeftCustom = (distance: number = 20): Variants => ({
  hidden: { opacity: 0, x: -distance },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: springTransition,
  },
});

export const fadeInRightCustom = (distance: number = 20): Variants => ({
  hidden: { opacity: 0, x: distance },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: springTransition,
  },
});

/**
 * Viewport animation props for scroll-triggered animations
 */
export const viewportOnce = {
  once: true,
  margin: '-50px',
};

export const viewportRepeat = {
  once: false,
  margin: '-100px',
  amount: 0.3,
};
