/**
 * settling/document - the document as a settled relational fixed point.
 *
 * A Document is not a syntax tree and not a file format. It is admitted only
 * after the predication/valuation closure has stabilized at the knowledge-least
 * fixed point. Representation carriers may preserve this object; they do not
 * become it.
 */
import { chargeValueName, valueOf } from "../bilattice-charge.mjs";
import { fixedPointReadings, } from "./fixed-point-reading.mjs";
const stableStringify = (value) => {
    if (value === undefined)
        return "undefined";
    if (value === null)
        return "null";
    if (typeof value === "bigint")
        return value.toString();
    if (typeof value !== "object")
        return JSON.stringify(value) ?? String(value);
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(",")}]`;
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
};
const termKey = (term) => stableStringify(term.mark.value);
const predicateKey = (predicate) => stableStringify(predicate.mark.value);
export const documentAddressKey = (cell) => stableStringify([termKey(cell.subject), predicateKey(cell.predicate), termKey(cell.object)]);
const addressOf = (meme) => Object.freeze({
    kind: "settledDocument.address",
    key: documentAddressKey(meme.cell),
    cell: meme.cell,
});
const referenceOf = (meme, addresses) => {
    const from = documentAddressKey(meme.cell);
    const target = addresses.find((address) => termKey(address.cell.subject) === termKey(meme.cell.object));
    return termKey(meme.cell.subject) === termKey(meme.cell.object) || target === undefined
        ? undefined
        : Object.freeze({
            kind: "settledDocument.reference",
            from,
            to: target.key,
            predicate: meme.cell.predicate,
        });
};
const orderedAddresses = (memes) => Object.freeze(memes.map(addressOf).sort((left, right) => left.key.localeCompare(right.key)));
const adjacencyOrder = (addresses) => Object.freeze(addresses.slice(0, -1).map((address, index) => Object.freeze({
    kind: "settledDocument.order",
    before: address.key,
    after: addresses[index + 1].key,
})));
/** Derive a document from the witnessed knowledge-least fixed point. */
export function documentOfFixedPoint(source) {
    const fixedPoint = source.knowledge.least.fixedPoint;
    if (fixedPoint.kind !== "predication.valuation.fixedPoint:witness") {
        return Object.freeze({ kind: "settledDocument.fixedPoint-obstruction", reason: "knowledge-least-not-fixed" });
    }
    const memes = fixedPoint.value.fibers.flatMap((fiber) => fiber.assignments);
    if (memes.length === 0) {
        return Object.freeze({ kind: "settledDocument.fixedPoint-obstruction", reason: "empty-fixed-point" });
    }
    const addresses = orderedAddresses(memes);
    const references = Object.freeze(memes
        .map((meme) => referenceOf(meme, addresses))
        .filter((reference) => reference !== undefined));
    return Object.freeze({
        kind: "settledDocument.fixedPoint",
        source,
        fixedPoint,
        reading: fixedPointReadings(source).knowledgeLeast,
        addresses,
        order: adjacencyOrder(addresses),
        references,
        valuationSites: Object.freeze(memes.map((meme) => Object.freeze({
            kind: "settledDocument.valuationSite",
            address: documentAddressKey(meme.cell),
            value: chargeValueName(valueOf(meme.charge)),
            meme,
        }))),
    });
}
/** HTML may carry a settled document, but it is not identical to the document. */
export function html_is_carrier_not_document(document, carrierKind) {
    return Object.freeze({
        kind: "settledDocument.html_is_carrier_not_document:witness",
        documentKind: document.kind,
        carrierKind,
        distinct: true,
    });
}
//# sourceMappingURL=document.mjs.map