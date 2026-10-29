/**
 * predicating/predication — the predication cell Φ = E × Π × E.
 *
 * Predicating consumes the potential aperiodic articulation cell, opens the
 * transfinite predication category around the token-schema and claim-schema its
 * utterance carries, and materializes that category as the predication site
 * positing consumes. A `Cell` is a subject term, a predicate, and an object
 * term; the base category adds specialization, converse, and projection edges.
 *
 * Coincidence is STRUCTURAL (value equality of the carried marks), not reference
 * identity: this package is boundary-first, so terms reconstructed from JSON must
 * still coincide. A term is a Token; a predicate carries a Claim; both compare by
 * their mark value, the one place the opaque payload is read (only to dedupe).
 */
import { coincides } from "../utterance.mjs";
/** A predicate: an object of the predicate category, carrying a Claim's mark. */
export class Predicate {
    kind = "predication.predicate";
    claim;
    mark;
    constructor(claimCarrier) {
        this.claim = claimCarrier;
        this.mark = claimCarrier.mark;
        Object.freeze(this);
    }
}
// — coincidence (structural, on carried mark values) —
/** Whether two terms coincide (by their token's mark value). */
export const termCoincides = (left, right) => coincides(left.mark.value, right.mark.value);
/** Whether two predicates coincide (by their claim's mark value). */
export const predicateCoincides = (left, right) => coincides(left.claim.mark.value, right.claim.mark.value);
/** Whether two cells coincide componentwise. */
export const cellCoincides = (left, right) => termCoincides(left.subject, right.subject)
    && predicateCoincides(left.predicate, right.predicate)
    && termCoincides(left.object, right.object);
/** Whether two nodes coincide positionally. */
export const nodeCoincides = (left, right) => termCoincides(left[0], right[0]) && predicateCoincides(left[1], right[1]) && termCoincides(left[2], right[2]);
const isNode = (value) => Array.isArray(value);
const isPredicateObject = (value) => !Array.isArray(value) && "kind" in value && value.kind === "predication.predicate";
/** Whether two base objects coincide; cross-shape comparisons never coincide. */
export function baseObjectCoincides(left, right) {
    if (isNode(left) || isNode(right))
        return isNode(left) && isNode(right) && nodeCoincides(left, right);
    if (isPredicateObject(left) || isPredicateObject(right)) {
        return isPredicateObject(left) && isPredicateObject(right) && predicateCoincides(left, right);
    }
    return termCoincides(left, right);
}
function judge(holds, left, right) {
    return holds
        ? Object.freeze({ kind: "predication.identity:witness", left, right })
        : Object.freeze({ kind: "predication.identity-obstruction", left, right });
}
export const predicationTermIdentity = (l, r) => judge(termCoincides(l, r), l, r);
export const predicationPredicateIdentity = (l, r) => judge(predicateCoincides(l, r), l, r);
export const cellIdentity = (l, r) => judge(cellCoincides(l, r), l, r);
export const predicationNodeIdentity = (l, r) => judge(nodeCoincides(l, r), l, r);
// — constructors and builders —
function uniqueBy(values, same) {
    const out = [];
    for (const value of values)
        if (!out.some((item) => same(item, value)))
            out.push(value);
    return Object.freeze(out);
}
/** Promote a Claim into a predicate object (preserving the mark, not identity). */
export function predicateOfClaim(claimCarrier) {
    return new Predicate(claimCarrier);
}
/** Build an entity set, deduplicating by the given sameness. */
export function entitySet(entities, same) {
    return Object.freeze({ kind: "predication.entitySet", entities: uniqueBy([...entities], same) });
}
/** Build a predicate set, deduplicating by the given sameness. */
export function predicateSet(predicates, same) {
    return Object.freeze({ kind: "predication.predicateSet", predicates: uniqueBy([...predicates], same) });
}
/** Build a cell set, deduplicating by cell coincidence and deriving entity/predicate sets. */
export function cellSet(cells) {
    const witnessed = uniqueBy(cells, cellCoincides);
    return Object.freeze({
        kind: "predication.cellSet",
        cells: Object.freeze(witnessed),
        entities: entitySet(witnessed.flatMap((c) => [c.subject, c.object]), termCoincides),
        predicates: predicateSet(witnessed.map((c) => c.predicate), predicateCoincides),
    });
}
/** Present Φ = E × Π × E by its generators. */
export function generatedPredicationCellSet(entities, predicates) {
    return Object.freeze({ kind: "predication.generatedCellSet", entities, predicates });
}
/** Construct a frozen cell, throwing if any component is absent or the object is null. */
export function cell(subject, predicate, object) {
    if (subject === undefined || predicate === undefined || object === undefined || object === null) {
        throw new TypeError("cell: subject, predicate, and non-null object must be present");
    }
    return Object.freeze({ subject, predicate, object });
}
/** `RelMath.PredicationCell.seed`: `(token, claim) -> (token, claim, token)`. */
export function predicationSeed(carrier) {
    return cell(carrier.token, predicateOfClaim(carrier.claim), carrier.token);
}
/** Predicating proper out of the potential articulation cell. */
export function predicatingCell(articulation) {
    const [carrier] = articulation.potentialAperiodicArticulationCell;
    return predicationSeed(carrier);
}
/** `RelMath.PredicationCell.converse`: swap subject and object. */
export function converseCell(carrier) {
    return cell(carrier.object, carrier.predicate, carrier.subject);
}
/** `RelMath.PredicationCell.subjProj`: collapse object onto subject. */
export function subjectProjectionCell(carrier) {
    return cell(carrier.subject, carrier.predicate, carrier.subject);
}
/** `RelMath.PredicationCell.objProj`: collapse subject onto object. */
export function objectProjectionCell(carrier) {
    return cell(carrier.object, carrier.predicate, carrier.object);
}
/** `RelMath.PredicationCell.specialize`: refine only the predicate coordinate. */
export function specializePredicateCell(f, carrier) {
    return cell(carrier.subject, f(carrier.predicate), carrier.object);
}
/** Converse is an involution. */
export const converseCellInvolution = (carrier) => cellCoincides(converseCell(converseCell(carrier)), carrier);
/** The seed is reflexive, so converse fixes it. */
export const converseSeed = (carrier) => cellCoincides(converseCell(predicationSeed(carrier)), predicationSeed(carrier));
/** Orientation is real when subject and object are distinct. */
export const converseCellDistinctWhenOriented = (carrier) => termCoincides(carrier.subject, carrier.object) || !cellCoincides(converseCell(carrier), carrier);
/** Subject projection is idempotent. */
export const subjectProjectionCellIdempotent = (carrier) => cellCoincides(subjectProjectionCell(subjectProjectionCell(carrier)), subjectProjectionCell(carrier));
/** Object projection is idempotent. */
export const objectProjectionCellIdempotent = (carrier) => cellCoincides(objectProjectionCell(objectProjectionCell(carrier)), objectProjectionCell(carrier));
/** Identity predicate specialization is the identity morphism. */
export const specializePredicateCellIdentity = (carrier) => cellCoincides(specializePredicateCell((predicate) => predicate, carrier), carrier);
/** Type guard for a cell. */
export const isCell = (value) => "subject" in value && "predicate" in value && "object" in value;
/** Construct a frozen specialization morphism (domain general, codomain specialized). */
export function specializationMorphism(specialized, general) {
    return Object.freeze({ kind: "predication.specialization", domain: general, codomain: specialized });
}
/** Type guard for a specialization morphism. */
export function isSpecializationMorphism(value) {
    return "kind" in value && value.kind === "predication.specialization";
}
function baseCategory(cellCarrier, specializations = []) {
    const materialized = "cells" in cellCarrier ? cellCarrier.cells : [];
    const nodeOf = (c) => Object.freeze([c.subject, c.predicate, c.object]);
    return Object.freeze({
        kind: "predication.base",
        objects: uniqueBy([...cellCarrier.entities.entities, ...cellCarrier.predicates.predicates], baseObjectCoincides),
        specialization: Object.freeze(specializations),
        converse: Object.freeze(materialized.map((c) => Object.freeze({ domain: nodeOf(c), codomain: Object.freeze([c.object, c.predicate, c.subject]) }))),
        subjectProjection: Object.freeze(materialized.map((c) => Object.freeze({ domain: nodeOf(c), codomain: c.subject }))),
        objectProjection: Object.freeze(materialized.map((c) => Object.freeze({ domain: nodeOf(c), codomain: c.object }))),
    });
}
/** Build a predication site from cells and specialization morphisms. */
export function predicationSite(witnesses) {
    const cells = witnesses.filter(isCell);
    const specializations = witnesses.filter(isSpecializationMorphism);
    const cellCarrier = cellSet(cells);
    return Object.freeze({
        kind: "predication.site",
        cells: cellCarrier,
        specializations: Object.freeze(specializations),
        base: baseCategory(cellCarrier, specializations),
    });
}
/** Build the transfinite predication category from generators. */
export function transfinitePredicationCategory(predicationCellSet) {
    const base = baseCategory(predicationCellSet);
    return Object.freeze({
        kind: "predication.transfiniteCategory",
        predicationCellSet,
        predicationFiberFunctor: Object.freeze({
            kind: "predication.fiberFunctor",
            cellSet: predicationCellSet,
            base,
            entities: predicationCellSet.entities,
        }),
    });
}
/** Open the generated transfinite predication category around an articulation carrier. */
export function generatePredicationCategory(articulation) {
    const [carrier, [articulatedTokens]] = articulation.potentialAperiodicArticulationCell;
    const articulatedToken = articulatedTokens[0];
    return transfinitePredicationCategory(generatedPredicationCellSet(entitySet([articulatedToken], termCoincides), predicateSet([predicateOfClaim(carrier.claim)], predicateCoincides)));
}
/** Materialize a generated category as the finite predication site positing consumes. */
export function materializePredicationCategory(category) {
    const cells = category.predicationCellSet.entities.entities.flatMap((subject) => category.predicationCellSet.predicates.predicates.flatMap((predicate) => category.predicationCellSet.entities.entities.map((object) => cell(subject, predicate, object))));
    return predicationSite(cells);
}
/** The predication morphism: articulated givens → the relational cells. */
export function predicate(articulation) {
    return materializePredicationCategory(generatePredicationCategory(articulation));
}
/** Project a materialized site to its generators (the stored/wire presentation). */
export function presentPredicationSite(site) {
    return Object.freeze({
        kind: "predication.site",
        cells: site.cells.cells,
        specializations: site.specializations,
    });
}
/** Re-derive the full materialized site from its generators (the read projection). */
export function freePredicationSite(generators) {
    return predicationSite([...generators.cells, ...generators.specializations]);
}
/** The base category with its specialization relation transitively closed. */
export function closeSpecialization(base) {
    const edges = base.specialization.map((edge) => [edge.domain, edge.codomain]);
    const has = (domain, codomain) => edges.some(([d, c]) => termCoincides(d, domain) && termCoincides(c, codomain));
    let changed = true;
    while (changed) {
        changed = false;
        for (const [leftDomain, leftCodomain] of [...edges]) {
            for (const [rightDomain, rightCodomain] of [...edges]) {
                if (termCoincides(leftCodomain, rightDomain) && !has(leftDomain, rightCodomain)) {
                    edges.push([leftDomain, rightCodomain]);
                    changed = true;
                }
            }
        }
    }
    return Object.freeze({
        ...base,
        specialization: Object.freeze(edges.map(([domain, codomain]) => Object.freeze({ domain, codomain }))),
    });
}
/** Cohere a site: saturated cells + residue with closed specialization. */
export function cohere(predication) {
    return Object.freeze({
        kind: "predication.coherence",
        saturated: predication.cells,
        residue: Object.freeze({
            kind: "predication.site",
            cells: predication.cells,
            specializations: predication.specializations,
            base: closeSpecialization(predication.base),
        }),
    });
}
/** Compute the unrelated ordered entity pairs of a site. */
export function unrelatedPairs(predication) {
    const closed = closeSpecialization(predication.base);
    const related = (domain, codomain) => closed.specialization.some((edge) => termCoincides(edge.domain, domain) && termCoincides(edge.codomain, codomain));
    const edges = [];
    for (const domain of predication.cells.entities.entities) {
        for (const codomain of predication.cells.entities.entities) {
            if (!related(domain, codomain))
                edges.push(Object.freeze({ domain, codomain }));
        }
    }
    return Object.freeze({ kind: "predication.unrelatedPairs", edges: Object.freeze(edges) });
}
//# sourceMappingURL=predication.mjs.map