// lib/i18n/language.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  hydrateAppLanguage,
  isAppLanguage,
  loadStoredLanguage,
  setAppLanguage,
} from "@/lib/i18n/language";

const changeLanguage = jest.fn(async (lng: string) => {
  mockI18n.language = lng;
});

const mockI18n = {
  language: "hu",
  changeLanguage,
};

jest.mock("@/lib/i18n", () => ({
  __esModule: true,
  default: mockI18n,
}));

describe("language helpers", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockI18n.language = "hu";
    changeLanguage.mockClear();
  });

  it("accepts only hu and en", () => {
    expect(isAppLanguage("hu")).toBe(true);
    expect(isAppLanguage("en")).toBe(true);
    expect(isAppLanguage("de")).toBe(false);
  });

  it("defaults to Hungarian when nothing is stored", async () => {
    await expect(loadStoredLanguage()).resolves.toBe("hu");
  });

  it("persists and hydrates the selected language", async () => {
    await setAppLanguage("en");
    expect(changeLanguage).toHaveBeenCalledWith("en");
    expect(await AsyncStorage.getItem("invohub.language")).toBe("en");

    mockI18n.language = "hu";
    await expect(hydrateAppLanguage()).resolves.toBe("en");
    expect(changeLanguage).toHaveBeenCalledWith("en");
  });
});
