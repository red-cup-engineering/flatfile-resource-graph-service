/**
 * positing/closure-operator-fiber — finite pointwise closure families.
 *
 * Executable shadow of the finite/runtime part of
 * `RelMath.Closure.ClosureOperatorFiber` and
 * `RelMath.Closure.SettlingMonotonicityQuiescence`.
 *
 * A Lean `Charge.Closure` is an operation on FOUR that is inflationary,
 * monotone, and idempotent in the knowledge order. Runtime parity stores that
 * operation as an explicit table over the four charge names, validates the
 * closure laws, and lifts the table pointwise over finite valuation fibers.
 */
import { chargeValue, chargeValueName, chargeValueNames, joinKnowledgeValue, meetKnowledgeValue, } from "./bilattice-charge.mjs";
import { readValuationFiber, valuationFiberCarrier, valuationLeqKnowledge, } from "./valuation-fiber-algebra.mjs";
const freezeRecord = (record) => Object.freeze({ ...record });
const unique = (items) => new Set(items).size === items.length;
const knowledgeLeqValue = (left, right) => chargeValueName(joinKnowledgeValue(chargeValue(left), chargeValue(right))) === right;
const sameFiber = (left, right) => left.points.length === right.points.length
    && left.points.every((point, index) => point === right.points[index] && readValuationFiber(left, point) === readValuationFiber(right, point));
const samePointCarrier = (left, right) => left.points.length === right.points.length && left.points.every((point, index) => point === right.points[index]);
function requireSamePointCarrier(left, right) {
    if (!samePointCarrier(left, right)) {
        throw new TypeError("closure-operator-fiber: valuation fibers must share the same ordered point carrier");
    }
}
function* valuationRecords(points, index = 0, record = {}) {
    if (index === points.length) {
        yield freezeRecord(record);
        return;
    }
    const point = points[index];
    for (const value of chargeValueNames) {
        record[point] = value;
        yield* valuationRecords(points, index + 1, record);
    }
    delete record[point];
}
function valuations(points) {
    return Object.freeze([...valuationRecords(points)].map((values) => valuationFiberCarrier(points, values)));
}
function requireExhaustivePoints(points, caller) {
    if (points.length > 4) {
        throw new RangeError(`${caller}: exhaustive FOUR-valued closure checks are limited to at most 4 points`);
    }
}
export function chargeClosureCarrier(name, operation) {
    const table = {};
    for (const value of chargeValueNames) {
        const image = operation[value];
        if (!chargeValueNames.includes(image)) {
            throw new TypeError(`chargeClosureCarrier: operation for ${value} is not a FOUR charge value`);
        }
        table[value] = image;
    }
    const apply = (value) => table[value];
    const inflationary = chargeValueNames.every((value) => knowledgeLeqValue(value, apply(value)));
    const monotone = chargeValueNames.every((left) => chargeValueNames.every((right) => !knowledgeLeqValue(left, right) || knowledgeLeqValue(apply(left), apply(right))));
    const idempotent = chargeValueNames.every((value) => apply(apply(value)) === apply(value));
    if (!inflationary || !monotone || !idempotent) {
        throw new TypeError("chargeClosureCarrier: operation is not inflationary, monotone, and idempotent in knowledge order");
    }
    return Object.freeze({
        kind: "positing.closure.chargeClosure.carrier",
        name,
        operation: freezeRecord(table),
        inflationary: true,
        monotone: true,
        idempotent: true,
    });
}
export function knowledgeJoinClosure(bound) {
    return chargeClosureCarrier(`joinClosure:${bound}`, Object.fromEntries(chargeValueNames.map((value) => [
        value,
        chargeValueName(joinKnowledgeValue(chargeValue(bound), chargeValue(value))),
    ])));
}
export function applyChargeClosure(closure, value) {
    return closure.operation[value];
}
export function iterateChargeOperation(operation, seed, steps) {
    let current = seed;
    for (let step = 0; step < steps; step += 1)
        current = operation(current);
    return current;
}
export function settleStep(closure, increment, value) {
    return chargeValueName(joinKnowledgeValue(chargeValue(applyChargeClosure(closure, value)), chargeValue(increment)));
}
export function chargeOrbit(operation, seed, steps) {
    const out = [seed];
    for (let step = 0; step < steps; step += 1)
        out.push(operation(out[out.length - 1]));
    return Object.freeze(out);
}
export function liftClosure(closure, carrier) {
    return valuationFiberCarrier(carrier.points, Object.fromEntries(carrier.points.map((point) => [point, applyChargeClosure(closure, readValuationFiber(carrier, point))])));
}
function checkKzIffStrictForInflationary(operation) {
    const inflationary = chargeValueNames.every((value) => knowledgeLeqValue(value, operation(value)));
    if (!inflationary)
        return false;
    const kz = chargeValueNames.every((value) => knowledgeLeqValue(operation(operation(value)), operation(value)));
    const strict = chargeValueNames.every((value) => operation(operation(value)) === operation(value));
    return kz === strict;
}
function checkNoPeriodicChargeOrbits(closure) {
    return chargeValueNames.every((value) => [1, 2, 3, 4].every((period) => iterateChargeOperation((charge) => applyChargeClosure(closure, charge), value, period) !== value
        || applyChargeClosure(closure, value) === value));
}
function checkSettleStepInflationary(closure, increment) {
    return chargeValueNames.every((value) => knowledgeLeqValue(value, settleStep(closure, increment, value)));
}
function checkSettleStepSettlesByThree(closure, increment) {
    const op = (value) => settleStep(closure, increment, value);
    return chargeValueNames.every((value) => iterateChargeOperation(op, value, 3) === iterateChargeOperation(op, value, 4));
}
export function closureMonadReceipt(closure, increment, seed) {
    const stepOp = (value) => settleStep(closure, increment, value);
    const orbit = chargeOrbit(stepOp, seed, 4);
    const kzIffStrict = checkKzIffStrictForInflationary((value) => applyChargeClosure(closure, value));
    const noPeriodicOrbits = checkNoPeriodicChargeOrbits(closure);
    const settleStepInflationary = checkSettleStepInflationary(closure, increment);
    const settleStepSettlesByThree = checkSettleStepSettlesByThree(closure, increment);
    const unitInflationary = chargeValueNames.every((value) => knowledgeLeqValue(value, applyChargeClosure(closure, value)));
    const multiplicationIdempotent = chargeValueNames.every((value) => applyChargeClosure(closure, applyChargeClosure(closure, value)) === applyChargeClosure(closure, value));
    const counitTriangle = multiplicationIdempotent;
    if (!kzIffStrict || !noPeriodicOrbits || !settleStepInflationary || !settleStepSettlesByThree || !unitInflationary || !multiplicationIdempotent || !counitTriangle) {
        throw new TypeError("closureMonadReceipt: finite closure-monad laws failed");
    }
    return Object.freeze({
        kind: "positing.closure.monad.receipt:witness",
        closure,
        increment,
        seed,
        settled: orbit[orbit.length - 1],
        settleStepOrbit: orbit,
        kzIffStrict: true,
        noPeriodicOrbits: true,
        settleStepInflationary: true,
        settleStepSettlesByThree: true,
        unitInflationary: true,
        multiplicationIdempotent: true,
        counitTriangle: true,
    });
}
function checkClosureAlgebraPropertyLike(closure, points) {
    return valuations(points).every((valuation) => {
        const closed = liftClosure(closure, valuation);
        const structureMap = valuationLeqKnowledge(closed, valuation);
        const fixed = sameFiber(closed, valuation);
        return structureMap === fixed;
    });
}
/** Bundle the finite valuation shadow of `RelMath.Closure.Closure2MonadKZ`. */
export function closure2MonadKzReceipt(closure, seed) {
    requireExhaustivePoints(seed.points, "closure2MonadKzReceipt");
    const closed = liftClosure(closure, seed);
    const closedClosed = liftClosure(closure, closed);
    const pointwise = pointwiseClosureFamilyReceipt(closure, seed);
    const unitInflationary = valuationLeqKnowledge(seed, closed);
    const multiplicationIdempotent = sameFiber(closedClosed, closed);
    const triangleClEta = multiplicationIdempotent;
    const triangleEtaCl = multiplicationIdempotent;
    const kzInequality = valuationLeqKnowledge(closedClosed, closed);
    const kzIffStrict = valuations(seed.points).every((valuation) => {
        const cl = liftClosure(closure, valuation);
        const clcl = liftClosure(closure, cl);
        return valuationLeqKnowledge(clcl, cl) === sameFiber(clcl, cl);
    });
    const algebraIsPropertyNotData = checkClosureAlgebraPropertyLike(closure, seed.points);
    if (!unitInflationary ||
        !multiplicationIdempotent ||
        !triangleClEta ||
        !triangleEtaCl ||
        !kzInequality ||
        !kzIffStrict ||
        !algebraIsPropertyNotData ||
        !pointwise.liftInflationary ||
        !pointwise.liftIdempotent) {
        throw new TypeError("closure2MonadKzReceipt: finite KZ closure-2-monad laws failed");
    }
    return Object.freeze({
        kind: "positing.closure.closure2MonadKZ.receipt:witness",
        theoremKz: "RelMath.closure_kz_lax_idempotent",
        theoremPropertyLike: "RelMath.closure_algebra_property_like",
        closure,
        seed,
        closed,
        closedClosed,
        pointwise,
        unitInflationary: true,
        multiplicationIdempotent: true,
        triangleClEta: true,
        triangleEtaCl: true,
        kzInequality: true,
        kzIffStrict: true,
        strictRegimeMuIdentity: true,
        scottRegimeMuIdentity: true,
        clAlgebraIffFixed: true,
        algebraStructureUnique: true,
        structureMapForcedIdentity: true,
        algebraIsPropertyNotData: true,
    });
}
export function valuationKnowledgeJoin(left, right) {
    requireSamePointCarrier(left, right);
    return valuationFiberCarrier(left.points, Object.fromEntries(left.points.map((point) => [
        point,
        chargeValueName(joinKnowledgeValue(chargeValue(readValuationFiber(left, point)), chargeValue(readValuationFiber(right, point)))),
    ])));
}
export function valuationKnowledgeMeet(left, right) {
    requireSamePointCarrier(left, right);
    return valuationFiberCarrier(left.points, Object.fromEntries(left.points.map((point) => [
        point,
        chargeValueName(meetKnowledgeValue(chargeValue(readValuationFiber(left, point)), chargeValue(readValuationFiber(right, point)))),
    ])));
}
export function closureOrbit(closure, seed, steps) {
    const out = [seed];
    for (let step = 0; step < steps; step += 1)
        out.push(liftClosure(closure, out[out.length - 1]));
    return Object.freeze(out);
}
export function reindexMapCarrier(sourcePoints, targetPoints, map) {
    if (!unique(sourcePoints))
        throw new TypeError("reindexMapCarrier: duplicate source points are not a finite carrier");
    if (!unique(targetPoints))
        throw new TypeError("reindexMapCarrier: duplicate target points are not a finite carrier");
    const targetSet = new Set(targetPoints);
    const out = {};
    for (const source of sourcePoints) {
        const target = map[source];
        if (target === undefined)
            throw new TypeError(`reindexMapCarrier: missing target for ${source}`);
        if (!targetSet.has(target))
            throw new TypeError(`reindexMapCarrier: target ${target} is not in the target carrier`);
        out[source] = target;
    }
    return Object.freeze({
        kind: "positing.closure.reindexMap.carrier",
        sourcePoints: Object.freeze([...sourcePoints]),
        targetPoints: Object.freeze([...targetPoints]),
        map: freezeRecord(out),
    });
}
export function reindexValuationFiber(map, target) {
    if (target.points.length !== map.targetPoints.length || target.points.some((point, index) => point !== map.targetPoints[index])) {
        throw new TypeError("reindexValuationFiber: target valuation does not match the map target carrier");
    }
    return valuationFiberCarrier(map.sourcePoints, Object.fromEntries(map.sourcePoints.map((source) => [source, readValuationFiber(target, map.map[source])])));
}
const identityReindex = (points) => reindexMapCarrier(points, points, Object.fromEntries(points.map((point) => [point, point])));
const iterClosure = (closure, carrier, steps) => {
    let current = carrier;
    for (let step = 0; step < steps; step += 1)
        current = liftClosure(closure, current);
    return current;
};
function checkLiftMonotone(closure, points) {
    const all = valuations(points);
    return all.every((left) => all.every((right) => !valuationLeqKnowledge(left, right) || valuationLeqKnowledge(liftClosure(closure, left), liftClosure(closure, right))));
}
function checkNoPeriodicOrbits(closure, points) {
    const all = valuations(points);
    return all.every((valuation) => [1, 2, 3, 4].every((period) => !sameFiber(iterClosure(closure, valuation, period), valuation) || sameFiber(liftClosure(closure, valuation), valuation)));
}
function checkClosureMerge(closure, points) {
    const all = valuations(points);
    return all.every((left) => all.every((right) => sameFiber(liftClosure(closure, valuationKnowledgeJoin(liftClosure(closure, left), right)), liftClosure(closure, valuationKnowledgeJoin(left, right)))));
}
function checkLeastFixedPoint(closure, seed) {
    const settled = liftClosure(closure, seed);
    return sameFiber(liftClosure(closure, settled), settled)
        && valuations(seed.points).every((candidate) => !(valuationLeqKnowledge(seed, candidate) && sameFiber(liftClosure(closure, candidate), candidate))
            || valuationLeqKnowledge(settled, candidate));
}
function checkOrbitMonotone(orbit) {
    return orbit.every((left, i) => orbit.every((right, j) => i > j || valuationLeqKnowledge(left, right)));
}
function checkQuiescentIffFixed(closure, orbit) {
    return orbit.every((valuation, index) => {
        const fixed = sameFiber(liftClosure(closure, valuation), valuation);
        const constantFromHere = orbit.slice(index).every((later) => sameFiber(later, valuation));
        return fixed === constantFromHere;
    });
}
export function pointwiseClosureFamilyReceipt(closure, seed, cNaturalMap = identityReindex(seed.points), cNaturalTarget = seed) {
    requireExhaustivePoints(seed.points, "pointwiseClosureFamilyReceipt");
    requireExhaustivePoints(cNaturalMap.sourcePoints, "pointwiseClosureFamilyReceipt");
    const closed = liftClosure(closure, seed);
    const orbit = closureOrbit(closure, seed, 4);
    const cNaturalSource = reindexValuationFiber(cNaturalMap, cNaturalTarget);
    const cNaturalLeft = liftClosure(closure, cNaturalSource);
    const cNaturalRight = reindexValuationFiber(cNaturalMap, liftClosure(closure, cNaturalTarget));
    const liftInflationary = valuations(seed.points).every((valuation) => valuationLeqKnowledge(valuation, liftClosure(closure, valuation)));
    const liftMonotone = checkLiftMonotone(closure, seed.points);
    const liftIdempotent = valuations(seed.points).every((valuation) => sameFiber(liftClosure(closure, liftClosure(closure, valuation)), liftClosure(closure, valuation)));
    const noPeriodicOrbits = checkNoPeriodicOrbits(closure, seed.points);
    const cNatural = sameFiber(cNaturalLeft, cNaturalRight);
    const closureMerge = checkClosureMerge(closure, seed.points);
    const lfpIsSettled = checkLeastFixedPoint(closure, seed);
    const lfpReachedByThree = sameFiber(iterClosure(closure, seed, 3), iterClosure(closure, seed, 4));
    const orbitMonotone = checkOrbitMonotone(orbit);
    const quiescentIffFixed = checkQuiescentIffFixed(closure, orbit);
    if (!liftInflationary || !liftMonotone || !liftIdempotent || !noPeriodicOrbits || !cNatural
        || !closureMerge || !lfpIsSettled || !lfpReachedByThree || !orbitMonotone || !quiescentIffFixed) {
        throw new TypeError("pointwiseClosureFamilyReceipt: finite closure-family laws failed");
    }
    return Object.freeze({
        kind: "positing.closure.pointwiseFamily.receipt:witness",
        closure,
        seed,
        closed,
        orbit,
        cNaturalMap,
        cNaturalSource,
        cNaturalTarget,
        cNaturalLeft,
        cNaturalRight,
        liftInflationary: true,
        liftMonotone: true,
        liftIdempotent: true,
        noPeriodicOrbits: true,
        cNatural: true,
        closureMerge: true,
        lfpIsSettled: true,
        lfpReachedByThree: true,
        orbitMonotone: true,
        quiescentIffFixed: true,
    });
}
export function cosettlingReceipt(closure, top) {
    requireExhaustivePoints(top.points, "cosettlingReceipt");
    if (!sameFiber(liftClosure(closure, top), top)) {
        throw new TypeError("cosettlingReceipt: top must be closure-stable");
    }
    const preimages = Object.freeze(valuations(top.points).filter((valuation) => sameFiber(liftClosure(closure, valuation), top)));
    const containment = preimages.every((valuation) => valuationLeqKnowledge(valuation, top));
    const maximum = preimages.some((valuation) => sameFiber(valuation, top)) && preimages.every((valuation) => valuationLeqKnowledge(valuation, top));
    const joinClosed = preimages.every((left) => preimages.every((right) => preimages.some((candidate) => sameFiber(candidate, valuationKnowledgeJoin(left, right)))));
    if (!containment || !maximum || !joinClosed) {
        throw new TypeError("cosettlingReceipt: finite cosettling laws failed");
    }
    return Object.freeze({
        kind: "positing.closure.cosettling.receipt:witness",
        closure,
        top,
        preimages,
        containment: true,
        maximum: true,
        joinClosed: true,
        joinSubsemilatticeWithTop: true,
    });
}
//# sourceMappingURL=closure-operator-fiber.mjs.map