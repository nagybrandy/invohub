// scripts/lib/alias-loader.mjs
// Node ESM loader hook: resolves the app's "@/..." tsconfig path alias to
// the project root, so owner-run scripts (nav-check.mjs, m2m-check.mjs) can
// import lib/ modules directly with plain `node`, matching what Metro/webpack
// already do for the app itself. Node 20.6+ (module.register) or 22.x+
// native TS type-stripping is required — this repo pins engines.node = 22.x.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const projectRoot = new URL("../../", import.meta.url);
    let mapped = new URL(specifier.slice(2), projectRoot).href;
    if (!/\.[a-zA-Z0-9]+$/.test(mapped)) mapped += ".ts";
    return nextResolve(mapped, context);
  }
  return nextResolve(specifier, context);
}
