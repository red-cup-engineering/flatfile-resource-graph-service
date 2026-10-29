/**
 * analysis/d-frame - finite executable shadow of RelMath.Cohomology.DFrame.
 *
 * Lean proves frame, d-frame, canonical bitopological d-frame, and
 * d-frame-valued settling sheaf laws. This module exposes the finite powerset
 * instance: subsets as sorted string arrays, consistency as disjointness,
 * totality as covering, and restriction as intersection with a clopen mask.
 */
import { type ChargedCell } from "./settling-associated-sheaf.mjs";
export interface FiniteSubset {
    readonly kind: "dFrame.subset";
    readonly elements: readonly string[];
}
export interface PowersetFrameReceipt {
    readonly kind: "dFrame.powersetFrame:witness";
    readonly universe: readonly string[];
    readonly subsetCount: number;
    readonly bottom: FiniteSubset;
    readonly top: FiniteSubset;
    readonly meetCommutative: true;
    readonly meetAssociative: true;
    readonly meetIdempotent: true;
    readonly unionSupLeastUpperBound: true;
    readonly meetDistributesOverFiniteSup: true;
}
export interface CanonicalDFrameReceipt {
    readonly kind: "dFrame.canonical:witness";
    readonly universe: readonly string[];
    readonly positiveFrame: PowersetFrameReceipt;
    readonly negativeFrame: PowersetFrameReceipt;
    readonly consistentExample: readonly [FiniteSubset, FiniteSubset];
    readonly totalExample: readonly [FiniteSubset, FiniteSubset];
    readonly conIsDisjointness: true;
    readonly totIsCovering: true;
    readonly conDownwardClosed: true;
    readonly totUpwardClosed: true;
}
export interface DFrameValuedSheafReceipt {
    readonly kind: "dFrame.valuedSheaf:witness";
    readonly valuation: readonly ChargedCell[];
    readonly clopen: FiniteSubset;
    readonly positiveSupport: FiniteSubset;
    readonly negativeSupport: FiniteSubset;
    readonly settledSupport: FiniteSubset;
    readonly topSharedByBothSides: true;
    readonly bottomInNeitherSide: true;
    readonly conDownwardClosed: true;
    readonly totUpwardClosed: true;
    readonly restrictionMeetPreserving: true;
    readonly restrictionTop: FiniteSubset;
    readonly restrictionMonotone: true;
    readonly restrictionPreservesCon: true;
}
export interface DFrameReceipt {
    readonly kind: "dFrame.receipt:witness";
    readonly powerset: PowersetFrameReceipt;
    readonly canonical: CanonicalDFrameReceipt;
    readonly valuedSheaf: DFrameValuedSheafReceipt;
    readonly openFrontier: readonly string[];
}
export declare function subset(elements: readonly string[]): FiniteSubset;
export declare const includes: (value: FiniteSubset, element: string) => boolean;
export declare const le: (left: FiniteSubset, right: FiniteSubset) => boolean;
export declare const sameSubset: (left: FiniteSubset, right: FiniteSubset) => boolean;
export declare const meet: (left: FiniteSubset, right: FiniteSubset) => FiniteSubset;
export declare const join: (left: FiniteSubset, right: FiniteSubset) => FiniteSubset;
export declare const finiteSup: (family: readonly FiniteSubset[]) => FiniteSubset;
export declare const disjoint: (left: FiniteSubset, right: FiniteSubset) => boolean;
export declare const covers: (universe: readonly string[], left: FiniteSubset, right: FiniteSubset) => boolean;
export declare function allSubsets(universeInput: readonly string[]): readonly FiniteSubset[];
export declare function powersetFrameReceipt(universeInput?: readonly string[]): PowersetFrameReceipt;
export declare function canonicalDFrameReceipt(universeInput?: readonly string[]): CanonicalDFrameReceipt;
export declare const defaultValuation: readonly ChargedCell[];
export declare const dK: (valuation: readonly ChargedCell[]) => FiniteSubset;
export declare const dF: (valuation: readonly ChargedCell[]) => FiniteSubset;
export declare const settledMask: (valuation: readonly ChargedCell[], clopen: FiniteSubset) => FiniteSubset;
export declare const restrictSub: (clopen: FiniteSubset, value: FiniteSubset) => FiniteSubset;
export declare function valuedSheafReceipt(valuationInput?: readonly ChargedCell[], clopenInput?: FiniteSubset): DFrameValuedSheafReceipt;
export declare function receipt(): DFrameReceipt;
//# sourceMappingURL=d-frame.d.mts.map