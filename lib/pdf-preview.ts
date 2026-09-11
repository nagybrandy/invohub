// lib/pdf-preview.ts
// Converts generated PDF blobs into web object URLs or shareable native cache files.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

const PDF_MIME_TYPE = "application/pdf";

export function createPdfObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export async function sharePdfBlob(
  blob: Blob,
  filename: string,
): Promise<void> {
  if (!FileSystem.cacheDirectory) {
    throw new Error("A temporary PDF directory is not available.");
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("PDF sharing is not available on this device.");
  }

  const safeFilename = sanitizePdfFilename(filename);
  const fileUri = `${FileSystem.cacheDirectory}${safeFilename}`;
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, {
    mimeType: PDF_MIME_TYPE,
    dialogTitle: "Open PDF preview",
    UTI: "com.adobe.pdf",
  });
}

export function sanitizePdfFilename(filename: string): string {
  const normalized = filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withExtension = normalized.toLowerCase().endsWith(".pdf")
    ? normalized
    : `${normalized || "invoice-preview"}.pdf`;
  return withExtension || "invoice-preview.pdf";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary);
}
