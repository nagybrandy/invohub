// lib/clipboard.test.ts
import { Platform, Share } from "react-native";
import { copyText } from "@/lib/clipboard";

describe("copyText", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.restoreAllMocks();
  });

  it("writes to clipboard on web", async () => {
    Platform.OS = "web";
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await copyText("pk_test");

    expect(writeText).toHaveBeenCalledWith("pk_test");
  });

  it("falls back to Share on native", async () => {
    Platform.OS = "ios";
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });

    await copyText("sk_test");

    expect(share).toHaveBeenCalledWith({ message: "sk_test" });
  });
});
