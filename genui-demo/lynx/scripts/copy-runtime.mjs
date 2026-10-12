import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDir = dirname(require.resolve("@lynx-js/web-core/package.json"));
const target = fileURLToPath(
  new URL("../../public/lynx/runtime/", import.meta.url),
);
await mkdir(target, { recursive: true });
await cp(join(packageDir, "dist/client_prod"), target, { recursive: true });
