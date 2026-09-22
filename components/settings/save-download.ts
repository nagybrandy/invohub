// components/settings/save-download.ts
// Saves a fetched file on web via a temporary object-URL anchor (the same
// pattern as app/(app)/admin/api-docs.tsx). Returns false where there's no
// DOM to save into (native), so the caller can say so instead of silently
// doing nothing.
import { Platform } from "react-native";

export function saveDownload(filename: string, blob: Blob): boolean {
  if (Platform.OS !== "web" || typeof document === "undefined") return false;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
