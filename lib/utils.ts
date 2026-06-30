// lib/utils.ts
// Tailwind class merge helper used by every shadcn / react-native-reusables component.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
