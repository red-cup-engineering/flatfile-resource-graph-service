import { makeCell } from "../kernel/cells.mjs";
import { canonicalCarrier, semanticId } from "@red-cup-engineering/signcell/cell";

export const FARS_ATTRIBUTE_NAMESPACE = "urn:fars:attribute:";
export const FARS_ATTRIBUTE_WITNESS = "urn:fars:attribute-witness";
export const FARS_ATTRIBUTE_VALUE_TYPE = "urn:fars:type:attribute-value";
export const FARS_JSON_VALUE_NAMESPACE = "urn:fars:json:";

const FARS_SOURCE_RESOURCE = "urn:fars:source-resource";
const FARS_WITNESSED_SUBJECT = "urn:fars:witnessed-subject";
const FARS_WITNESSED_PREDICATE = "urn:fars:witnessed-predicate";
const FARS_WITNESSED_OBJECT = "urn:fars:witnessed-object";
const FARS_ATTRIBUTE_INDEX = "urn:fars:attribute-index";
const FARS_ATTRIBUTE_CONTAINER = "urn:fars:attribute-container";

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function plainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

/** A frontmatter/JSON key becomes a collision-free graph predicate. */
export function attributePredicate(key) {
  if (typeof key !== "string") throw new TypeError("attribute key must be a string");
  return `${FARS_ATTRIBUTE_NAMESPACE}${encodeURIComponent(key.normalize("NFC"))}`;
}

/**
 * Encode one admitted semiotic-JSON value as a typed graph literal.
 *
 * The payload is canonical JSON bytes (NFC strings, recursively sorted keys,
 * finite JSON numbers), carried as base64url. The JSON grammar retains the
 * difference between strings, numbers, booleans, null, arrays, and objects;
 * unlike String(value), distinct values cannot collapse accidentally.
 */
export function encodeJsonGraphValue(value) {
  const bytes = Buffer.from(JSON.stringify(canonicalJson(value)), "utf8");
  return `${FARS_JSON_VALUE_NAMESPACE}${bytes.toString("base64url")}`;
}

// Keep the existing JSON-literal wire format, while using SignCell's admitted
// finite-number carrier. Historical ledger/record identity is not rewritten.
function canonicalJson(value) {
  const copied = canonicalCarrier(value);
  const sort = item => {
    if (Array.isArray(item)) return item.map(sort);
    if (item !== null && typeof item === "object") {
      if (Object.getPrototypeOf(item) !== Object.prototype)
        throw new TypeError("graph JSON values must be JSON data");
      return Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])]));
    }
    if (!["string", "number", "boolean"].includes(typeof item) && item !== null)
      throw new TypeError("graph JSON values must be JSON data");
    return item;
  };
  return sort(copied);
}

export function decodeJsonGraphValue(value) {
  nonEmptyString(value, "graph value");
  if (!value.startsWith(FARS_JSON_VALUE_NAMESPACE)) throw new TypeError("graph value is not a FARS JSON literal");
  return JSON.parse(Buffer.from(value.slice(FARS_JSON_VALUE_NAMESPACE.length), "base64url").toString("utf8"));
}

/**
 * Project all keys of one Markdown frontmatter or JSON object into cells.
 *
 * Array members become individual attribute edges. A reified witness for
 * every occurrence records its source resource, original index, container
 * kind, and exact typed value. Thus duplicate array members remain distinct
 * even though the query store intentionally deduplicates equal triples.
 */
export function projectAttributeCells({ subject, resource, attributes }) {
  nonEmptyString(subject, "attribute subject");
  nonEmptyString(resource, "attribute resource");
  const canonicalAttributes = plainRecord(canonicalJson(plainRecord(attributes, "attributes")), "canonical attributes");

  const cells = [];
  for (const key of Object.keys(canonicalAttributes)) {
    const predicate = attributePredicate(key);
    const sourceValue = canonicalAttributes[key];
    const array = Array.isArray(sourceValue);
    const occurrences = array && sourceValue.length > 0
      ? sourceValue.map((value, index) => ({ value, index }))
      : [{ value: sourceValue, index: null }];

    for (const occurrence of occurrences) {
      const object = encodeJsonGraphValue(occurrence.value);
      const witness = semanticId({
        kind: "fars.attribute-value-witness.v2",
        resource,
        subject,
        predicate,
        index: occurrence.index,
        value: occurrence.value,
      });
      cells.push(
        makeCell({ subject, predicate, object }),
        makeCell({ subject, predicate: FARS_ATTRIBUTE_WITNESS, object: witness }),
        makeCell({ subject: witness, predicate: "urn:fars:type", object: FARS_ATTRIBUTE_VALUE_TYPE }),
        makeCell({ subject: witness, predicate: FARS_SOURCE_RESOURCE, object: resource }),
        makeCell({ subject: witness, predicate: FARS_WITNESSED_SUBJECT, object: subject }),
        makeCell({ subject: witness, predicate: FARS_WITNESSED_PREDICATE, object: predicate }),
        makeCell({ subject: witness, predicate: FARS_WITNESSED_OBJECT, object }),
        makeCell({ subject: witness, predicate: FARS_ATTRIBUTE_INDEX, object: encodeJsonGraphValue(occurrence.index) }),
        makeCell({ subject: witness, predicate: FARS_ATTRIBUTE_CONTAINER, object: array ? "urn:fars:container:array" : "urn:fars:container:scalar" }),
      );
    }
  }
  return Object.freeze(cells);
}



