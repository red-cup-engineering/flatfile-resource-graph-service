import { admitRelativePosixFilepath } from "@red-cup-engineering/computer-filepath-engineering-services-section/admit-relative-posix-filepath";

/** One source-owned exact-byte selector for FARS JSON and Markdown providers.
 * No claim, workplace, incumbent, or real-world authority follows from a pin.
 */
export function sourceSelections(sources, { extension = ".json" } = {}) {
  if (extension !== ".json" && extension !== ".md")
    throw new TypeError("FARS source selection requires a supported file extension");
  const type = extension === ".json" ? "JSON" : "Markdown";
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 4096)
    throw new TypeError(`select from 1 to 4096 source-pinned ${type} records`);
  const admitted = sources.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        Object.keys(item).some(key => !["path", "digest"].includes(key)))
      throw new TypeError("every source requires only path and digest");
    const path = admitRelativePosixFilepath(item.path);
    if (!path.endsWith(extension) || path.split("/").some(part =>
        ["..", ".git", "node_modules", ".env"].includes(part))) {
      throw new TypeError(`selected sources must be normalized ${type} records, not runtime or credential paths`);
    }
    if (typeof item.digest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.digest))
      throw new TypeError("every source must carry its owner's exact SHA-256 digest");
    return Object.freeze({ path, digest: item.digest });
  });
  if (new Set(admitted.map(source => source.path)).size !== admitted.length)
    throw new TypeError(`duplicate ${type} source path`);
  return Object.freeze([...admitted].sort((a, b) => a.path.localeCompare(b.path)));
}
