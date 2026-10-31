import { admitSourceSelections as sourceSelections, readPinnedTextSources } from "./pinned-sources.mjs";
import { cell } from "@red-cup-engineering/signcell/cell";
import { parseJsonValue } from "@red-cup-engineering/json-services-section/parse-json-value";
import { makeCell } from "../kernel/cells.mjs";
import { projectAttributeCells } from "../provider/attribute-projection.mjs";
import { defineProvider } from "../provider/provider.mjs";
import { sourceNamespace } from "../provider/source-namespace.mjs";

/**
 * Select existing JSON source records from a source-owned catalog. This is a
 * pure projection of the catalog's own canonicalPath and SHA-256 pins; it
 * creates no shadow catalog, authority, or synthetic work record.
 *
 * Group names are exact, explicit selections (e.g. a professional repertoire's
 * offices, duties, works). Skill directories and executable scripts are not
 * JSON records and must use their distinct source-qualified provider.
 * The caller remains responsible for authenticating the catalog itself and
 * for the right to read every selected source. Nothing here confers appointment.
 */
export function selectCatalogJsonSources(catalog, groups) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
      !Array.isArray(groups) || groups.length < 1 || groups.length > 128 ||
      new Set(groups).size !== groups.length) {
    throw new TypeError("catalog selection requires unique explicit source groups");
  }
  const selections = [];
  for (const group of groups) {
    if (typeof group !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(group) ||
        !Object.hasOwn(catalog, group) || !Array.isArray(catalog[group])) {
      throw new TypeError("requested catalog group does not contain source records");
    }
    for (const entry of catalog[group]) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
          typeof entry.id !== "string" || !entry.id.trim() ||
          typeof entry.canonicalPath !== "string") {
        throw new TypeError("catalog entries must identify source-owned JSON files");
      }
      selections.push({ path: entry.canonicalPath, digest: entry.digest });
    }
  }
  return sourceSelections(selections);
}

/**
 * Consume Organizing's native one-shot seat-brief source pins without minting
 * a separate office registry. This is a documentary acquisition plan, NOT
 * an incumbency, source-root credential, complete-corpus claim or grant.
 *
 * A source pin needs the authenticated owner namespace/root at the actual
 * jsonSourcesProvider call. Historical and malformed selections cannot
 * silently become claims that a duty or office has no source.
 */
export function selectSeatBriefJsonSources(brief) {
  if (brief?.kind !== "organizing.enterprise.seat-brief" ||
      !Array.isArray(brief.seats) || brief.seats.length === 0) {
    throw new TypeError("an Organizing seat brief with held office readings is required");
  }
  const selected = new Map();
  const unresolved = [];
  let omitted = 0;
  const receive = (pin, office, group, id) => {
    if (pin === null) {
      unresolved.push(Object.freeze({ office, group, id, reason: "no-source-pin" }));
      return;
    }
    if (!pin || typeof pin !== "object" || Array.isArray(pin)
      || typeof pin.path !== "string" || typeof pin.digest !== "string") {
      throw new TypeError("seat brief source pin is malformed");
    }
    if (!pin.path.endsWith(".json")) {
      unresolved.push(Object.freeze({ office, group, id, path: pin.path,
        reason: "requires-appropriate-non-json-provider" }));
      return;
    }
    const prior = selected.get(pin.path);
    if (prior !== undefined && prior !== pin.digest) {
      throw new TypeError("one agency path is pinned to conflicting source revisions");
    }
    selected.set(pin.path, pin.digest);
  };
  for (const seat of brief.seats) {
    if (typeof seat?.office !== "string" || !seat.office
      || !seat.sourceRecords || typeof seat.sourceRecords !== "object") {
      throw new TypeError("seat brief does not carry the source-owning office contract");
    }
    receive(seat.source, seat.office, "offices", seat.office);
    for (const group of ["duties", "skills", "works"]) {
      const data = seat.sourceRecords[group];
      if (!data || !Array.isArray(data.records) ||
          !Number.isSafeInteger(data.omitted) || data.omitted < 0) {
        throw new TypeError("seat brief source family is missing or unbounded");
      }
      omitted += data.omitted;
      for (const entry of data.records) {
        if (typeof entry?.id !== "string" || !entry.id ||
            !Object.hasOwn(entry, "source")) throw new TypeError("seat brief source entry is malformed");
        receive(entry.source, seat.office, group, entry.id);
      }
    }
  }
  const sources = selected.size === 0 ? Object.freeze([]) :
    sourceSelections([...selected].map(([path, digest]) => ({ path, digest })));
  return Object.freeze({
    kind: "fars.seat-brief-json-selection",
    sources, unresolved: Object.freeze(unresolved),
    omitted, complete: unresolved.length === 0 && omitted === 0,
  });
}

/**
 * Observe source-owned JSON records as documentary *content*, not as enterprise
 * authority, accepted work or OWL domain facts. Files are explicitly selected
 * by their lawful consumer. This adapter uses the existing FARS provider,
 * attribute witness, typed-JSON and NI infrastructure, not a second graph.
 *
 * Every selection requires its owning source's expected SHA-256 digest,
 * such as Coesite's existing professional-repertoire catalog declares.
 * File revisions are SHA-256 of exact bytes. Each resource and attribute
 * witness is version-scoped; a changed source cannot inherit old provenance
 * even if a particular field retained its text. The stable focus names the
 * logical source path in its owner's URI namespace. Source-digest admission
 * precedes JSON interpretation; an observation refuses atomically if any
 * selected source violates its per-file 1 MiB or batch-wide 16 MiB ceiling.
 */
export function jsonSourcesProvider({ id, root, namespace, sources }) {
  if (typeof root !== "string" || !root.trim()) throw new TypeError("JSON source root is required");
  const owner = sourceNamespace(namespace);
  const selected = sourceSelections(sources);
  return defineProvider({ id, async observe({ observedAt = new Date().toISOString() } = {}) {
    const resources = [];
    const acquired = await readPinnedTextSources({ root, sources: selected });
    for (const { path, revision, text } of acquired) {
      let record;
      try { record = parseJsonValue(text); }
      catch (error) { throw new TypeError(`JSON source is not an admitted UTF-8 JSON value: ${path}: ${error.message}`); }
      if (record === null || typeof record !== "object" || Array.isArray(record)) {
        throw new TypeError(`JSON source must declare an object record: ${path}`);
      }
      const focus = `urn:fars:source-json:${encodeURIComponent(owner)}:${encodeURIComponent(path)}`;
      const resource = `${focus}:${revision}`;
      const cells = [
        makeCell({ subject: resource, predicate: "urn:fars:type", object: "urn:fars:type:source-json" }),
        makeCell({ subject: resource, predicate: "urn:fars:source-namespace", object: owner }),
        makeCell({ subject: resource, predicate: "urn:fars:source-path", object: path }),
        makeCell({ subject: resource, predicate: "urn:fars:source-revision", object: revision }),
        ...projectAttributeCells({ subject: resource, resource, attributes: record }),
      ];
      resources.push(Object.freeze({ resource, focus, observedAt,
        cells: Object.freeze(cells.map(at => cell(at.subject, at.predicate, at.object, { for: [
          Object.freeze({ kind: "fars.source-json-observation/v1", sourceNamespace: owner,
            sourcePath: path, contentDigest: revision, observedAt }),
        ] }))), diagnostics: Object.freeze([]) }));
    }
    return Object.freeze({ resources: Object.freeze(resources), diagnostics: Object.freeze([]) });
  } });
}

