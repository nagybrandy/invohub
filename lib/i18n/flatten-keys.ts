// lib/i18n/flatten-keys.ts
// Flattens a translation tree to the dot paths i18next actually resolves
// (`invoices.actions.finalize`), so two locales can be compared key by key.
// Kept separate from the locale files themselves: it is test/tooling
// machinery, not something the app bundles a screen for.

export type TranslationTree = { [key: string]: string | TranslationTree };

/**
 * Maps every leaf's dot path to its string. Arrays are not used in these
 * locale files; an array would flatten by index, which is still comparable
 * between locales.
 */
export function flattenTranslationKeys(
  tree: TranslationTree,
  prefix = "",
  out: Map<string, string> = new Map()
): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      flattenTranslationKeys(value as TranslationTree, path, out);
    } else {
      out.set(path, value as string);
    }
  }
  return out;
}
