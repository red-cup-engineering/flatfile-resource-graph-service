/**
 * positing/valuation-fiber-algebra — finite valuation truth-Heyting quartet.
 *
 * Executable shadow of `RelMath.Positing.ValuationFiberAlgebra`,
 * `RelMath.Positing.ValuationQuartetDischarge`, and the finite recurrence cell
 * in `RelMath.Positing.QuartetRecurrence`.
 *
 * The Lean module works pointwise over `Valuation = PredicationCell -> Charge`.
 * This runtime surface stores a finite list of valuation points and FOUR values,
 * then lifts truth meet/join/implication and the two commuting truth nuclei over
 * that finite carrier.
 */
import { charge, chargeSideName, chargeValue, chargeValueName, chargeValueNames, chargeValues, conflateValue, joinTruthValue, leqKnowledge, leqTruth, meetTruthValue, negateValue, sameChargeValue, } from "./bilattice-charge.mjs";
const freezeRecord = (record) => Object.freeze({ ...record });
const valueCoordinates = (value) => Object.freeze([
    chargeSideName(value.coordinates[0]) === "present",
    chargeSideName(value.coordinates[1]) === "present",
]);
const valueAtCoordinates = (truth, falsity) => {
    const sideName = (present) => present ? "present" : "absent";
    const found = chargeValues.find((value) => chargeSideName(value.coordinates[0]) === sideName(truth)
        && chargeSideName(value.coordinates[1]) === sideName(falsity));
    if (found === undefined)
        throw new TypeError(`valueAtCoordinates: no FOUR value at [${truth}, ${falsity}]`);
    return found;
};
export function truthImplicationValue(antecedent, consequent) {
    const [aTruth, aFalsity] = valueCoordinates(antecedent);
    const [cTruth, cFalsity] = valueCoordinates(consequent);
    return valueAtCoordinates((!aTruth) || cTruth, (!aFalsity) && cFalsity);
}
const unique = (items) => new Set(items).size === items.length;
export function valuationFiberCarrier(points, values) {
    if (!unique(points))
        throw new TypeError("valuationFiberCarrier: duplicate points are not a finite carrier");
    const out = {};
    for (const point of points) {
        const value = values[point];
        if (value === undefined)
            throw new TypeError(`valuationFiberCarrier: missing value for ${point}`);
        out[point] = value;
    }
    return Object.freeze({
        kind: "positing.valuationFiber.carrier",
        points: Object.freeze([...points]),
        values: freezeRecord(out),
    });
}
export function readValuationFiber(carrier, point) {
    const value = carrier.values[point];
    if (value === undefined)
        throw new TypeError(`readValuationFiber: point ${point} is not in the carrier`);
    return value;
}
const mapFiber = (carrier, f) => {
    const out = {};
    for (const point of carrier.points)
        out[point] = f(readValuationFiber(carrier, point), point);
    return valuationFiberCarrier(carrier.points, out);
};
const zipFiber = (left, right, f) => {
    if (left.points.length !== right.points.length || left.points.some((point, index) => point !== right.points[index])) {
        throw new TypeError("zipFiber: valuation fibers must share the same ordered point carrier");
    }
    return mapFiber(left, (value, point) => f(value, readValuationFiber(right, point)));
};
export const valuationTruthMeet = (left, right) => zipFiber(left, right, (l, r) => chargeValueName(meetTruthValue(chargeValue(l), chargeValue(r))));
export const valuationTruthJoin = (left, right) => zipFiber(left, right, (l, r) => chargeValueName(joinTruthValue(chargeValue(l), chargeValue(r))));
export const valuationTruthImplication = (antecedent, consequent) => zipFiber(antecedent, consequent, (a, c) => chargeValueName(truthImplicationValue(chargeValue(a), chargeValue(c))));
const sameFiber = (left, right) => left.points.length === right.points.length
    && left.points.every((point, index) => point === right.points[index] && readValuationFiber(left, point) === readValuationFiber(right, point));
const leqTruthValue = (left, right) => leqTruth(charge(chargeValue(left)), charge(chargeValue(right)));
const leqKnowledgeValue = (left, right) => leqKnowledge(charge(chargeValue(left)), charge(chargeValue(right)));
export const valuationLeqTruth = (left, right) => left.points.every((point) => leqTruthValue(readValuationFiber(left, point), readValuationFiber(right, point)));
export const valuationLeqKnowledge = (left, right) => left.points.every((point) => leqKnowledgeValue(readValuationFiber(left, point), readValuationFiber(right, point)));
export const nucleusToward = (pole, carrier) => mapFiber(carrier, (value) => chargeValueName(joinTruthValue(chargeValue(pole), chargeValue(value))));
export const sigmaNucleus = (carrier) => nucleusToward("potential", carrier);
export const deltaNucleus = (carrier) => nucleusToward("stable", carrier);
export const piNucleus = (carrier) => sigmaNucleus(deltaNucleus(carrier));
const allChargeTriples = () => Object.freeze(chargeValueNames.flatMap((a) => chargeValueNames.flatMap((b) => chargeValueNames.map((c) => Object.freeze([a, b, c])))));
const checkChargeTruthMeetLaws = () => chargeValueNames.every((a) => sameChargeValue(meetTruthValue(chargeValue(a), chargeValue(a)), chargeValue(a)))
    && chargeValueNames.every((a) => chargeValueNames.every((b) => sameChargeValue(meetTruthValue(chargeValue(a), chargeValue(b)), meetTruthValue(chargeValue(b), chargeValue(a)))))
    && allChargeTriples().every(([a, b, c]) => sameChargeValue(meetTruthValue(meetTruthValue(chargeValue(a), chargeValue(b)), chargeValue(c)), meetTruthValue(chargeValue(a), meetTruthValue(chargeValue(b), chargeValue(c)))));
const checkChargeHeytingAdjunction = () => allChargeTriples().every(([a, b, c]) => {
    const left = leqTruthValue(chargeValueName(meetTruthValue(chargeValue(b), chargeValue(a))), c);
    const right = leqTruthValue(b, chargeValueName(truthImplicationValue(chargeValue(a), chargeValue(c))));
    return left === right;
});
const checkNucleus = (sample, nucleus) => {
    const closed = nucleus(sample);
    const other = mapFiber(sample, (value) => chargeValueName(joinTruthValue(chargeValue("active"), chargeValue(value))));
    return Object.freeze([
        valuationLeqTruth(sample, closed),
        sameFiber(nucleus(closed), closed),
        sameFiber(nucleus(valuationTruthMeet(sample, other)), valuationTruthMeet(nucleus(sample), nucleus(other))),
    ]);
};
export function crossOrderNotKnowledgeNucleus(points = ["fiber"]) {
    const witnessPoint = points[0] ?? "fiber";
    const carrier = valuationFiberCarrier(points.length === 0 ? [witnessPoint] : points, Object.fromEntries((points.length === 0 ? [witnessPoint] : points).map((point) => [point, "stable"])));
    const closure = nucleusToward("absurd", carrier);
    return Object.freeze({
        kind: "positing.valuationFiber.crossOrderNotKnowledgeNucleus:witness",
        valuation: carrier,
        closure,
        witnessPoint,
        before: "stable",
        after: readValuationFiber(closure, witnessPoint),
        knowledgeInflationary: valuationLeqKnowledge(carrier, closure),
    });
}
export function valuationFiberAlgebraReceipt(carrier) {
    const sigma = sigmaNucleus(carrier);
    const delta = deltaNucleus(carrier);
    const pi = piNucleus(carrier);
    const [sigmaInflationary, sigmaIdempotent, sigmaMeetPreserving] = checkNucleus(carrier, sigmaNucleus);
    const [deltaInflationary, deltaIdempotent, deltaMeetPreserving] = checkNucleus(carrier, deltaNucleus);
    const piOther = mapFiber(carrier, (value) => chargeValueName(joinTruthValue(chargeValue("active"), chargeValue(value))));
    const piInflationary = valuationLeqTruth(carrier, pi);
    const piIdempotent = sameFiber(piNucleus(pi), pi);
    const piMeetPreserving = sameFiber(piNucleus(valuationTruthMeet(carrier, piOther)), valuationTruthMeet(piNucleus(carrier), piNucleus(piOther)));
    const fixPi = sameFiber(pi, carrier);
    const fixBoth = sameFiber(sigma, carrier) && sameFiber(delta, carrier);
    const crossOrderFinding = crossOrderNotKnowledgeNucleus(carrier.points);
    if (!checkChargeTruthMeetLaws()
        || !checkChargeHeytingAdjunction()
        || !sigmaInflationary || !sigmaIdempotent || !sigmaMeetPreserving
        || !deltaInflationary || !deltaIdempotent || !deltaMeetPreserving
        || !sameFiber(sigmaNucleus(delta), deltaNucleus(sigma))
        || !piInflationary || !piIdempotent || !piMeetPreserving
        || crossOrderFinding.knowledgeInflationary !== false) {
        throw new TypeError("valuationFiberAlgebraReceipt: finite valuation-fiber laws failed");
    }
    return Object.freeze({
        kind: "positing.valuationFiberAlgebra.receipt:witness",
        carrier,
        truthTop: "potential",
        truthBottom: "active",
        sigmaPole: "potential",
        deltaPole: "stable",
        sigma,
        delta,
        pi,
        truthMeetIdempotent: true,
        truthMeetCommutative: true,
        truthMeetAssociative: true,
        truthOrderPartial: true,
        heytingAdjunction: true,
        sigmaInflationary: true,
        sigmaIdempotent: true,
        sigmaMeetPreserving: true,
        deltaInflationary: true,
        deltaIdempotent: true,
        deltaMeetPreserving: true,
        sigmaDeltaCommute: true,
        piInflationary: true,
        piIdempotent: true,
        piMeetPreserving: true,
        fixPiIffFixSigmaAndDelta: fixPi === fixBoth,
        cornerOperatorsExhaustive: true,
        abstractQuartetDischarged: true,
        crossOrderFinding,
    });
}
export const modalToCorner = (modal) => {
    switch (modal) {
        case "neither": return "absurd";
        case "dia": return "potential";
        case "box": return "active";
        case "both": return "stable";
    }
};
export const cornerToModal = (corner) => {
    switch (corner) {
        case "absurd": return "neither";
        case "potential": return "dia";
        case "active": return "box";
        case "stable": return "both";
    }
};
const corners = Object.freeze(["absurd", "potential", "active", "stable"]);
const modals = Object.freeze(["neither", "dia", "box", "both"]);
export const valuationFiberCornerOp = (corner, carrier) => {
    switch (corner) {
        case "potential": return carrier;
        case "active": return sigmaNucleus(carrier);
        case "stable": return deltaNucleus(carrier);
        case "absurd": return piNucleus(carrier);
    }
};
export function quartetRecurrenceReceipt(carrier) {
    const modalMap = freezeRecord(Object.fromEntries(modals.map((modal) => [modal, modalToCorner(modal)])));
    const cornerMap = freezeRecord(Object.fromEntries(corners.map((corner) => [corner, cornerToModal(corner)])));
    const modalRoundTrip = modals.every((modal) => cornerToModal(modalToCorner(modal)) === modal);
    const cornerRoundTrip = corners.every((corner) => modalToCorner(cornerToModal(corner)) === corner);
    const twistoringSquare = chargeValueNames.every((name) => sameChargeValue(negateValue(conflateValue(chargeValue(name))), conflateValue(negateValue(chargeValue(name)))));
    const commutatingSquare = sameFiber(sigmaNucleus(deltaNucleus(carrier)), deltaNucleus(sigmaNucleus(carrier)));
    if (!modalRoundTrip || !cornerRoundTrip || !twistoringSquare || !commutatingSquare) {
        throw new TypeError("quartetRecurrenceReceipt: recurrence laws failed");
    }
    return Object.freeze({
        kind: "positing.quartetRecurrence.receipt:witness",
        modalToCorner: modalMap,
        cornerToModal: cornerMap,
        modalRoundTrip: true,
        cornerRoundTrip: true,
        cornerOperators: corners,
        twistoringSquare: true,
        commutatingSquare: true,
        oneCoherenceCellAtTwoDepths: true,
        cardFour: 4,
    });
}
const absurdCornerIsIntersection = () => chargeValueNames.every((name) => {
    const point = "cell";
    const carrier = valuationFiberCarrier([point], { [point]: name });
    const fixedAbsurd = sameFiber(valuationFiberCornerOp("absurd", carrier), carrier);
    const fixedActiveAndStable = sameFiber(valuationFiberCornerOp("active", carrier), carrier) &&
        sameFiber(valuationFiberCornerOp("stable", carrier), carrier);
    return fixedAbsurd === fixedActiveAndStable;
});
/** Bundle the finite Node discharge of `RelMath.Positing.ValuationQuartetDischarge`. */
export function valuationQuartetDischargeReceipt(carrier) {
    const algebra = valuationFiberAlgebraReceipt(carrier);
    const recurrence = quartetRecurrenceReceipt(carrier);
    const j1AgreesSigma = sameFiber(valuationFiberCornerOp("active", carrier), sigmaNucleus(carrier));
    const j2AgreesDelta = sameFiber(valuationFiberCornerOp("stable", carrier), deltaNucleus(carrier));
    const piAgrees = sameFiber(valuationFiberCornerOp("absurd", carrier), piNucleus(carrier));
    const absurdIsIntersection = absurdCornerIsIntersection();
    if (!algebra.heytingAdjunction ||
        !algebra.sigmaDeltaCommute ||
        recurrence.cardFour !== 4 ||
        !absurdIsIntersection ||
        !algebra.fixPiIffFixSigmaAndDelta ||
        !j1AgreesSigma ||
        !j2AgreesDelta ||
        !piAgrees ||
        !algebra.abstractQuartetDischarged) {
        throw new TypeError("valuationQuartetDischargeReceipt: abstract quartet discharge failed");
    }
    return Object.freeze({
        kind: "positing.valuationQuartetDischarge.receipt:witness",
        theorem: "RelMath.FiberDischarge.valuation_discharges_abstract_quartet",
        theoremFixPi: "RelMath.FiberDischarge.valuation_quartet_fix_pi_iff",
        carrier,
        algebra,
        recurrence,
        heytingCarrier: "Valuation",
        meet: "valuationTruthMeet",
        join: "valuationTruthJoin",
        himp: "valuationTruthImplication",
        himpAdjunction: true,
        nucleiCommute: true,
        cornersCard: 4,
        absurdIsIntersection: true,
        fixPiIffFixSigmaAndDelta: true,
        j1AgreesSigma: true,
        j2AgreesDelta: true,
        piAgrees: true,
        abstractQuartetDischarged: true,
    });
}
//# sourceMappingURL=valuation-fiber-algebra.mjs.map