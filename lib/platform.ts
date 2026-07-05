// lib/platform.ts
// Runtime platform helpers for web vs native behavior.
import { Platform } from "react-native";

export function isWeb(): boolean {
  return Platform.OS === "web" || typeof document !== "undefined";
}
