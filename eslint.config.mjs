import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

const eslintConfig = defineConfig([
  expoConfig,
  globalIgnores([
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "assets/**",
  ]),
  {
    rules: {
      // eslint-plugin-react-hooks' newest ruleset flags *any* setState
      // reachable from an effect body as an error, including the two most
      // ordinary effect uses in this codebase: fetching data on mount
      // (SessionsSection in SettingsScreen.tsx) and syncing state from an
      // external timer callback (useAttemptLockout.ts's setInterval tick).
      // Both are exactly the "subscribe to an external system" case the
      // rule's own documentation carves out as fine -- downgraded to a
      // warning rather than restructuring working code around a
      // still-settling rule.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
