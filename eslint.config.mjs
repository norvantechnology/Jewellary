import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const RAW_HEX_PATTERN = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const FORBIDDEN_COLOR_CLASS_PATTERN =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|accent|caret|decoration|outline)-(?:blue|indigo|violet|purple|sky|cyan|fuchsia)-\d{2,3}\b/;

const designTokensPlugin = {
  rules: {
    "no-raw-hex": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow raw hex color literals in UI components; use semantic CSS tokens.",
        },
        schema: [],
      },
      create(context) {
        function checkText(node, raw) {
          if (typeof raw !== "string") return;
          if (RAW_HEX_PATTERN.test(raw)) {
            context.report({
              node,
              message:
                "Raw hex color literal detected. Use semantic design tokens from theme.css instead.",
            });
          }
          if (FORBIDDEN_COLOR_CLASS_PATTERN.test(raw)) {
            context.report({
              node,
              message:
                "Blue/purple color utility detected. Only champagne, ivory, beige, gold, bronze, charcoal, and warm status tokens are allowed.",
            });
          }
        }
        return {
          Literal(node) {
            if (typeof node.value === "string") {
              checkText(node, node.value);
            }
          },
          TemplateElement(node) {
            checkText(node, node.value.raw);
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "test-results/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/label-has-associated-control": "error",
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}", "src/modules/**/*.{ts,tsx}"],
    ignores: [
      "src/app/**/opengraph-image.tsx",
      "src/app/manifest.ts",
      "src/app/layout.tsx",
      "src/styles/**",
    ],
    plugins: {
      "design-tokens": designTokensPlugin,
    },
    rules: {
      "design-tokens/no-raw-hex": "error",
    },
  },
]);

export default eslintConfig;
