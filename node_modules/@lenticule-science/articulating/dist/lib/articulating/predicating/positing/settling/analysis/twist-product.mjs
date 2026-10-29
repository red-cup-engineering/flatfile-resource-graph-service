/**
 * analysis/twist-product - finite executable shadow of
 * RelMath.Order.TwistProductResiduation.
 *
 * Lean proves `FOUR = Two^twist` and the truth-order residuation of the twist
 * product. This module exhausts the finite Boolean-pair carrier and checks that
 * it is exactly the existing charge/FOUR algebra and linear-logic operations.
 */
import { chargeValue, chargeValues, joinKnowledgeValue, joinTruthValue, meetKnowledgeValue, meetTruthValue, negateValue, sameChargeValue, } from "../../bilattice-charge.mjs";
import { linearFusionValue, linearMultiplicativeUnit, linearResiduumValue, } from "../../logic/bilattice-linear-logic.mjs";
const booleanPoint = (positive, negative) => Object.freeze({
    kind: "twistProduct.booleanPoint",
    positive,
    negative,
    label: `${positive ? "1" : "0"}${negative ? "1" : "0"}`,
});
export const booleanTwistPoints = Object.freeze([
    booleanPoint(false, false),
    booleanPoint(true, false),
    booleanPoint(false, true),
    booleanPoint(true, true),
]);
const boolLe = (left, right) => !left || right;
const boolMeet = (left, right) => left && right;
const boolJoin = (left, right) => left || right;
export function chargeOfBooleanPoint(point) {
    if (point.positive && point.negative)
        return chargeValue("stable");
    if (point.positive)
        return chargeValue("potential");
    if (point.negative)
        return chargeValue("active");
    return chargeValue("absurd");
}
export function booleanPointOfCharge(value) {
    switch (value.name) {
        case "absurd": return booleanPoint(false, false);
        case "potential": return booleanPoint(true, false);
        case "active": return booleanPoint(false, true);
        case "stable": return booleanPoint(true, true);
    }
}
const samePoint = (left, right) => left.positive === right.positive && left.negative === right.negative;
const leK = (left, right) => boolLe(left.positive, right.positive) && boolLe(left.negative, right.negative);
const leT = (left, right) => boolLe(left.positive, right.positive) && boolLe(right.negative, left.negative);
const meetK = (left, right) => booleanPoint(boolMeet(left.positive, right.positive), boolMeet(left.negative, right.negative));
const joinK = (left, right) => booleanPoint(boolJoin(left.positive, right.positive), boolJoin(left.negative, right.negative));
const meetT = (left, right) => booleanPoint(boolMeet(left.positive, right.positive), boolJoin(left.negative, right.negative));
const joinT = (left, right) => booleanPoint(boolJoin(left.positive, right.positive), boolMeet(left.negative, right.negative));
const neg = (point) => booleanPoint(point.negative, point.positive);
const fromChargeOp = (op) => (left, right) => booleanPointOfCharge(op(chargeOfBooleanPoint(left), chargeOfBooleanPoint(right)));
const fuse = fromChargeOp(linearFusionValue);
const imp = fromChargeOp(linearResiduumValue);
const chargeLeK = (left, right) => sameChargeValue(joinKnowledgeValue(left, right), right);
const chargeLeT = (left, right) => sameChargeValue(joinTruthValue(left, right), right);
const names = Object.freeze(booleanTwistPoints.map((point) => chargeOfBooleanPoint(point).name));
const obstruct = (reason, left, right, bound, observed, expected) => Object.freeze({
    kind: "twistProduct.four-obstruction",
    reason,
    left,
    right,
    bound,
    observed,
    expected,
});
/** Exhaustive finite receipt for `FOUR = Two^twist` and truth-order residuation. */
export function fourTwistProduct() {
    for (const point of booleanTwistPoints) {
        const charge = chargeOfBooleanPoint(point);
        if (!samePoint(booleanPointOfCharge(charge), point))
            return obstruct("bijection", charge.name);
    }
    for (const charge of chargeValues) {
        if (!sameChargeValue(chargeOfBooleanPoint(booleanPointOfCharge(charge)), charge))
            return obstruct("bijection", charge.name);
    }
    for (const left of booleanTwistPoints) {
        for (const right of booleanTwistPoints) {
            const leftCharge = chargeOfBooleanPoint(left);
            const rightCharge = chargeOfBooleanPoint(right);
            if (leK(left, right) !== chargeLeK(leftCharge, rightCharge))
                return obstruct("knowledgeOrder", leftCharge.name, rightCharge.name);
            if (leT(left, right) !== chargeLeT(leftCharge, rightCharge))
                return obstruct("truthOrder", leftCharge.name, rightCharge.name);
            if (!sameChargeValue(chargeOfBooleanPoint(neg(left)), negateValue(leftCharge)))
                return obstruct("negation", leftCharge.name);
            const knowledgeOps = [
                [chargeOfBooleanPoint(meetK(left, right)), meetKnowledgeValue(leftCharge, rightCharge)],
                [chargeOfBooleanPoint(joinK(left, right)), joinKnowledgeValue(leftCharge, rightCharge)],
            ];
            for (const [observed, expected] of knowledgeOps) {
                if (!sameChargeValue(observed, expected))
                    return obstruct("knowledgeLattice", leftCharge.name, rightCharge.name, undefined, observed.name, expected.name);
            }
            const truthOps = [
                [chargeOfBooleanPoint(meetT(left, right)), meetTruthValue(leftCharge, rightCharge)],
                [chargeOfBooleanPoint(joinT(left, right)), joinTruthValue(leftCharge, rightCharge)],
            ];
            for (const [observed, expected] of truthOps) {
                if (!sameChargeValue(observed, expected))
                    return obstruct("truthLattice", leftCharge.name, rightCharge.name, undefined, observed.name, expected.name);
            }
            if (!samePoint(fuse(left, right), fuse(right, left)))
                return obstruct("fusionCommutative", leftCharge.name, rightCharge.name);
            const unit = booleanPointOfCharge(linearMultiplicativeUnit);
            if (!samePoint(fuse(left, unit), left) || !samePoint(fuse(unit, left), left))
                return obstruct("fusionUnit", leftCharge.name);
            for (const bound of booleanTwistPoints) {
                const boundCharge = chargeOfBooleanPoint(bound);
                if (leT(fuse(left, right), bound) !== leT(left, imp(right, bound))) {
                    return obstruct("truthResiduation", leftCharge.name, rightCharge.name, boundCharge.name);
                }
            }
        }
    }
    const unit = linearMultiplicativeUnit;
    const truthTop = chargeValue("potential");
    if (sameChargeValue(unit, truthTop))
        return obstruct("unitNonIntegral", unit.name, truthTop.name);
    return Object.freeze({
        kind: "twistProduct.four:witness",
        elements: Object.freeze(booleanTwistPoints.map((point) => Object.freeze({
            point,
            charge: chargeOfBooleanPoint(point).name,
        }))),
        knowledgeBottom: "absurd",
        knowledgeTop: "stable",
        truthBottom: "active",
        truthTop: "potential",
        fusionUnit: unit.name,
        consistentFragment: Object.freeze(["absurd", "potential", "active"]),
        bijection: true,
        knowledgeOrderMatches: true,
        truthOrderMatches: true,
        negationMatches: true,
        knowledgeLatticeMatches: true,
        truthLatticeMatches: true,
        truthResiduation: true,
        fusionCommutative: true,
        fusionUnitLaw: true,
        unitNonIntegral: true,
    });
}
//# sourceMappingURL=twist-product.mjs.map