import React from 'react';
import {
  Utensils,
  ShoppingCart,
  Car,
  Fuel,
  ShoppingBag,
  Receipt,
  Film,
  HeartPulse,
  GraduationCap,
  Plane,
  Sparkles,
  Tag,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  RotateCcw,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  HelpCircle
} from 'lucide-react';

const ICON_MAP = {
  Utensils,
  ShoppingCart,
  Car,
  Fuel,
  ShoppingBag,
  Receipt,
  Film,
  HeartPulse,
  GraduationCap,
  Plane,
  Sparkles,
  Tag,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  RotateCcw,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
};

export const getCategoryIcon = (iconName, className = 'w-4 h-4') => {
  const IconComponent = ICON_MAP[iconName] || Tag;
  return <IconComponent className={className} />;
};

export const getPaymentMethodIcon = (method, className = 'w-3.5 h-3.5') => {
  switch (method) {
    case 'CASH':
      return <Banknote className={className} />;
    case 'UPI':
      return <Smartphone className={className} />;
    case 'CARD':
      return <CreditCard className={className} />;
    case 'NET_BANKING':
      return <Building className={className} />;
    default:
      return <Wallet className={className} />;
  }
};

export const PAYMENT_METHODS = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'NET_BANKING', label: 'Net Banking' },
  { value: 'OTHER', label: 'Other' },
];

