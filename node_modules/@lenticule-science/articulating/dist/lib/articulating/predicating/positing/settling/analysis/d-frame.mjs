/**
 * analysis/d-frame - finite executable shadow of RelMath.Cohomology.DFrame.
 *
 * Lean proves frame, d-frame, canonical bitopological d-frame, and
 * d-frame-valued settling sheaf laws. This module exposes the finite powerset
 * instance: subsets as sorted string arrays, consistency as disjointness,
 * totality as covering, and restriction as intersection with a clopen mask.
 */
import { chargedCell, } from "./settling-associated-sheaf.mjs";
const uniqueSorted = (values) => {
    const out = [];
    for (const value of values) {
        if (value.length === 0)
            throw new TypeError("dFrame: element names must be nonempty");
        if (!out.includes(value))
            out.push(value);
    }
    return Object.freeze(out.sort((left, right) => left.localeCompare(right)));
};
export function subset(elements) {
    return Object.freeze({
        kind: "dFrame.subset",
        elements: uniqueSorted(elements),
    });
}
const assertSubsetOf = (universe, value) => {
    for (const element of value.elements) {
        if (!universe.includes(element)) {
            throw new TypeError(`dFrame: subset element ${JSON.stringify(element)} is outside the universe`);
        }
    }
};
export const includes = (value, element) => value.elements.includes(element);
export const le = (left, right) => left.elements.every((element) => right.elements.includes(element));
export const sameSubset = (left, right) => le(left, right) && le(right, left);
export const meet = (left, right) => subset(left.elements.filter((element) => right.elements.includes(element)));
export const join = (left, right) => subset([...left.elements, ...right.elements]);
export const finiteSup = (family) => family.reduce((accumulator, value) => join(accumulator, value), subset([]));
export const disjoint = (left, right) => left.elements.every((element) => !right.elements.includes(element));
export const covers = (universe, left, right) => universe.every((element) => left.elements.includes(element) || right.elements.includes(element));
export function allSubsets(universeInput) {
    const universe = uniqueSorted(universeInput);
    const count = 2 ** universe.length;
    if (count > 4096)
        throw new TypeError("dFrame.allSubsets: universe too large for exhaustive powerset receipt");
    return Object.freeze(Array.from({ length: count }, (_, mask) => subset(universe.filter((_, index) => (mask & (1 << index)) !== 0))));
}
const pairs = (items) => Object.freeze(items.flatMap((left) => items.map((right) => Object.freeze([left, right]))));
const triples = (items) => Object.freeze(items.flatMap((a) => items.flatMap((b) => items.map((c) => Object.freeze([a, b, c])))));
const familiesOf = (items) => {
    const count = 2 ** items.length;
    return Object.freeze(Array.from({ length: count }, (_, mask) => Object.freeze(items.filter((_, index) => (mask & (1 << index)) !== 0))));
};
export function powersetFrameReceipt(universeInput = ["x", "y", "z"]) {
    const universe = uniqueSorted(universeInput);
    const subsets = allSubsets(universe);
    const bottom = subset([]);
    const top = subset(universe);
    const meetCommutative = pairs(subsets).every(([a, b]) => sameSubset(meet(a, b), meet(b, a)));
    const meetAssociative = triples(subsets).every(([a, b, c]) => sameSubset(meet(meet(a, b), c), meet(a, meet(b, c))));
    const meetIdempotent = subsets.every((value) => sameSubset(meet(value, value), value));
    const unionSupLeastUpperBound = familiesOf(subsets).every((family) => {
        const sup = finiteSup(family);
        return family.every((member) => le(member, sup))
            && subsets.every((candidate) => !family.every((member) => le(member, candidate)) || le(sup, candidate));
    });
    const meetDistributesOverFiniteSup = pairs(subsets).every(([a]) => familiesOf(subsets).every((family) => sameSubset(meet(a, finiteSup(family)), finiteSup(family.map((member) => meet(a, member))))));
    if (!meetCommutative || !meetAssociative || !meetIdempotent || !unionSupLeastUpperBound || !meetDistributesOverFiniteSup) {
        throw new TypeError("powersetFrameReceipt: finite powerset-frame laws failed");
    }
    return Object.freeze({
        kind: "dFrame.powersetFrame:witness",
        universe,
        subsetCount: subsets.length,
        bottom,
        top,
        meetCommutative: true,
        meetAssociative: true,
        meetIdempotent: true,
        unionSupLeastUpperBound: true,
        meetDistributesOverFiniteSup: true,
    });
}
export function canonicalDFrameReceipt(universeInput = ["plus", "minus"]) {
    const universe = uniqueSorted(universeInput);
    const subsets = allSubsets(universe);
    const conDownwardClosed = pairs(subsets).every(([a, b]) => !disjoint(a, b)
        || pairs(subsets).every(([aPrime, bPrime]) => !le(aPrime, a) || !le(bPrime, b) || disjoint(aPrime, bPrime)));
    const totUpwardClosed = pairs(subsets).every(([a, b]) => !covers(universe, a, b)
        || pairs(subsets).every(([aPrime, bPrime]) => !le(a, aPrime) || !le(b, bPrime) || covers(universe, aPrime, bPrime)));
    if (!conDownwardClosed || !totUpwardClosed) {
        throw new TypeError("canonicalDFrameReceipt: finite d-frame closure laws failed");
    }
    return Object.freeze({
        kind: "dFrame.canonical:witness",
        universe,
        positiveFrame: powersetFrameReceipt(universe),
        negativeFrame: powersetFrameReceipt(universe),
        consistentExample: Object.freeze([subset([universe[0] ?? ""]), subset([universe[1] ?? ""])]),
        totalExample: Object.freeze([subset([universe[0] ?? ""]), subset(universe.slice(1))]),
        conIsDisjointness: true,
        totIsCovering: true,
        conDownwardClosed: true,
        totUpwardClosed: true,
    });
}
export const defaultValuation = Object.freeze([
    chargedCell("truth-cell", "potential"),
    chargedCell("both-cell", "stable"),
    chargedCell("false-cell", "active"),
    chargedCell("empty-cell", "absurd"),
]);
export const dK = (valuation) => subset(valuation.filter((entry) => entry.charge === "potential" || entry.charge === "stable").map((entry) => entry.cell));
export const dF = (valuation) => subset(valuation.filter((entry) => entry.charge === "active" || entry.charge === "stable").map((entry) => entry.cell));
export const settledMask = (valuation, clopen) => subset(valuation
    .filter((entry) => entry.charge !== "absurd" && clopen.elements.includes(entry.cell))
    .map((entry) => entry.cell));
export const restrictSub = (clopen, value) => meet(clopen, value);
export function valuedSheafReceipt(valuationInput = defaultValuation, clopenInput = subset(defaultValuation.map((entry) => entry.cell))) {
    const valuation = Object.freeze([...valuationInput]);
    const universe = uniqueSorted(valuation.map((entry) => entry.cell));
    assertSubsetOf(universe, clopenInput);
    const subsets = allSubsets(universe);
    const positiveSupport = meet(dK(valuation), clopenInput);
    const negativeSupport = meet(dF(valuation), clopenInput);
    const settledSupport = settledMask(valuation, clopenInput);
    const con = (a, b) => disjoint(a, b);
    const tot = (a, b) => settledSupport.elements.every((cell) => includes(a, cell) || includes(b, cell));
    const conDownwardClosed = pairs(subsets).every(([a, b]) => !con(a, b)
        || pairs(subsets).every(([aPrime, bPrime]) => !le(aPrime, a) || !le(bPrime, b) || con(aPrime, bPrime)));
    const totUpwardClosed = pairs(subsets).every(([a, b]) => !tot(a, b)
        || pairs(subsets).every(([aPrime, bPrime]) => !le(a, aPrime) || !le(b, bPrime) || tot(aPrime, bPrime)));
    const topSharedByBothSides = valuation
        .filter((entry) => entry.charge === "stable" && clopenInput.elements.includes(entry.cell))
        .every((entry) => includes(positiveSupport, entry.cell) && includes(negativeSupport, entry.cell));
    const bottomInNeitherSide = valuation
        .filter((entry) => entry.charge === "absurd")
        .every((entry) => !includes(positiveSupport, entry.cell) && !includes(negativeSupport, entry.cell));
    const subClopen = subset(clopenInput.elements.filter((_, index) => index % 2 === 0));
    const restrictionMeetPreserving = pairs(subsets).every(([a, b]) => sameSubset(restrictSub(subClopen, meet(a, b)), meet(restrictSub(subClopen, a), restrictSub(subClopen, b))));
    const restrictionTop = restrictSub(subClopen, subset(universe));
    const restrictionMonotone = pairs(subsets).every(([a, b]) => !le(a, b) || le(restrictSub(subClopen, a), restrictSub(subClopen, b)));
    const restrictionPreservesCon = pairs(subsets).every(([a, b]) => !con(a, b) || con(restrictSub(subClopen, a), restrictSub(subClopen, b)));
    if (!conDownwardClosed || !totUpwardClosed || !topSharedByBothSides || !bottomInNeitherSide
        || !restrictionMeetPreserving || !restrictionMonotone || !restrictionPreservesCon) {
        throw new TypeError("valuedSheafReceipt: finite d-frame-valued sheaf laws failed");
    }
    return Object.freeze({
        kind: "dFrame.valuedSheaf:witness",
        valuation,
        clopen: clopenInput,
        positiveSupport,
        negativeSupport,
        settledSupport,
        topSharedByBothSides: true,
        bottomInNeitherSide: true,
        conDownwardClosed: true,
        totUpwardClosed: true,
        restrictionMeetPreserving: true,
        restrictionTop,
        restrictionMonotone: true,
        restrictionPreservesCon: true,
    });
}
export function receipt() {
    return Object.freeze({
        kind: "dFrame.receipt:witness",
        powerset: powersetFrameReceipt(),
        canonical: canonicalDFrameReceipt(),
        valuedSheaf: valuedSheafReceipt(),
        openFrontier: Object.freeze([
            "The runtime receipt checks finite powerset-frame laws; arbitrary Prop-valued frames and infinitary suprema remain Lean-side.",
            "The d-frame-valued sheaf is modeled over finite charged cells and masks, not arbitrary bitopological sites or all clopen covers.",
            "General d-frame morphism categories and non-finite frame-valued sheaf cohomology remain proof/kernel obligations.",
        ]),
    });
}
//# sourceMappingURL=d-frame.mjs.map