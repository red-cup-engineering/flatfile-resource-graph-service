import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { admitRelativePosixFilepath } from "@red-cup-engineering/computer-filepath-engineering-services-section/admit-relative-posix-filepath";
import { retainedCarrier } from "@red-cup-engineering/signcell/cell";

export const MAX_SOURCE_BYTES = 1_048_576;
export const MAX_SOURCE_COUNT = 4096;
export const MAX_BATCH_BYTES = 16 * MAX_SOURCE_BYTES;
export const REPOSITORY_TEXT_EXTENSIONS = Object.freeze([".json", ".mjs", ".cjs", ".js", ".ts", ".mts", ".md", ".yaml", ".yml"]);

export function admitSourceSelections(sources, extensions = [".json"]) {
  const selected = retainedCarrier(sources);
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > MAX_SOURCE_COUNT)
    throw new TypeError("select from 1 to 4096 source-pinned records");
  const allowed = new Set(extensions);
  const rows = selected.map(item => {
    if (item === null || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).sort().join() !== "digest,path")
      throw new TypeError("every source requires only path and digest");
    const path = admitRelativePosixFilepath(item.path);
    if (!allowed.has(extname(path)) || path.split("/").some(part =>
      ["..", ".git", "node_modules", ".env"].includes(part)))
      throw new TypeError("selected sources must be normalized admitted records, not runtime or credential paths");
    if (typeof item.digest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.digest))
      throw new TypeError("every source must carry its owner's exact SHA-256 digest");
    return Object.freeze({ path, digest: item.digest });
  });
  if (new Set(rows.map(row => row.path)).size !== rows.length)
    throw new TypeError("duplicate JSON source path");
  return Object.freeze(rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** One original pinned-file admission, shared by JSON and lifecycle readers. */
export async function readPinnedTextSources({ root, sources, extensions = [".json"] }) {
  if (typeof root !== "string" || !root.trim()) throw new TypeError("source root is required");
  const selected = admitSourceSelections(sources, extensions);
  const sourceRoot = await realpath(root), records = [];
  let total = 0;
  for (const { path, digest } of selected) {
    const file = resolve(sourceRoot, path);
    if (await realpath(file) !== file) throw new TypeError(`JSON source changes its selected path: ${path}`);
    const entry = await lstat(file);
    if (!entry.isFile() || entry.size > MAX_SOURCE_BYTES)
      throw new TypeError(`JSON source is not a bounded regular file: ${path}`);
    if (total + entry.size > MAX_BATCH_BYTES)
      throw new RangeError("JSON source batch exceeds its 16 MiB bounded observation budget");
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes;
    try {
      const before = await handle.stat();
      if (before.dev !== entry.dev || before.ino !== entry.ino || before.size !== entry.size)
        throw new TypeError(`JSON source changed during observation: ${path}`);
      // Read at most the admitted length plus one byte even if the file grows.
      const buffer = Buffer.alloc(before.size + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const read = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (read.bytesRead === 0) break;
        offset += read.bytesRead;
      }
      bytes = buffer.subarray(0, offset);
      const after = await handle.stat(), current = await lstat(file);
      if (bytes.length !== before.size || before.size !== after.size ||
          before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs ||
          current.dev !== before.dev || current.ino !== before.ino || await realpath(file) !== file)
        throw new TypeError(`JSON source changed or exceeded its byte limit during observation: ${path}`);
    } finally { await handle.close(); }
    total += bytes.length;
    const revision = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (revision !== digest) throw new TypeError(`JSON source digest changed or is not owner-qualified: ${path}`);
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new TypeError(`JSON source is not an admitted UTF-8 JSON value: ${path}`); }
    records.push(Object.freeze({ path, revision, text }));
  }
  return Object.freeze(records);
}
