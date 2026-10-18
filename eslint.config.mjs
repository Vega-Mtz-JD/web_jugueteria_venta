import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Fuera de la app: skills de Claude Code, bocetos y reportes de pruebas.
    ".claude/**",
    ".superpowers/**",
    "docs/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
