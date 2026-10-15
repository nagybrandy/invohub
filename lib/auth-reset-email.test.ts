// lib/auth-reset-email.test.ts
import { buildPasswordResetEmail, PASSWORD_RESET_TOKEN_TTL_SECONDS } from "@/lib/auth-reset-email";

describe("buildPasswordResetEmail", () => {
  const url = "https://invohub.vercel.app/api/auth/reset-password/tok123?callbackURL=https%3A%2F%2Finvohub.vercel.app%2Freset-password";

  it("carries the reset link in both the text and the HTML body, and greets by name", () => {
    const mail = buildPasswordResetEmail({ url, name: "Farkas Ákos" });
    expect(mail.subject).toContain("jelszó");
    expect(mail.text).toContain(url);
    expect(mail.text).toContain("Kedves Farkas Ákos!");
    expect(mail.html).toContain(`href="${url.replace(/&/g, "&amp;")}"`);
  });

  it("falls back to a neutral greeting and escapes what the user controls", () => {
    const mail = buildPasswordResetEmail({ url, name: "<script>x</script>" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(buildPasswordResetEmail({ url, name: null }).text).toContain("Üdvözlünk!");
  });

  it("tells the reader the link is good for an hour, which is the token TTL", () => {
    expect(PASSWORD_RESET_TOKEN_TTL_SECONDS).toBe(3600);
    expect(buildPasswordResetEmail({ url }).text).toContain("1 óráig");
  });
});
