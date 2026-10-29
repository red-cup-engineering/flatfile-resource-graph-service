/**
 * positing/dihedral-gauge — D4 as the value-level symmetry surface of FOUR.
 *
 * The FOUR charge algebra has two visible gauges. `bilattice-charge` carries the
 * Klein-four gauge K4 = `{ id, negation, conflation, double }`: the symmetries
 * that act within the two orders. Each K4 element preserves or reverses the
 * knowledge order and the truth order, but it carries knowledge order to
 * knowledge order and truth order to truth order; it never leaves an order. K4 is
 * missing the one symmetry of FOUR that exchanges the two orders.
 *
 * `orderSwapValue` is that missing symmetry: keep the truth side, complement the
 * falsity side. It witnesses the order-isomorphism
 * `(FOUR, knowledge) ~= (FOUR, truth)`, swapping `absurd <-> active` and
 * `potential <-> stable`. It belongs to neither order's automorphism group
 * precisely because it exchanges them.
 *
 * Adjoining `orderSwapValue` to K4 yields the order-eight dihedral gauge: the
 * full symmetry group of FOUR as a doubly ordered set, the bilattice square. The
 * order-preserving coset is K4. The order-swapping coset is
 * `{ order-swap, order-swap-negation, order-swap-conflation, order-swap-double }`,
 * each acting as `gauge(k, orderSwapValue(value))`. The defining dihedral
 * relation exposed here is `order-swap · negation · order-swap = conflation`;
 * the swapped coset contains the two diagonal reflections and the two quarter
 * rotations.
 *
 * The public API is deliberately value-level. The order-swap complements one
 * evidence side, and accumulated witness lists do not carry enough information to
 * perform that complement lawfully. Use this module to read the finite symmetry
 * algebra of admitted charge values, not to rewrite evidence carriers.
 *
 * The Lean side has the fuller proof object in `RelMath.Positing.D4Gauge`, with
 * `KleinFourGauge` and `OrderSwapDuality` supplying the upstream pieces. This
 * module is the Node carrier surface: names, action, multiplication by action
 * composition, fixed sets, coset effects, and witness-shaped reads for the
 * cross-order isomorphism and the defining conjugation law.
 *
 * @packageDocumentation
 */
import { charge, chargeSideName, chargeValue, chargeValueNames, chargeValues, conflateValue, gauge, gaugeElementNames, joinKnowledgeValue, joinTruthValue, leqKnowledge, leqTruth, meetKnowledgeValue, meetTruthValue, negateValue, sameChargeValue, } from "./bilattice-charge.mjs";
const flipSide = (name) => (name === "present" ? "absent" : "present");
/** The charge value at the given side coordinates — the reverse of a value's
 * `coordinates`, resolved over the four values (no posited table). */
function valueAtCoordinates(truth, falsity) {
    const found = chargeValues.find((value) => chargeSideName(value.coordinates[0]) === truth && chargeSideName(value.coordinates[1]) === falsity);
    if (!found)
        throw new TypeError(`valueAtCoordinates: no charge value at [${truth}, ${falsity}]`);
    return found;
}
/**
 * The order-swap involution σ: ⟨truth, falsity⟩ ↦ ⟨truth, ¬falsity⟩ — keep the
 * truth side, complement the falsity side. The cross-order iso
 * (FOUR, ≤knowledge) ≅ (FOUR, ≤truth); it swaps `absurd ↔ active` and
 * `potential ↔ stable`, and belongs to neither order's automorphism group.
 */
export function orderSwapValue(value) {
    return valueAtCoordinates(chargeSideName(value.coordinates[0]), flipSide(chargeSideName(value.coordinates[1])));
}
const orderSwapCoset = ["order-swap", "order-swap-negation", "order-swap-conflation", "order-swap-double"];
/** All eight D₄ element names: the order-preserving K₄ coset, then the order-swapping
 * K₄·σ coset. */
export const dihedralElementNames = Object.freeze([...gaugeElementNames, ...orderSwapCoset]);
const isGaugeElementName = (element) => gaugeElementNames.includes(element);
/**
 * Apply a D₄ element to a charge value. The order-preserving coset K₄ acts by
 * `gauge`; the order-swapping coset K₄·σ acts by `gauge(k, σ value)` — σ first, then
 * the Klein-four part.
 */
export function dihedral(element, value) {
    switch (element) {
        case "order-swap":
            return orderSwapValue(value);
        case "order-swap-negation":
            return gauge("negation", orderSwapValue(value));
        case "order-swap-conflation":
            return gauge("conflation", orderSwapValue(value));
        case "order-swap-double":
            return gauge("double", orderSwapValue(value));
        default:
            return gauge(element, value);
    }
}
const permutationOf = (element) => chargeValueNames.map((name) => dihedral(element, chargeValue(name)).name);
const elementForPermutation = (permutation) => dihedralElementNames.find((element) => permutationOf(element).every((image, index) => image === permutation[index]));
/**
 * The dihedral multiplication g·h, DERIVED from the action: the unique element whose
 * action equals `dihedral(g, dihedral(h, ·))`. Throws if the composite leaves D₄ —
 * which it cannot, so a successful return also witnesses closure.
 */
export function dihedralMul(left, right) {
    const composite = chargeValueNames.map((name) => dihedral(left, dihedral(right, chargeValue(name))).name);
    const found = elementForPermutation(composite);
    if (!found)
        throw new TypeError(`dihedralMul: ${left}·${right} left D₄ — the gauge is not closed`);
    return found;
}
/** The charge values fixed by a D₄ element. */
export const dihedralFixedSet = (element) => Object.freeze(chargeValues.filter((value) => sameChargeValue(dihedral(element, value), value)));
/** The order effect of a D₄ element: K₄ preserves each order, K₄·σ swaps them. */
export const dihedralOrderEffect = (element) => isGaugeElementName(element) ? "order-preserving" : "order-swapping";
const leqKnowledgeValue = (left, right) => leqKnowledge(charge(left), charge(right));
const leqTruthValue = (left, right) => leqTruth(charge(left), charge(right));
/**
 * Witness that σ is the cross-order isomorphism at `(left, right)`:
 * `left ≤knowledge right ⟺ σ left ≤truth σ right`.
 */
export function orderSwapIso(left, right) {
    const swappedLeft = orderSwapValue(left);
    const swappedRight = orderSwapValue(right);
    const knowledgeLeq = leqKnowledgeValue(left, right);
    const truthLeqSwapped = leqTruthValue(swappedLeft, swappedRight);
    return knowledgeLeq === truthLeqSwapped
        ? Object.freeze({
            kind: "dihedral-gauge.orderSwapIso:witness",
            left,
            right,
            swappedLeft,
            swappedRight,
            knowledgeLeq,
        })
        : Object.freeze({
            kind: "dihedral-gauge.orderSwapIso-obstruction",
            left,
            right,
            swappedLeft,
            swappedRight,
            knowledgeLeq,
            truthLeqSwapped,
        });
}
const allChargePairs = (predicate) => chargeValues.every((left) => chargeValues.every((right) => predicate(left, right)));
/** Bundle the finite Node shadow of `RelMath.Positing.OrderSwapDuality`. */
export function orderSwapDualityReceipt() {
    const swapTable = Object.freeze(Object.fromEntries(chargeValues.map((value) => [value.name, orderSwapValue(value).name])));
    const involutive = chargeValues.every((value) => sameChargeValue(orderSwapValue(orderSwapValue(value)), value));
    const distinctFromK4 = gaugeElementNames.every((element) => chargeValues.some((value) => !sameChargeValue(orderSwapValue(value), gauge(element, value))));
    const swapsBounds = swapTable.absurd === "active" &&
        swapTable.active === "absurd" &&
        swapTable.potential === "stable" &&
        swapTable.stable === "potential";
    const knowledgeToTruthIso = allChargePairs((left, right) => leqKnowledgeValue(left, right) === leqTruthValue(orderSwapValue(left), orderSwapValue(right)));
    const truthToKnowledgeIso = allChargePairs((left, right) => leqTruthValue(left, right) === leqKnowledgeValue(orderSwapValue(left), orderSwapValue(right)));
    const knowledgeJoinTransport = allChargePairs((left, right) => sameChargeValue(orderSwapValue(joinKnowledgeValue(left, right)), joinTruthValue(orderSwapValue(left), orderSwapValue(right))));
    const knowledgeMeetTransport = allChargePairs((left, right) => sameChargeValue(orderSwapValue(meetKnowledgeValue(left, right)), meetTruthValue(orderSwapValue(left), orderSwapValue(right))));
    const truthJoinConjugate = allChargePairs((left, right) => sameChargeValue(joinTruthValue(left, right), orderSwapValue(joinKnowledgeValue(orderSwapValue(left), orderSwapValue(right)))));
    const truthMeetConjugate = allChargePairs((left, right) => sameChargeValue(meetTruthValue(left, right), orderSwapValue(meetKnowledgeValue(orderSwapValue(left), orderSwapValue(right)))));
    const canonicalJoinClosureTransport = chargeValues.every((target) => chargeValues.every((value) => sameChargeValue(orderSwapValue(joinKnowledgeValue(target, orderSwapValue(value))), joinTruthValue(orderSwapValue(target), value))));
    const settleJoinClosureTransport = chargeValues.every((target) => sameChargeValue(orderSwapValue(joinKnowledgeValue(target, chargeValue("absurd"))), joinTruthValue(orderSwapValue(target), chargeValue("active"))));
    if (!involutive ||
        !distinctFromK4 ||
        !swapsBounds ||
        !knowledgeToTruthIso ||
        !truthToKnowledgeIso ||
        !knowledgeJoinTransport ||
        !knowledgeMeetTransport ||
        !truthJoinConjugate ||
        !truthMeetConjugate ||
        !canonicalJoinClosureTransport ||
        !settleJoinClosureTransport) {
        throw new TypeError("orderSwapDualityReceipt: finite order-swap laws failed");
    }
    return Object.freeze({
        kind: "dihedral-gauge.orderSwapDuality:witness",
        theoremInvolution: "RelMath.Charge.swap_swap",
        theoremKnowledgeTruthIso: "RelMath.Charge.swap_kle_tle",
        theoremTruthKnowledgeIso: "RelMath.Charge.swap_tle_kle",
        theoremJoinK: "RelMath.Charge.swap_joinK",
        theoremMeetK: "RelMath.Charge.swap_meetK",
        theoremClosureTransport: "RelMath.Charge.toTClosure_joinClosure_op",
        theoremSettleTransport: "RelMath.Charge.swap_settle_joinClosure",
        swapTable,
        involutive: true,
        distinctFromK4: true,
        swapsBounds: true,
        knowledgeToTruthIso: true,
        truthToKnowledgeIso: true,
        knowledgeJoinTransport: true,
        knowledgeMeetTransport: true,
        truthJoinConjugate: true,
        truthMeetConjugate: true,
        canonicalJoinClosureTransport: true,
        settleJoinClosureTransport: true,
    });
}
/**
 * Witness the defining dihedral relation σ∼σ = − at a value: conjugating negation by
 * the order-swap yields conflation. This is the relation that makes ⟨K₄, σ⟩ the
 * dihedral group D₄ rather than an abelian extension.
 */
export function dihedralConjugation(value) {
    const conjugate = orderSwapValue(negateValue(orderSwapValue(value)));
    const conflation = conflateValue(value);
    return sameChargeValue(conjugate, conflation)
        ? Object.freeze({ kind: "dihedral-gauge.conjugation:witness", value, conjugate, conflation })
        : Object.freeze({ kind: "dihedral-gauge.conjugation-obstruction", value, conjugate, conflation });
}
const knowledgeComparable = (left, right) => leqKnowledgeValue(left, right) || leqKnowledgeValue(right, left);
const truthComparable = (left, right) => leqTruthValue(left, right) || leqTruthValue(right, left);
/**
 * Witness that a D₄ element is in the order-swapping coset K₄·σ — the non-trivial
 * class of `D₄/K₄ ≅ ℤ/2`. Direction-agnostically: for every pair, `a, b` are
 * knowledge-comparable ⟺ `g a, g b` are truth-comparable (so `g` carries the
 * ≤knowledge-incomparable pair {potential, active} onto the ≤truth-incomparable pair
 * {absurd, stable}). The first failing pair is the obstruction, which every
 * order-preserving K₄ element produces.
 */
export function dihedralSwapsOrders(element) {
    for (const left of chargeValues) {
        for (const right of chargeValues) {
            if (knowledgeComparable(left, right) !== truthComparable(dihedral(element, left), dihedral(element, right))) {
                return Object.freeze({ kind: "dihedral-gauge.swapsOrders-obstruction", element, left, right });
            }
        }
    }
    return Object.freeze({ kind: "dihedral-gauge.swapsOrders:witness", element });
}
const sameValueName = (left, right) => left.name === right.name;
const allDistinctPermutations = () => {
    const seen = new Set();
    for (const element of dihedralElementNames)
        seen.add(permutationOf(element).join("|"));
    return seen.size === dihedralElementNames.length;
};
const actionIsHomomorphism = () => dihedralElementNames.every((left) => dihedralElementNames.every((right) => chargeValues.every((value) => sameValueName(dihedral(dihedralMul(left, right), value), dihedral(left, dihedral(right, value))))));
const multiplicationIsAssociative = () => dihedralElementNames.every((left) => dihedralElementNames.every((middle) => dihedralElementNames.every((right) => dihedralMul(dihedralMul(left, middle), right) === dihedralMul(left, dihedralMul(middle, right)))));
const identityIsTwoSided = () => dihedralElementNames.every((element) => dihedralMul("id", element) === element && dihedralMul(element, "id") === element);
const inverseTable = () => {
    const entries = dihedralElementNames.map((element) => {
        const inverse = dihedralElementNames.find((candidate) => dihedralMul(candidate, element) === "id" && dihedralMul(element, candidate) === "id");
        if (!inverse)
            throw new TypeError(`d4GaugeReceipt: no inverse for ${element}`);
        return [element, inverse];
    });
    return Object.freeze(Object.fromEntries(entries));
};
const elementIsInK4 = (element) => isGaugeElementName(element);
const elementIsInSwapCoset = (element) => !isGaugeElementName(element);
const k4IsClosed = () => gaugeElementNames.every((left) => gaugeElementNames.every((right) => elementIsInK4(dihedralMul(left, right))));
const cosetBitIsHomomorphism = () => dihedralElementNames.every((left) => dihedralElementNames.every((right) => elementIsInSwapCoset(dihedralMul(left, right)) === (elementIsInSwapCoset(left) !== elementIsInSwapCoset(right))));
const orderEffectTable = () => Object.freeze(Object.fromEntries(dihedralElementNames.map((element) => [element, dihedralOrderEffect(element)])));
/** Bundle the finite Node shadow of `RelMath.D4.d4_is_dihedral` and `d4_is_aut_four`. */
export function d4GaugeReceipt() {
    const inverses = inverseTable();
    const rotation = "order-swap-negation";
    const reflection = "order-swap";
    const rotationSquared = dihedralMul(rotation, rotation);
    const reflectionSquared = dihedralMul(reflection, reflection);
    const reflectedRotation = dihedralMul(dihedralMul(reflection, rotation), reflection);
    const swapNegationSwap = dihedralMul(dihedralMul(reflection, "negation"), reflection);
    const negSwap = dihedralMul("negation", reflection);
    const swapNeg = dihedralMul(reflection, "negation");
    if (!allDistinctPermutations())
        throw new TypeError("d4GaugeReceipt: action is not faithful");
    if (!actionIsHomomorphism())
        throw new TypeError("d4GaugeReceipt: action is not a homomorphism");
    if (!multiplicationIsAssociative())
        throw new TypeError("d4GaugeReceipt: multiplication is not associative");
    if (!identityIsTwoSided())
        throw new TypeError("d4GaugeReceipt: identity is not two-sided");
    if (dihedralMul(rotationSquared, rotationSquared) !== "id") {
        throw new TypeError("d4GaugeReceipt: rotation must have fourth power identity");
    }
    if (reflectionSquared !== "id")
        throw new TypeError("d4GaugeReceipt: reflection must square to identity");
    if (reflectedRotation !== inverses[rotation]) {
        throw new TypeError("d4GaugeReceipt: reflection must conjugate rotation to its inverse");
    }
    if (swapNegationSwap !== "conflation") {
        throw new TypeError("d4GaugeReceipt: order-swap conjugated negation must be conflation");
    }
    if (negSwap === swapNeg)
        throw new TypeError("d4GaugeReceipt: D4 witness must be non-abelian");
    if (!k4IsClosed())
        throw new TypeError("d4GaugeReceipt: K4 coset must be closed");
    if (!cosetBitIsHomomorphism())
        throw new TypeError("d4GaugeReceipt: coset bit must be a homomorphism");
    return Object.freeze({
        kind: "dihedral-gauge.d4:witness",
        theoremDihedral: "RelMath.D4.d4_is_dihedral",
        theoremAutFour: "RelMath.D4.d4_is_aut_four",
        elements: dihedralElementNames,
        orderEight: true,
        faithfulAction: true,
        actionHomomorphism: true,
        associative: true,
        identity: true,
        inverses,
        rotation,
        reflection,
        rotationSquared,
        rotationFourthIsIdentity: true,
        reflectionSquaredIsIdentity: true,
        reflectionConjugatesRotationToInverse: true,
        swapNegationSwapIsConflation: true,
        nonAbelian: true,
        k4Coset: gaugeElementNames,
        swapCoset: orderSwapCoset,
        cosetPartition: true,
        k4Closed: true,
        cosetBitHomomorphism: true,
        orderEffects: orderEffectTable(),
    });
}
//# sourceMappingURL=dihedral-gauge.mjs.map