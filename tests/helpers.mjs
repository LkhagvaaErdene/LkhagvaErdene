// The app's package.json is "commonjs"; browser ES modules are copied to a temp dir typed as ESM for Node tests.
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT = root;
export async function loadFn(file) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "esm-"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
  fs.cpSync(path.join(root, "src/js"), path.join(dir, "js"), { recursive: true });
  return import(pathToFileURL(path.join(dir, "js", file)).href);
}
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
