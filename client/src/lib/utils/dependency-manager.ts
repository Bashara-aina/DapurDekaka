
/**
 * This file centralizes component imports to avoid importing unused components
 * and facilitate better tree-shaking
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Only export Radix UI components that are actually used
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@radix-ui/react-accordion";

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@radix-ui/react-dialog";

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@radix-ui/react-navigation-menu";

// Export optimized icons collection
// Using only Lucide React for consistency
export {
  Menu,
  X,
  ChevronDown,
  ShoppingCart,
  User,
  Search,
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

// Unified className utility (replaces both clsx and tailwind-merge)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// React hooks exports
export { useState, useEffect, useCallback, useMemo, useRef };

// Image optimization helper
export function getOptimizedImageUrl(src: string, width?: number): string {
  if (!src) return '';
  return width ? `${src}?w=${width}` : src;
}
