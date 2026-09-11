// lib/pdf-preview.test.ts
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  sanitizePdfFilename,
  sharePdfBlob,
} from "@/lib/pdf-preview";

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

const mockIsAvailable = Sharing.isAvailableAsync as jest.MockedFunction<
  typeof Sharing.isAvailableAsync
>;
const mockWrite = FileSystem.writeAsStringAsync as jest.MockedFunction<
  typeof FileSystem.writeAsStringAsync
>;
const mockShare = Sharing.shareAsync as jest.MockedFunction<
  typeof Sharing.shareAsync
>;

describe("native PDF preview sharing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailable.mockResolvedValue(true);
    mockWrite.mockResolvedValue();
    mockShare.mockResolvedValue();
    global.btoa = jest.fn(() => "JVBERg==");
  });

  it("writes PDF bytes to cache before opening the native share sheet", async () => {
    const blob = {
      arrayBuffer: () => Promise.resolve(new Uint8Array([37, 80, 68, 70]).buffer),
    } as Blob;

    await sharePdfBlob(blob, "INV / 2026-01");

    expect(mockWrite).toHaveBeenCalledWith(
      "file:///cache/INV-2026-01.pdf",
      "JVBERg==",
      { encoding: "base64" },
    );
    expect(mockShare).toHaveBeenCalledWith(
      "file:///cache/INV-2026-01.pdf",
      expect.objectContaining({ mimeType: "application/pdf" }),
    );
  });

  it("reports devices that cannot open a generated PDF", async () => {
    mockIsAvailable.mockResolvedValue(false);
    await expect(
      sharePdfBlob({} as Blob, "invoice.pdf"),
    ).rejects.toThrow("not available");
    expect(mockWrite).not.toHaveBeenCalled();
  });
});

describe("PDF filenames", () => {
  it("sanitizes invoice numbers and preserves the PDF extension", () => {
    expect(sanitizePdfFilename("INV / 2026-01")).toBe("INV-2026-01.pdf");
    expect(sanitizePdfFilename("preview.pdf")).toBe("preview.pdf");
  });
});
