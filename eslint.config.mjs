import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const isCI = process.env.CI === "true";

if (isCI) {
  process.env.BROWSERSLIST_IGNORE_OLD_DATA = "true";
  console.warn(
    "[eslint] CI detected; baseline-browser-mapping data staleness will surface as warnings instead of build failures."
  );
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
