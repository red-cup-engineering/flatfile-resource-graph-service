import { defineProvider } from "../provider/provider.mjs";
import { makeCell } from "../kernel/cells.mjs";
import { buildEdges, DEFAULT_EXCLUDES } from "../substrate/store.mjs";
import { loadFlatfiles } from "../substrate/read-flatfiles.mjs";
import { RELATION_KEYS } from "../convention.mjs";
import { projectAttributeCells } from "../provider/attribute-projection.mjs";
import { sourceNamespace } from "../provider/source-namespace.mjs";
import { sourceSelections } from "../provider/source-selections.mjs";
import { identity } from "../kernel/identity.mjs";

/**
 * A source-qualified focus is the stable path of one record within one owner.
 * Its revision-scoped resource names the exact Markdown bytes observed.
 * Neither identity grants any office appointment, sovereignty, or work power.
 */
const qualifiedFocus = (owner, path) =>
  `urn:fars:source-markdown:${encodeURIComponent(owner)}:${encodeURIComponent(path)}`;

/**
 * Observe a flatfile corpus through the existing FARS provider/cell law.
 * A supplied namespace enables cross-colony source isolation; legacy unscoped
 * callers keep their original coordinates until their consumer is migrated.
 */
export function markdownDirectoryProvider({
  id, root, excludes, maxDepth, includeFile, sources = ["fm", "body"],
  relationKeys = RELATION_KEYS, namespace, pins,
}) {
  const owner = namespace === undefined ? undefined : sourceNamespace(namespace);
  const selected = pins === undefined ? undefined : sourceSelections(pins, { extension: ".md" });
  if (selected !== undefined && owner === undefined) throw new TypeError("pinned Markdown sources require a qualified source-owner namespace");
  if (selected !== undefined && includeFile !== undefined && typeof includeFile !== "function") throw new TypeError("pinned Markdown includeFile must be a function");
  const pinByPath = new Map(selected?.map(({ path, digest }) => [path, digest]) ?? []);
  return defineProvider({ id, async observe({ observedAt = new Date().toISOString() } = {}) {
    const include = selected === undefined ? includeFile : input => pinByPath.has(input.path) && (includeFile === undefined || includeFile(input));
    const { notes, diagnostics } = await loadFlatfiles(root, { excludes, maxDepth, includeFile: include });
    if (selected !== undefined) {
      // Missing, unparsed and changed records are not a successful partial corpus.
      if (notes.length !== selected.length || notes.some(note => pinByPath.get(note.path) !== note.revision))
        throw new TypeError("pinned Markdown source missing or changed; exact owner revision required");
    }
    const edges = owner === undefined ? buildEdges(notes, { sources, relationKeys }) : [];
    const edgesBySource = owner === undefined ? Map.groupBy(edges, (edge) => edge.src) : new Map();
    const notesBySlug = new Map();
    if (owner !== undefined) {
      for (const note of notes) {
        const matches = notesBySlug.get(note.slug) ?? [];
        matches.push(note);
        notesBySlug.set(note.slug, matches);
      }
    }
    const resources = notes.map((note) => {
      const focus = owner === undefined ? note.slug : qualifiedFocus(owner, note.path);
      if (owner !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(note.revision ?? "")) {
        throw new TypeError(`qualified Markdown observation lacks exact source revision: ${note.path}`);
      }
      const resource = owner === undefined
        ? `urn:fars:flatfile:${encodeURIComponent(note.path)}`
        : `${focus}:${note.revision}`;
      const resourceDiagnostics = [];
      // One note's links belong to that note even when another directory
      // contains a file with the same slug. Resolve targets only when unique
      // in this owner's corpus; ambiguous/absent references remain diagnostics,
      // never edges granting a false shared referent.
      const related = owner === undefined
        ? (edgesBySource.get(note.slug) ?? []).map((edge) => makeCell({
            subject: edge.src, predicate: edge.kind, object: edge.dst,
          }))
        : buildEdges([note], { sources, relationKeys }).flatMap((edge) => {
            const matches = notesBySlug.get(edge.dst) ?? [];
            if (matches.length !== 1) {
              resourceDiagnostics.push(Object.freeze({
                code: matches.length === 0 ? "unresolved-markdown-target" : "ambiguous-markdown-target",
                path: note.path, target: edge.dst,
              }));
              return [];
            }
            return [makeCell({
              subject: resource, predicate: edge.kind,
              object: qualifiedFocus(owner, matches[0].path),
            })];
          });
      const cells = [
        makeCell({ subject: resource, predicate: "urn:fars:type", object: "urn:fars:type:markdown-flatfile" }),
        makeCell({ subject: resource, predicate: "urn:fars:path", object: note.path }),
        makeCell({ subject: resource, predicate: "urn:fars:slug", object: note.slug }),
        ...(owner === undefined ? [] : [
          makeCell({ subject: resource, predicate: "urn:fars:source-namespace", object: owner }),
          makeCell({ subject: resource, predicate: "urn:fars:source-revision", object: note.revision }),
        ]),
        // The original exact bytes identify the observed documentary revision.
        // The separate semantic body-content NI preserves the prior body law.
        makeCell({ subject: resource, predicate: "urn:fars:body-content-id", object: identity({ kind: "fars.markdown-body.v1", body: note.body }) }),
        ...projectAttributeCells({
          subject: owner === undefined ? note.slug : resource,
          resource,
          attributes: note.fm,
        }),
        ...related,
      ];
      return Object.freeze({
        resource, focus, observedAt,
        cells: Object.freeze(cells),
        diagnostics: Object.freeze(resourceDiagnostics),
      });
    });
    return Object.freeze({ resources: Object.freeze(resources), diagnostics: Object.freeze(diagnostics) });
  } });
}

/** Observe one explicitly named root Markdown file through the same provider. */
export function markdownRootFileProvider({ id, root, basename, sources, relationKeys, namespace, pins }) {
  if (typeof basename !== "string" || basename.length === 0 ||
      basename === "." || basename === ".." || /[\\/\u0000]/u.test(basename)) {
    throw new TypeError("basename must name one root file without path separators");
  }
  return markdownDirectoryProvider({
    id, root, sources, relationKeys, namespace, pins,
    excludes: DEFAULT_EXCLUDES.filter((name) => name !== basename),
    maxDepth: 0,
    includeFile: ({ path }) => path === basename,
  });
}
