import { cell, cellSet, retainedCarrier, semanticId } from "@red-cup-engineering/signcell/cell";
import { admit, defineType, typeIdentity } from "@red-cup-engineering/signcell/type-system";
import { parseJsonValue } from "@red-cup-engineering/json-services-section/parse-json-value";
import { sourceNamespace } from "./source-namespace.mjs";
import { encodeJsonGraphValue, projectAttributeCells } from "./attribute-projection.mjs";
import { admitExactTextSourceRevisions } from "./exact-source-revision.mjs";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const PROV = "http://www.w3.org/ns/prov#";
const DCT = "http://purl.org/dc/terms/";
const META = "https://json-schema.org/draft/2020-12/schema";
const NAMESPACE = "urn:fars:json-resource-lifecycle:";
const MAX_CELLS = 65_536;
const MAX_PROPERTIES = 4096;
const opaque = key => ["id", "val", "data"].includes(key) || /^foo_\d+$/u.test(key);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.trim().length > 0;
const iri = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$/u.test(value);
const escapePointer = key => String(key).replaceAll("~", "~0").replaceAll("/", "~1");
const reference = (identity, pointer) => identity.split("#")[0] + "#" + encodeURIComponent(pointer);

export const jsonSourceFocus = (namespace, path) =>
  `urn:fars:source-json:${encodeURIComponent(sourceNamespace(namespace))}:${encodeURIComponent(path)}`;

function declarations(value) {
  if (Array.isArray(value)) return value.filter(record);
  if (!record(value)) return [];
  return [value, ...(Array.isArray(value["@graph"]) ? value["@graph"].filter(record) : [])];
}
function links(value) {
  const values = Array.isArray(value) ? value : [value];
  return values.filter(item => record(item) && Object.keys(item).length === 1 && iri(item["@id"]))
    .map(item => item["@id"]);
}

/** Pure receiving over exact acquired text. References are observations, not execution proofs. */
export function analyzeJsonResourceLifecycle({ namespace, files }) {
  const owner = sourceNamespace(namespace), sources = retainedCarrier(files);
  admitExactTextSourceRevisions(sources);
  const ordered = [...sources].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const documents = ordered.filter(source => (?:source.path.endsWith(".json") || source.path.endsWith(".jsonld"))).map(source => {
    let value;
    try { value = parseJsonValue(source.text); }
    catch { throw new TypeError(`selected JSON source does not parse: ${source.path}`); }
    const focus = jsonSourceFocus(owner, source.path);
    return { ...source, value, focus, resource: `${focus}:${source.revision}` };
  });
  const schemaDocuments = documents.filter(source => record(source.value) &&
    source.value.$schema === META && iri(source.value.$id));
  const schemas = new Map();
  for (const document of schemaDocuments) {
    const group = schemas.get(document.value.$id) ?? [];
    group.push(document);
    schemas.set(document.value.$id, group);
  }
  const assertions = documents.flatMap(source => declarations(source.value).flatMap(node => {
    if (!iri(node["@id"])) return [];
    return [
      ...links(node[PROV + "used"]).map(target => ({ source, resource: target, activity: node["@id"], role: "reader" })),
      ...links(node[PROV + "wasGeneratedBy"]).map(activity => ({ source, resource: node["@id"], activity, role: "writer" })),
    ];
  }));
  const cells = [], resources = [];
  const add = (subject, predicate, object, witness) => {
    if (cells.length >= MAX_CELLS) throw new RangeError("JSON lifecycle exceeds its 65536-cell observation budget");
    cells.push(cell(subject, predicate, object, { for: [witness] }));
  };
  for (const document of documents) {
    const witness = Object.freeze({ kind: "fars.source-json-observation/v1", sourceNamespace: owner,
      sourcePath: document.path, contentDigest: document.revision });
    const refs = ordered.filter(source => source.path !== document.path && source.text.includes(document.path))
      .map(source => Object.freeze({ sourcePath: source.path, contentDigest: source.revision,
        kind: "text-reference", offset: source.text.indexOf(document.path) }));
    const intents = assertions.filter(row => row.resource === document.focus).map(row =>
      Object.freeze({ role: row.role, activity: row.activity, declarationPath: row.source.path,
        declarationDigest: row.source.revision }));
    const schemaUri = record(document.value) && text(document.value.$schema) ? document.value.$schema : null;
    const schemaSources = schemaUri === null ? [] : schemas.get(schemaUri) ?? [];
    let schema = { status: schemaUri === null ? "undeclared" : "unresolved", schemaUri }, supplied = null;
    if (schemaDocuments.includes(document)) schema = { status: "schema-document", schemaUri: document.value.$id };
    else if (schemaSources.length > 0) {
      const contents = new Set(schemaSources.map(source => semanticId(source.value)));
      if (contents.size !== 1) schema = { status: "ambiguous", schemaUri };
      else {
        const declaration = schemaSources[0].value;
        try {
          const result = defineType({ id: declaration.$id, name: declaration.title ?? `Schema at ${schemaSources[0].path}`,
            description: declaration.description ?? "A source-owned JSON Schema declaration.", parents: [],
            schema: declaration, references: schemaDocuments.filter(source => source.value.$id !== declaration.$id).map(source => source.value) });
          if (!result.ok) schema = { status: "invalid-schema", schemaUri, refusal: result.refusal };
          else {
            const admitted = admit(result.value, document.value);
            schema = { status: admitted.ok ? "admitted" : "rejected", schemaUri,
              declarationIdentity: typeIdentity(result.value),
              sourceDeclarations: schemaSources.map(source => ({ sourcePath: source.path, contentDigest: source.revision })),
              ...(admitted.ok ? {} : { refusal: admitted.refusal }) };
            supplied = declaration;
          }
        } catch (error) { schema = { status: "invalid-schema", schemaUri, reason: error.message }; }
      }
    }
    const classification = intents.length ? "declared-connected" : refs.length ? "referenced" : "unclaimed-in-snapshot";
    add(document.resource, "urn:fars:type", "urn:fars:type:source-json", witness);
    add(document.resource, "urn:fars:source-path", document.path, witness);
    add(document.resource, "urn:fars:source-revision", document.revision, witness);
    add(document.resource, "urn:fars:focus", document.focus, witness);
    add(document.resource, RDF + "value", encodeJsonGraphValue(document.value), witness);
    add(document.resource, NAMESPACE + "connection-status", classification, witness);
    if (schema.status === "admitted") for (const source of schemaSources)
      add(document.resource, DCT + "conformsTo", schema.declarationIdentity,
        { ...witness, schemaSourcePath: source.path, schemaContentDigest: source.revision });
    for (const intent of intents) add(intent.role === "reader" ? intent.activity : document.focus,
      intent.role === "reader" ? PROV + "used" : PROV + "wasGeneratedBy",
      intent.role === "reader" ? document.focus : intent.activity,
      { kind: "fars.declared-resource-lifecycle/v1", sourcePath: intent.declarationPath,
        contentDigest: intent.declarationDigest, interpretation: "declared-intent" });
    const propertyWitness = schemaSources.length ? { ...witness,
      schemaDeclarations: schemaSources.map(source => ({ sourcePath: source.path, contentDigest: source.revision })) } : witness;
    const properties = [], pending = [{ value: document.value, schema: supplied, pointer: "", schemaPointer: "" }];
    let visits = 0;
    while (pending.length) {
      if (++visits > MAX_PROPERTIES) throw new RangeError("JSON lifecycle exceeds its 4096-node structural observation budget");
      const current = pending.pop();
      if (Array.isArray(current.value)) {
        if (visits + pending.length + current.value.length > MAX_PROPERTIES)
          throw new RangeError("JSON lifecycle exceeds its 4096-node structural observation budget");
        current.value.forEach((value, index) => {
          const tuple = Array.isArray(current.schema?.prefixItems) && index < current.schema.prefixItems.length;
          pending.push({ value, pointer: `${current.pointer}/${index}`,
            schema: tuple ? current.schema.prefixItems[index] : current.schema?.items,
            schemaPointer: tuple ? `${current.schemaPointer}/prefixItems/${index}` : `${current.schemaPointer}/items` });
        });
      } else if (record(current.value)) {
        const keys = Object.keys(current.value).sort();
        if (visits + pending.length + keys.length > MAX_PROPERTIES)
          throw new RangeError("JSON lifecycle exceeds its 4096-node structural observation budget");
        for (const key of keys) {
          if (properties.length >= MAX_PROPERTIES) throw new RangeError("JSON lifecycle exceeds its 4096-property observation budget");
          const pointer = `${current.pointer}/${escapePointer(key)}`;
          const propertySchema = record(current.schema?.properties) && Object.hasOwn(current.schema.properties, key)
            ? current.schema.properties[key] : null;
          const schemaPointer = `${current.schemaPointer}/properties/${escapePointer(key)}`;
          const definedBy = propertySchema !== null && schemaUri !== null ? reference(schemaUri, schemaPointer) : null;
          const described = record(propertySchema) && (text(propertySchema.title) || text(propertySchema.description));
          const property = Object.freeze({ pointer, key, definedBy, documented: Boolean(described),
            opaqueWithoutDefinition: opaque(key) && !described });
          properties.push(property);
          const propertyId = reference(document.resource, pointer);
          add(document.resource, NAMESPACE + "has-property", propertyId, witness);
          if (definedBy !== null) add(propertyId, RDFS + "isDefinedBy", definedBy, propertyWitness);
          if (text(propertySchema?.title)) add(propertyId, RDFS + "label", propertySchema.title, propertyWitness);
          if (text(propertySchema?.description)) add(propertyId, RDFS + "comment", propertySchema.description, propertyWitness);
          pending.push({ value: current.value[key], schema: propertySchema, pointer, schemaPointer });
        }
      }
    }
    // Structural admission precedes the original attribute projection, whose
    // array-occurrence expansion must never receive an over-budget document.
    if (record(document.value)) for (const at of projectAttributeCells({ subject: document.resource,
      resource: document.resource, attributes: document.value })) add(at.subject, at.predicate, at.object, witness);
    const actions = [];
    if (classification === "unclaimed-in-snapshot") actions.push({ action: "bind-runtime-consumer",
      reason: "No reference or declared consumer/producer was observed in the selected snapshot." });
    else actions.push({ action: "qualify-runtime-connection",
      reason: classification === "referenced"
        ? "A path mention does not establish an executing reader or writer."
        : "A declared reader or writer still requires evidence of actual runtime execution." });
    if (!["admitted", "schema-document"].includes(schema.status)) actions.push({ action: "bind-or-repair-schema", status: schema.status });
    for (const property of properties.filter(property => property.opaqueWithoutDefinition))
      actions.push({ action: "define-property-meaning", pointer: property.pointer, key: property.key });
    resources.push(Object.freeze({ sourcePath: document.path, contentDigest: document.revision,
      resource: document.resource, focus: document.focus, classification,
      references: Object.freeze(refs), declaredConnections: Object.freeze(intents),
      schema: retainedCarrier(schema), properties: Object.freeze(properties), actions: retainedCarrier(actions) }));
  }
  return Object.freeze({ kind: "fars.json-resource-lifecycle/v1", sourceNamespace: owner,
    scope: Object.freeze({ kind: "selected-exact-text-snapshot", exhaustiveRepository: false,
      sources: Object.freeze(ordered.map(({ path, revision }) => Object.freeze({ sourcePath: path, contentDigest: revision }))) }),
    resources: Object.freeze(resources), cells: cellSet(cells) });
}
