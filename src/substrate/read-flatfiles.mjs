import { readFile, stat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { walkPosixPaths } from "@red-cup-engineering/computer-filepath-engineering-services-section/walk-posix-paths";
import { DEFAULT_EXCLUDES } from "./store.mjs";
import { FrontmatterError, makeFlatfile, parseFrontmatter } from "./flatfile.mjs";

function singularize(s) {
  return s.length > 1 && s.endsWith("s") ? s.slice(0, -1) : s;
}

// A note's slug is the file stem, except for sentinel filenames whose stem
// is the same in every directory: "_index.md" (section index) and
// "SKILL.md" (per-skill marker) — those take "<parent>-<stem>" so each
// occurrence gets a unique, path-derived slug.
function deriveSlug(fileName, parentName) {
  if (fileName === "_index.md") return `${parentName}-index`;
  if (fileName === "SKILL.md") return `${parentName}-skill`;
  return fileName.slice(0, -3);
}

function deriveKind(fm, parentName) {
  return fm.kind ? String(fm.kind) : singularize(parentName);
}

// Walks root with path-walking-service's walkPosixPaths for deterministic
// discovery, reads every ".md" file, and parses each with frontmatter into
// a Flatfile. Files without a frontmatter block are silently skipped — that
// is a non-note markdown file, not an error. A file whose frontmatter block
// exists but fails to parse is reported as a diagnostic and skipped. The
// pure edge-building over the notes this reads lives in store.mjs's
// buildEdges; this module is only the disk read that feeds it.
export async function loadFlatfiles(root, { excludes = DEFAULT_EXCLUDES, maxDepth, includeFile,
  maxSourceBytes, maxBatchBytes, allowPlain = false } = {}) {
  for (const [key, value] of [["maxSourceBytes", maxSourceBytes], ["maxBatchBytes", maxBatchBytes]]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1))
      throw new TypeError(`flatfile ${key} must be a positive safe integer`);
  }
  const strict = maxSourceBytes !== undefined || maxBatchBytes !== undefined;
  if (typeof allowPlain !== "boolean" || (allowPlain && !strict))
    throw new TypeError("plain Markdown admission requires an explicit bounded source read");
  const observedRoot = strict ? await realpath(root) : root;
  const walk = await walkPosixPaths({ root: observedRoot, excludes, maxDepth, includeFile });
  const notes = [];
  const diagnostics = [];
  let batchBytes = 0;
  for (const entry of walk.files) {
    if (entry.kind !== "file" || !entry.path.endsWith(".md")) continue;
    const absolutePath = join(observedRoot, entry.path);
    let text, revision, prior;
    try {
      if (strict) {
        if (await realpath(absolutePath) !== absolutePath)
          throw new TypeError(`pinned Markdown source leaves its canonical file path: ${entry.path}`);
        prior = await stat(absolutePath);
        if (!prior.isFile() || (maxSourceBytes !== undefined && prior.size > maxSourceBytes))
          throw new RangeError(`pinned Markdown source exceeds its file bound: ${entry.path}`);
        if (maxBatchBytes !== undefined && batchBytes + prior.size > maxBatchBytes)
          throw new RangeError("pinned Markdown source batch exceeds its bounded observation budget");
      }
      const bytes = await readFile(absolutePath);
      if (strict && (bytes.length !== prior.size ||
          (maxSourceBytes !== undefined && bytes.length > maxSourceBytes)))
        throw new TypeError(`pinned Markdown source changed while reading: ${entry.path}`);
      text = strict ? new TextDecoder("utf-8", { fatal: true }).decode(bytes) : bytes.toString("utf8");
      revision = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
      batchBytes += bytes.length;
    } catch (err) {
      if (strict) throw err;
      diagnostics.push({ code: "file-read-error", path: entry.path, message: err.message });
      continue;
    }
    let fm;
    let body;
    try {
      ({ fm, body } = parseFrontmatter(text));
    } catch (err) {
      if (!(err instanceof FrontmatterError)) throw err;
      diagnostics.push({ code: "frontmatter-parse", path: entry.path, message: err.message });
      continue;
    }
    if (fm === null && !allowPlain) continue;
    // A pinned plain document carries exact bytes and body, not inferred
    // governance frontmatter or an office kind from its parent directory.
    const unstructured = fm === null;
    if (unstructured) fm = {};
    const segments = entry.path.split("/");
    const fileName = segments.at(-1);
    const parentName = segments.length >= 2 ? segments.at(-2) : "";
    const after = await stat(absolutePath);
    if (strict && (after.size !== prior.size || after.mtimeMs !== prior.mtimeMs))
      throw new TypeError(`pinned Markdown source changed during observation: ${entry.path}`);
    const mtime = after.mtimeMs / 1000;
    notes.push(makeFlatfile({
      slug: deriveSlug(fileName, parentName),
      dir: parentName,
      kind: unstructured ? "flatfile" : deriveKind(fm, parentName),
      fm,
      body,
      path: entry.path,
      mtime, revision,
    }));
  }
  return { notes, diagnostics };
}
