/**
 * Deterministic, effectful Git-tree source selector for the original FARS
 * lifecycle reader. Git blob identity proves repository provenance; the
 * emitted SHA-256 pins are subsequently rechecked by FARS before Cell creation.
 * This makes no merge, Work, deployment or usage claim.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { extname, resolve } from "node:path";
import { exactSourceRevision, MAX_BATCH_BYTES, MAX_SOURCE_BYTES, REPOSITORY_TEXT_EXTENSIONS } from "../provider/exact-source-revision.mjs";

const SAFE_NAME = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\0]+$/u;
const MAX_GIT_TREE_BYTES = 64 * MAX_SOURCE_BYTES;
function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "buffer", maxBuffer: MAX_GIT_TREE_BYTES, timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Generate the original [{path,digest}] input, with no unpinned or partial results. */
export function gitTrackedLifecyclePins({ root, prefixes = [] }) {
  if (typeof root !== "string" || !root.trim()) throw new TypeError("Git source root is required");
  if (!Array.isArray(prefixes) || prefixes.some(p => typeof p !== "string" || !p.trim() ||
      !SAFE_NAME.test(p) || p.startsWith("./") || p.endsWith("/")))
    throw new TypeError("Git source scope must contain normalized relative path prefixes");
  const sourceRoot = realpathSync(root);
  const gitRoot = realpathSync(git(sourceRoot, "rev-parse", "--show-toplevel").toString("utf8").trim());
  if (sourceRoot !== gitRoot) throw new TypeError("Git source root must be the original repository root");
  const commit = git(sourceRoot, "rev-parse", "--verify", "HEAD^{commit}").toString("ascii").trim();
  const format = git(sourceRoot, "rev-parse", "--show-object-format").toString("ascii").trim();
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(commit) || !["sha1", "sha256"].includes(format))
    throw new TypeError("Git source must identify an immutable SHA-1 or SHA-256 commit");
  const tree = git(sourceRoot, "ls-tree", "-r", "-z", "--full-tree", commit);
  const selections = [];
  let total = 0, jsonCount = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let start = 0; start < tree.length;) {
    const end = tree.indexOf(0, start);
    if (end < 0) throw new TypeError("Git tree record has no NUL delimiter");
    const entry = tree.subarray(start, end);
    start = end + 1;
    const tab = entry.indexOf(9);
    if (tab < 0) throw new TypeError("Git tree record has no path delimiter");
    const spec = entry.subarray(0, tab).toString("ascii");
    const sourcePath = decoder.decode(entry.subarray(tab + 1));
    const match = /^(\d{6}) (blob|commit) ([0-9a-f]{40}|[0-9a-f]{64})$/u.exec(spec);
    if (!match) throw new TypeError("Git source tree contains an invalid file identity");
    if (!REPOSITORY_TEXT_EXTENSIONS.includes(extname(sourcePath))) continue;
    if (prefixes.length && !prefixes.some(p => sourcePath === p || sourcePath.startsWith(p + "/"))) continue;
    if (!SAFE_NAME.test(sourcePath) || sourcePath.split("/").some(p => [".git", "node_modules", ".env"].includes(p)))
      throw new TypeError("Git source tree includes a selected unsafe path");
    if (!["100644", "100755"].includes(match[1]) || match[2] !== "blob")
      throw new TypeError(`Git source refuses symlink or non-file: ${sourcePath}`);
    const full = resolve(sourceRoot, sourcePath);
    if (realpathSync(full) !== full || !lstatSync(full).isFile())
      throw new TypeError(`Git source moved or changed selected file: ${sourcePath}`);
    const bytes = readFileSync(full);
    if (bytes.length > MAX_SOURCE_BYTES)
      throw new RangeError(`Git source exceeds source byte limit: ${sourcePath}`);
    total += bytes.length;
    if (total > MAX_BATCH_BYTES || selections.length >= 4096)
      throw new RangeError("Git source exceeds bounded lifecycle selection");
    const preimage = Buffer.from("blob " + bytes.length + String.fromCharCode(0), "utf8");
    const actualGitBlob = createHash(format).update(preimage).update(bytes).digest("hex");
    if (actualGitBlob !== match[3])
      throw new TypeError(`Git source differs from immutable HEAD: ${sourcePath}`);
    selections.push(Object.freeze({ path: sourcePath, digest: exactSourceRevision(bytes) }));
    if (sourcePath.endsWith(".json")) jsonCount++;
  }
  if (jsonCount === 0) throw new TypeError("Git source scope has no tracked JSON resources");
  if (git(sourceRoot, "rev-parse", "--verify", "HEAD^{commit}").toString("ascii").trim() !== commit)
    throw new TypeError("Git source HEAD changed during source selection");
  return Object.freeze(selections.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
