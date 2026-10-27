# Native JSON lifecycle receiving

The physical FARS CLI received a source snapshot of
[`red-cup-engineering/signcell` at `06386c62777681152cd93caf3377a08b7b75c3a8`](https://github.com/red-cup-engineering/signcell/tree/06386c62777681152cd93caf3377a08b7b75c3a8).
All 112 selected JSON, JavaScript and documentation files were checked against
their Git blob identities before acquisition; their exact 1,254,104 bytes were
then selected by SHA-256 pins. The observation instant was
`2026-10-27T02:59:02.000Z`.

The unchanged physical CLI entry point returned status zero. Its lifecycle
provider received 31 JSON resources and composed 18,304 native Cells with source
revision witnesses. Twenty-four resources had path references in the selected
snapshot; seven had neither a path reference nor an expanded PROV declaration.
The latter seven were the JSON records beneath
`data/records/measurements/2026-10-27-exact-event-custody/`.

None of the 31 JSON resources declared a `$schema` association. The receiving
result therefore retains 31 schema-binding actions. It also exposes 312
occurrences of short property names whose meanings were not supplied by a
selected schema. These are scoped findings, not claims that the properties lack
meaning everywhere, or that a dynamic consumer cannot exist.

## Verification

- The complete source package suite passed 63/63 checks, with no failures,
  cancellations or skips.
- The packed `@red-cup-engineering/flatfile-resource-graph-service@0.1.11`
  artifact was unpacked into an independent package directory and passed the
  same 63/63 shipped checks against its actual installed supplier closure.
- Checks cover source digest refusal, acquisition bounds, scalar and array JSON,
  decimal values, exact schema validation, ambiguity and rejection, physical
  CLI use, positive and opposing evidence, and authored unknown claims.
- A structurally oversized object is refused before its array occurrences can
  expand into attribute observations or enlarge the pending traversal frontier.
- Independent review confirmed schema refusal, declared-intent provenance,
  preservation of both evidence lanes and preservation of authored unknowns.
  Array tuple and subsequent-item property meanings retain exact schema pointers.

The package pins native SignCell 0.13.2. The repository lock records the exact
transitive suppliers used for receiving. This measurement establishes local
source and package reception; live installation, publication and commercial
receipts require their own observations.
