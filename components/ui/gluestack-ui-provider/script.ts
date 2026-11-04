// components/ui/gluestack-ui-provider/script.ts
// Applies a theme preference to <html> (web). Serialised with
// `script.toString()` and run inline before hydration, so it must stay fully
// self-contained: no imports, no references to module scope.
//
//   "light"  -> data-theme="light", class "light", color-scheme: light
//   "dark"   -> data-theme="dark",  class "dark",  color-scheme: dark
//   "system" -> data-theme removed; the class follows prefers-color-scheme so
//               the CSS @media block (see lib/theme/theme-css.ts) and
//               NativeWind `dark:` variants agree.
export const script = (mode: string) => {
  const documentElement = document.documentElement;

  function getSystemColorMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  try {
    const isSystem = mode !== 'light' && mode !== 'dark';
    const theme = isSystem ? getSystemColorMode() : mode;
    if (isSystem) {
      documentElement.removeAttribute('data-theme');
    } else {
      documentElement.setAttribute('data-theme', theme);
    }
    documentElement.classList.remove(theme === 'light' ? 'dark' : 'light');
    documentElement.classList.add(theme);
    documentElement.style.colorScheme = theme;
  } catch (e) {
    console.error(e);
  }
};

/** localStorage mirror of the stored preference, readable before hydration. */
export const THEME_MIRROR_KEY = 'invohub.theme-preference';

/** Source of the inline pre-hydration script: the stored choice wins over `mode`. */
export function buildThemeBootScript(mode: string): string {
  return `(function(){var m=${JSON.stringify(mode)};try{var s=window.localStorage.getItem(${JSON.stringify(
    THEME_MIRROR_KEY
  )});if(s==='light'||s==='dark'||s==='system'){m=s;}}catch(e){}(${script.toString()})(m);})()`;
}
