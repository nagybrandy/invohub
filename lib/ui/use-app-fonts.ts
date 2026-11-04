// lib/ui/use-app-fonts.ts
// Web: Stack Sans is declared with @font-face in global.css (self-hosted
// variable woff2), so there is nothing to load and nothing to wait for.
// Native: lib/ui/use-app-fonts.native.ts loads the static cuts.
export function useAppFonts(): boolean {
  return true;
}
