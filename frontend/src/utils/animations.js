/**
 * MoneyFlow — Unified Global Motion System
 * Inspired by Linear, Stripe, and Revolut.
 * Fast, responsive, accessible, with transform & opacity emphasis.
 */

// 1. Duration & Easing Tokens
export const motionTokens = {
  duration: {
    fast: 0.12,      // 100-150ms: button presses, toggles, icon micro-states
    standard: 0.18,  // 160-220ms: dropdowns, tabs, card hovers
    page: 0.2,       // 180-250ms: subtle page content entrances
    modal: 0.24,     // 200-280ms: dialogs, drawers, bottom sheets
  },
  ease: {
    outExpo: [0.16, 1, 0.3, 1],
    inOut: [0.4, 0, 0.2, 1],
    out: [0, 0, 0.2, 1],
    in: [0.4, 0, 1, 1],
  },
};

export const easeOutExpo = motionTokens.ease.outExpo;

export const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const gentleSpring = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
};

// 2. Button Micro-Interactions
export const buttonPress = {
  scale: 0.97,
  transition: { duration: motionTokens.duration.fast, ease: 'easeOut' },
};

// 3. Card Hover Lift & Border Transition
export const cardHoverProps = {
  whileHover: {
    y: -2,
    transition: { duration: motionTokens.duration.standard, ease: easeOutExpo },
  },
};

// 4. Subtle Page Content Transition
export const pageTransitionVariants = {
  initial: { opacity: 0, y: 5 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.page, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -3,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// 5. Modal / Centered Dialog Transition
export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: motionTokens.duration.standard, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: 'easeIn' } },
};

export const modalDialogVariants = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: motionTokens.duration.modal, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: { duration: motionTokens.duration.fast, ease: 'easeIn' },
  },
};

// 6. Drawer & Bottom Sheet Transitions
export const drawerRightVariants = {
  initial: { x: '100%', opacity: 0.5 },
  animate: { x: 0, opacity: 1, transition: { duration: motionTokens.duration.modal, ease: easeOutExpo } },
  exit: { x: '100%', opacity: 0, transition: { duration: motionTokens.duration.standard, ease: 'easeIn' } },
};

export const drawerBottomVariants = {
  initial: { y: '100%', opacity: 0.5 },
  animate: { y: 0, opacity: 1, transition: { duration: motionTokens.duration.modal, ease: easeOutExpo } },
  exit: { y: '100%', opacity: 0, transition: { duration: motionTokens.duration.standard, ease: 'easeIn' } },
};

// 7. Dropdown Menu Variants
export const dropdownVariants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: motionTokens.duration.standard, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -3,
    transition: { duration: motionTokens.duration.fast, ease: 'easeIn' },
  },
};

// 8. Fluid Tab Active Indicator Transition
export const tabIndicatorTransition = {
  type: 'spring',
  stiffness: 450,
  damping: 32,
};

// 9. Staggered Container for Dashboard & Cards
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.01,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.modal, ease: easeOutExpo },
  },
};

// 10. Toast Notifications
export const toastVariants = {
  initial: { opacity: 0, y: 12, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: motionTokens.duration.page, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.95,
    transition: { duration: motionTokens.duration.fast, ease: 'easeIn' },
  },
};
