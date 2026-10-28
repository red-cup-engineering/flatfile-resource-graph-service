# flatfile-resource-graph-service

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Source-pinned JSON and flatfile EAVT resource graph with native CLI, provider observations, and closure rules for cycles, orphans, broken links and stubs.

## Unattended Git-tree source receiving

The same **existing** lifecycle operation can now select tracked JSON, code, and
documentation from a verified Git `HEAD` without asking a model to construct
hundreds of manual source pins:

```sh
flatfile-resource-graph source-json-lifecycle-git /absolute/repository/root \
  https://github.com/owner/repository 2026-10-27T00:00:00.000Z
```

Optional final arguments narrow the original source scope to complete
path-prefix selections (for example, `data` and `src`). The Git selector
authenticates each selected working-tree byte sequence against its immutable
Git blob object (SHA-1 or SHA-256), independently obtains its SHA-256 lifecycle
pin, and lets FARS re-read and verify the same bytes before composing Cells.
Edited files, symlinks, unsafe paths, empty JSON scopes, moving `HEAD`, and
over-budget selections refuse without partial source observations. Untracked
files and submodules are not silently claimed as observed; inspect their
own source roots separately. Source `scope.exhaustiveRepository` remains
`false`: static references and declarations do not prove live readers.

The original Git source selector and lifecycle reader also admit exact-byte
`.jsonld` documents, including source lots with no ordinary `.json` file.
Only expanded PROV-O IRIs create declared lifecycle edges: a compacted
`prov:used` key is not silently interpreted through `@context`. No remote
context is fetched or second JSON-LD processor is claimed. The same native
SignCell and FARS compositor receive these documents.

The pure lifecycle analyzer now independently checks every source text digest
and its exact UTF-8 byte limits even when invoked without the filesystem
adapter. No direct caller can mint source-version witnesses using an asserted
but unverified SHA-256 string. These are source-inventory and knowledge-receiving
capabilities, not authorization to delete files or receive Work.

### Source from unfinished Git refs

The existing FARS lifecycle also receives immutable bytes from a named branch,
archive tag or `refs/archive/...` without changing the current checkout:

```sh
flatfile-resource-graph source-json-lifecycle-git-ref \
  /absolute/owner/repository https://github.com/owner/repository \
  2026-10-27T00:00:00.000Z refs/archive/unfinished-agent data src
```

This path verifies the original commit, tree, blob content, and SHA-256
revisions before feeding the *same* SignCell/FARS provider as current Git or
pinned-file observations. A ref remains evidence of source, not an assertion
of successful integration or archive status. JSONL and source-language text
is reference evidence, not proof of an executing reader or valid JSON.
Historical scans leave all refs and the current checkout unchanged; Git
Services owns receiving and actual branch/tag retirement.

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


## Generated host state is not authored JSON

The native Git selectors use the pure `isGeneratedHostStatePath` source
admission law. A selected `.wrangler/` subtree contains effectful
Wrangler/Miniflare state, not candidate orphaned authored resources.
Automatic Git HEAD and archival-ref selections omit it; the latter reports
`gitSource.excludedGeneratedHostStateCount` without reading its bytes.
Original Git history is unchanged. Explicit pinned JSON lifecycle input
refuses such paths before projecting any source Cell. This does not apply to
authored `wrangler-config.json` or other ordinary JSON files, and it does
not claim absent runtime consumers. Native host telemetry retains separate
authority over real machine state.
