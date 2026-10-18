/**
 * Premium fintech animation variants and transition configurations.
 * Inspired by Linear, Stripe, and Revolut.
 * Designed for 120-250ms micro-interactions and 300-400ms visual entrances.
 */

export const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const gentleSpring = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
};

export const easeOutExpo = [0.16, 1, 0.3, 1];

// 1. Button Press Scale
export const buttonPress = {
  scale: 0.97,
  transition: { duration: 0.1, ease: 'easeOut' },
};

// 2. Card Hover Lift & Border Transition
export const cardHoverProps = {
  whileHover: {
    y: -3,
    transition: { duration: 0.2, ease: easeOutExpo },
  },
};

// 3. Navigation / Page Transition
export const pageTransitionVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// 4. Modal / Dialog Transition
export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.14, ease: 'easeIn' } },
};

export const modalDialogVariants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.14, ease: 'easeIn' },
  },
};

// 5. Dropdown Menu Variants
export const dropdownVariants = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// 6. Staggered Container for Dashboard & Cards
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easeOutExpo },
  },
};

// 7. Toast Notifications
export const toastVariants = {
  initial: { opacity: 0, y: 14, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.95,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};
