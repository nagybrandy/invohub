// lib/auth-reset-email.ts
// The password-reset mail Better Auth asks us to send (emailAndPassword.
// sendResetPassword in lib/auth.ts). Pure: no I/O, so the copy and the link
// handling are unit-tested without an SMTP server.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60;

export function buildPasswordResetEmail(input: { url: string; name?: string | null }): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = input.name?.trim() ? `Kedves ${input.name.trim()}!` : "Üdvözlünk!";
  const subject = "InvoHub – új jelszó beállítása";
  const text = [
    greeting,
    "",
    "Valaki új jelszót kért az InvoHub-fiókodhoz. Ha te voltál, az alábbi linken állíthatsz be újat (1 óráig érvényes):",
    input.url,
    "",
    "Ha nem te kérted, nincs teendőd — a jelszavad nem változik.",
    "",
    "InvoHub",
  ].join("\n");
  const html = `<p>${escapeHtml(greeting)}</p>
<p>Valaki új jelszót kért az InvoHub-fiókodhoz. Ha te voltál, az alábbi gombbal állíthatsz be újat (1 óráig érvényes):</p>
<p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px">Új jelszó beállítása</a></p>
<p style="color:#6b7280;font-size:13px">Ha a gomb nem működik, másold a böngészőbe: ${escapeHtml(input.url)}</p>
<p>Ha nem te kérted, nincs teendőd — a jelszavad nem változik.</p>
<p>InvoHub</p>`;
  return { subject, html, text };
}
