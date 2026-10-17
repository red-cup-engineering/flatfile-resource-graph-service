/**
 * A source-owner identifier for a flatfile provider. This names custody of
 * observed bytes, not the holder of institutional authority over their claims.
 * The same grammar is used by JSON and Markdown source providers.
 */
export function sourceNamespace(value) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError("a source-owned namespace is required");
  let uri;
  try { uri = new URL(value); }
  catch { throw new TypeError("source namespace must be a qualified absolute URI"); }
  if (!["https:", "urn:"].includes(uri.protocol) || uri.username || uri.password || uri.search || uri.hash) {
    throw new TypeError("source namespace must be an HTTPS or URN identifier without credentials, query or fragment");
  }
  return value;
}
