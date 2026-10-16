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
    // Каталоги Prisma-скиллов для ИИ-агентов: их наполняет `prisma skills sync`
    // (`postinstall`), файлы не являются кодом проекта.
    ".agents/skills/**",
    ".claude/skills/**",
    ".cursor/skills/**",
    ".devin/skills/**",
    // Сгенерированные артефакты Prisma 8 (`prisma contract emit`): типы контракта
    // и их снимки в хранилище миграций. Вручную не редактируются.
    "prisma/contract.d.ts",
    "prisma/migrations/snapshots/**",
  ]),
]);

export default eslintConfig;
