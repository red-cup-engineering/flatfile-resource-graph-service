/**
 * analysis/twist-product - finite executable shadow of
 * RelMath.Order.TwistProductResiduation.
 *
 * Lean proves `FOUR = Two^twist` and the truth-order residuation of the twist
 * product. This module exhausts the finite Boolean-pair carrier and checks that
 * it is exactly the existing charge/FOUR algebra and linear-logic operations.
 */
import { type ChargeValue, type ChargeValueName } from "../../bilattice-charge.mjs";
export interface BooleanTwistPoint {
    readonly kind: "twistProduct.booleanPoint";
    readonly positive: boolean;
    readonly negative: boolean;
    readonly label: string;
}
export declare const booleanTwistPoints: readonly BooleanTwistPoint[];
export declare function chargeOfBooleanPoint(point: BooleanTwistPoint): ChargeValue;
export declare function booleanPointOfCharge(value: ChargeValue): BooleanTwistPoint;
export interface TwistProductFourElement {
    readonly point: BooleanTwistPoint;
    readonly charge: ChargeValueName;
}
export interface TwistProductFourWitness {
    readonly kind: "twistProduct.four:witness";
    readonly elements: readonly TwistProductFourElement[];
    readonly knowledgeBottom: ChargeValueName;
    readonly knowledgeTop: ChargeValueName;
    readonly truthBottom: ChargeValueName;
    readonly truthTop: ChargeValueName;
    readonly fusionUnit: ChargeValueName;
    readonly consistentFragment: readonly ChargeValueName[];
    readonly bijection: true;
    readonly knowledgeOrderMatches: true;
    readonly truthOrderMatches: true;
    readonly negationMatches: true;
    readonly knowledgeLatticeMatches: true;
    readonly truthLatticeMatches: true;
    readonly truthResiduation: true;
    readonly fusionCommutative: true;
    readonly fusionUnitLaw: true;
    readonly unitNonIntegral: true;
}
export interface TwistProductFourObstruction {
    readonly kind: "twistProduct.four-obstruction";
    readonly reason: "bijection" | "knowledgeOrder" | "truthOrder" | "negation" | "knowledgeLattice" | "truthLattice" | "truthResiduation" | "fusionCommutative" | "fusionUnit" | "unitNonIntegral";
    readonly left?: ChargeValueName | undefined;
    readonly right?: ChargeValueName | undefined;
    readonly bound?: ChargeValueName | undefined;
    readonly observed?: ChargeValueName | undefined;
    readonly expected?: ChargeValueName | undefined;
}
export type TwistProductFourJudgment = TwistProductFourWitness | TwistProductFourObstruction;
/** Exhaustive finite receipt for `FOUR = Two^twist` and truth-order residuation. */
export declare function fourTwistProduct(): TwistProductFourJudgment;
//# sourceMappingURL=twist-product.d.mts.map