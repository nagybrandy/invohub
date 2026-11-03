// lib/theme/theme-css.test.ts
// global.css must carry exactly the CSS that tokens.ts generates, so the two
// can never drift. Regenerate with: UPDATE_THEME_CSS=1 npx jest lib/theme/theme-css.test.ts
import fs from "node:fs";
import path from "node:path";
import {
  buildThemeCss,
  embedThemeCss,
  extractThemeCss,
  THEME_CSS_END,
  THEME_CSS_START,
} from "@/lib/theme/theme-css";

const GLOBAL_CSS = path.join(__dirname, "..", "..", "global.css");

describe("buildThemeCss", () => {
  const css = buildThemeCss();

  it("emits the four blocks in the documented selector shape", () => {
    expect(css).toContain(":root {");
    expect(css).toContain('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {');
    expect(css).toContain(':root[data-theme="dark"] {');
    expect(css).toContain(".dark {");
  });

  it("defines the design tokens as hex in light and dark", () => {
    const light = css.slice(0, css.indexOf("@media"));
    expect(light).toContain("--canvas: #F6F6F8;");
    expect(light).toContain("--navy: #131F4A;");
    const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
    expect(dark).toContain("--canvas: #0A0D12;");
    expect(dark).toContain("--surface: #171A20;");
  });

  it("keeps the Gluestack names as RGB triplets driven by the design tokens", () => {
    const light = css.slice(0, css.indexOf("@media"));
    expect(light).toContain("--background: 246 246 248;");
    expect(light).toContain("--primary: 63 107 196;");
    expect(light).toContain("--secondary: 19 31 74;");
    expect(light).toContain("--muted: 238 240 244;");
    expect(light).toContain("--muted-foreground: 91 93 97;");
    expect(light).toContain("--ok-rgb: 27 122 79;");
  });

  it("never emits a hex --primary or --muted that would shadow the triplet names", () => {
    expect(css).not.toMatch(/--primary: #/);
    expect(css).not.toMatch(/--muted: #/);
  });

  it("sets color-scheme per theme", () => {
    expect(css.match(/color-scheme: dark;/g)?.length).toBe(2);
    expect(css.match(/color-scheme: light;/g)?.length).toBe(1);
  });

  it("repeats the dark values in the media query, the explicit attribute and .dark", () => {
    expect(css.match(/--canvas: #0A0D12;/g)?.length).toBe(3);
  });
});

describe("global.css", () => {
  const source = fs.readFileSync(GLOBAL_CSS, "utf8");

  it("contains exactly the generated theme CSS between the markers", () => {
    if (process.env.UPDATE_THEME_CSS === "1") {
      fs.writeFileSync(GLOBAL_CSS, embedThemeCss(source));
    }
    const current = fs.readFileSync(GLOBAL_CSS, "utf8");
    expect(current).toContain(THEME_CSS_START);
    expect(current).toContain(THEME_CSS_END);
    expect(extractThemeCss(current)).toBe(buildThemeCss());
  });

  it("no longer references Ranade or fonts.googleapis.com", () => {
    expect(source).not.toMatch(/ranade/i);
    expect(source).not.toContain("fonts.googleapis.com");
  });

  it("declares both Stack Sans families as variable 200-700 with latin and latin-ext", () => {
    for (const family of ["Stack Sans Text", "Stack Sans Notch"]) {
      expect(source).toContain(`font-family: "${family}"`);
    }
    expect(source.match(/font-weight: 200 700;/g)?.length).toBe(4);
    expect(source).toContain("stack-sans-text-latin-ext-wght-normal.woff2");
    expect(source).toContain("stack-sans-notch-latin-wght-normal.woff2");
  });

  it("ships the self-hosted font files and the OFL licence", () => {
    for (const dir of ["public/fonts", "assets/fonts"]) {
      for (const file of [
        "stack-sans-text-latin-wght-normal.woff2",
        "stack-sans-text-latin-ext-wght-normal.woff2",
        "stack-sans-notch-latin-wght-normal.woff2",
        "stack-sans-notch-latin-ext-wght-normal.woff2",
        "OFL-StackSans.txt",
      ]) {
        expect(fs.existsSync(path.join(__dirname, "..", "..", dir, file))).toBe(true);
      }
    }
  });

  it("has a global focus ring and a reduced-motion rule", () => {
    expect(source).toContain(":focus-visible");
    expect(source).toContain("outline: 2px solid rgb(var(--primary))");
    expect(source).toContain("prefers-reduced-motion: reduce");
  });
});
