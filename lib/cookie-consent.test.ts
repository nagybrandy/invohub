// lib/cookie-consent.test.ts
import {
  createCookieConsent,
  parseCookieConsent,
} from "@/lib/cookie-consent";

describe("cookie consent", () => {
  it("defaults all nonessential categories to denied", () => {
    expect(createCookieConsent()).toMatchObject({
      essential: true,
      analytics: false,
      marketing: false,
    });
  });

  it("rejects malformed persisted preferences", () => {
    expect(parseCookieConsent('{"analytics":"yes"}')).toBeNull();
    expect(parseCookieConsent("not-json")).toBeNull();
  });

  it("never allows persisted data to disable essential storage", () => {
    expect(
      parseCookieConsent(
        '{"essential":false,"analytics":true,"marketing":false}',
      ),
    ).toMatchObject({ essential: true, analytics: true, marketing: false });
  });
});
