/**
 * Resolve paths relative to the monorepo root, NOT the current working directory.
 *
 * `npm run --workspace <pkg>` executes with CWD set to the workspace directory,
 * so a CWD-relative store path would differ between the oracle server (CWD =
 * oracle-agent/) and root-level scripts. Anchoring to the repo root keeps every
 * process reading/writing the same shared store.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

let cached: string | undefined;

/** Walk up from `start` until the root package.json (the one with workspaces). */
export function findRepoRoot(start: string = process.cwd()): string {
  if (cached) return cached;
  let dir = resolve(start);
  for (let i = 0; i < 8; i++) {
    const pkg = resolve(dir, "package.json");
    if (existsSync(pkg)) {
      try {
        const json = JSON.parse(readFileSync(pkg, "utf8"));
        if (Array.isArray(json.workspaces) || json.name === "verity") {
          cached = dir;
          return dir;
        }
      } catch {
        /* keep walking */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: cwd (best effort).
  cached = resolve(start);
  return cached;
}

/**
 * Resolve a path that is either absolute (returned as-is) or relative to the
 * repo root. Use for shared on-disk artifacts (signal store, loop log).
 */
export function fromRepoRoot(relativeOrAbsolute: string): string {
  if (resolve(relativeOrAbsolute) === relativeOrAbsolute) return relativeOrAbsolute; // already absolute
  return resolve(findRepoRoot(), relativeOrAbsolute);
}
