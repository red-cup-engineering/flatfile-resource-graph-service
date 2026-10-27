# flatfile-resource-graph-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Source-pinned JSON and flatfile EAVT resource graph with native CLI, provider observations, and closure rules for cycles, orphans, broken links and stubs.

## Receive JSON resources and their lifecycle

`source-json-lifecycle` reads an explicitly selected repository snapshot and
returns native SignCells through the existing provider/compositor. Select JSON
documents together with the source files that may refer to them. Each selection
must name a relative path and the SHA-256 digest of its exact bytes:

```json
[
  { "path": "data/observation.json", "digest": "sha256:<64 lowercase hex digits>" },
  { "path": "schemas/observation.json", "digest": "sha256:<64 lowercase hex digits>" },
  { "path": "src/reader.mjs", "digest": "sha256:<64 lowercase hex digits>" }
]
```

Pass that array on standard input:

```sh
flatfile-resource-graph source-json-lifecycle /absolute/repository/root \
  https://github.com/owner/repository 2026-10-27T00:00:00.000Z < source-pins.json
```

Use the actual acquisition time and the source owner's namespace. The reader
refuses stale digests, symlinks, traversal, non-UTF-8 content and oversized lots.
It admits up to 4096 selected files, 1 MiB per file and 16 MiB in total; structural
and Cell budgets also bound the resulting observation. The original
`source-json` command retains its object-only interface. This lifecycle command
also accepts JSON arrays and scalar values.

The report preserves each resource's source path, revision, scope, properties,
schema receiving result and unresolved actions. Its `cells` are accepted by
SignCraft's `KnowledgeBase.fromCells`; positive evidence, opposition and unknown
claims retain their original meanings through composition.

An explicit `$schema` association is validated by SignCell against the uniquely
identified JSON Schema 2020-12 document in the selected snapshot. Property titles,
descriptions and exact schema pointers supply meaning without changing standard
keys such as `id`. Missing or conflicting definitions remain visible.

Connection classifications describe the selected snapshot:

- `declared-connected`: expanded PROV-O `used` or `wasGeneratedBy` declarations
  name the resource's stable `focus` URI. They record declared intent.
- `referenced`: another selected source contains the resource's exact path. A
  text mention alone does not establish an executing reader or writer.
- `unclaimed-in-snapshot`: neither form of connection was observed in this lot.
  This is a receiving action, not proof that the resource is globally unused.

File acquisition belongs to `./adapters/json-resource-lifecycle`; the pure
finite transformation is exported as `./json-resource-lifecycle`. Neither reader
executes selected code or fetches remote schemas or JSON-LD contexts. See the
[receiving contracts](specifications/json-resource-lifecycle.md) for identities,
evidence boundaries and verification requirements.

The [native receiving record](specifications/json-resource-lifecycle-receiving.md)
records the physical CLI's reception of an exact SignCell repository snapshot
and the independently unpacked package checks.

