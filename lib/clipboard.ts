// lib/clipboard.ts
// Cross-platform copy helper for credentials and links.
import { Platform, Share } from "react-native";

export async function copyText(text: string): Promise<void> {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  await Share.share({ message: text });
}
