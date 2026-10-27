# JSON resource receiving and lifecycle

The receiving scenario is an existing source owner handing FARS a finite, exact
repository snapshot. Every selected JSON document must become source-bearing
SignCells that the existing graph and SignCraft readers can consume. The scan
must distinguish a missing declared runtime consumer from a source that has been
proved unused. No absence of a text match proves absence of dynamic consumers.

## Contracts

- **JR-1:** Read only the owner's explicitly pinned relative files. Refuse
  traversal, symlinks, stale bytes, non-UTF-8 text and over-budget lots before
  returning an observation. The existing `source-json` command retains its
  object-only contract. The lifecycle reader accepts every finite JSON value.
- **JR-2:** Source namespace, path, exact SHA-256 revision, immutable Cell
  identity, source occurrence and schema identity remain separate coordinates.
  Every observed Cell carries a source witness; an unknown authored Cell never
  acquires positive evidence merely by being mentioned. Preserve opposition.
- **JR-3:** Native SignCell admits carriers and joins evidence. DREW retains
  occurrence provenance and the existing query/store projection. Historical
  durable FARS record IDs and their JSON hashing recipe do not change.
- **JR-4:** A schema association comes only from a document's explicit `$schema`
  URI and a uniquely identified schema document in the same admitted snapshot.
  Run the existing SignCell type validator. Missing, conflicting and invalid
  schemas stay distinct from valid typed data; never assert conformance on an
  unperformed validation. Property meaning comes from exact schema property
  pointers, titles and descriptions, never a guessed expansion of `id` or `val`.
- **JR-5:** Exact path mentions are `text-reference` observations only. Declared
  input/output relationships use expanded JSON-LD PROV-O `prov:used` and
  `prov:wasGeneratedBy` relations with the selected source's stable URI. These
  declarations describe intent, not evidence that the processor ran. No dynamic
  code is executed and no remote JSON-LD context or schema is fetched.
- **JR-6:** Classify each JSON resource as `declared-connected`, `referenced`, or
  `unclaimed-in-snapshot`; carry the complete selected path/revision scope.
  Generate a deterministic receiving action for each unresolved schema,
  undocumented property or missing runtime connection. The reader itself is a
  real source consumer. It never deletes an artifact or marks domain work done.
- **JR-7:** Expose the result through the original FARS CLI/provider/compositor.
  The same cells must pass native SignCraft `KnowledgeBase.fromCells` and support
  a bounded source query. No second index, event store or truth vocabulary.

## Standards and effects

JSON Schema 2020-12 is the schema carrier; RFC 6901 identifies a schema property;
RFC 6920 and upstream canonical CBOR identify native Cells; PROV-O describes
declared use and generation; Dublin Core `conformsTo` is emitted only after
schema admission. `rdfs:isDefinedBy`, `rdfs:label`, and `rdfs:comment` expose
declared property meanings. Native graph triples are not advertised as a full
JSON-LD processor or SHACL validation.

The analyzer is a pure finite transformation. File acquisition and CLI effects
remain in the original FARS adapters. Runtime publication and authorization stay
with their actual owners. Source reception does not establish commercial demand
or revenue.

## Discriminating verification

Test two source revisions with the same field; two owners with the same path;
positive and opposing native evidence; unknown native evidence; schema refusal
and ambiguity; decimal JSON and repeated arrays; standard short keys with schema
descriptions; exact text references versus declared PROV use; missing dynamic
consumer evidence; stale source pins; Unicode, traversal, symlinks, byte budgets;
the physical CLI; and the original downstream SignCraft reader. Qualify the
dependency-backed package and packed artifact separately from live installation.

Sources: https://www.w3.org/TR/prov-o/ ;
https://json-schema.org/draft/2020-12/json-schema-core.html ;
https://www.rfc-editor.org/rfc/rfc6901 ;
https://www.rfc-editor.org/rfc/rfc6920 ;
https://www.w3.org/TR/json-ld11/ .
