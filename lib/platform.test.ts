// lib/platform.test.ts
import { Platform } from "react-native";
import { isWeb } from "@/lib/platform";

describe("isWeb", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it("returns true on web platform", () => {
    Platform.OS = "web";
    expect(isWeb()).toBe(true);
  });

  it("returns true when document is available", () => {
    Platform.OS = "ios";
    expect(isWeb()).toBe(typeof document !== "undefined");
  });
});
