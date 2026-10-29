/**
 * settling/analysis/collatz — finite Collatz arithmetic shadows.
 *
 * This module mirrors the computable parts of the green Collatz-side Lean
 * files: accelerated step/orbit/parity words, affine traces, first-passage
 * coefficient crossings, 2-adic shortcut factoring, reached-set quiescence,
 * residue arithmetic, and the Padovan/Fibonacci slow-growth comparison. It
 * deliberately does not claim the two red frontier holes
 * `parentBarrierGap_holds` or `everyNonterminalHasCrossing_holds`.
 */
export type CollatzBranch = "E" | "O";
export interface CollatzAffineTrace {
    readonly kind: "collatz.affineTrace";
    readonly A: number;
    readonly B: number;
    readonly C: number;
}
/** The accelerated Collatz map: even `n/2`, odd `(3n+1)/2`. */
export declare function step(n: number): number;
/** The branch selected by the accelerated map. */
export declare function branch(n: number): CollatzBranch;
/** The iterate `T^k(n)`. */
export declare function orbit(seed: number, length: number): number;
/** The parity word of the first `length` accelerated steps. */
export declare function parityWord(seed: number, length: number): readonly CollatzBranch[];
/** Count the odd branches in a parity word. */
export declare function oddCount(word: readonly CollatzBranch[]): number;
export declare const identityTrace: CollatzAffineTrace;
export declare const evenTrace: CollatzAffineTrace;
export declare const oddTrace: CollatzAffineTrace;
/** Compose affine traces: `g.comp f` realizes "`f` then `g`". */
export declare function composeTrace(g: CollatzAffineTrace, f: CollatzAffineTrace): CollatzAffineTrace;
/** Advance an affine trace by one parity letter. */
export declare function traceStep(trace: CollatzAffineTrace, letter: CollatzBranch): CollatzAffineTrace;
/** Accumulate the affine trace of a finite parity word. */
export declare function traceOfWord(word: readonly CollatzBranch[]): CollatzAffineTrace;
export interface AffineTraceOrbitWitness {
    readonly kind: "collatz.affineTraceParityWord:witness";
    readonly seed: number;
    readonly length: number;
    readonly word: readonly CollatzBranch[];
    readonly trace: CollatzAffineTrace;
    readonly iterate: number;
    readonly lhs: number;
    readonly rhs: number;
    readonly holds: boolean;
    readonly coefficientContracting: boolean;
    readonly descends: boolean;
}
/** Lean `affine_trace_parityWord`: `B_w*T^k(n)=A_w*n+C_w`, as a finite witness. */
export declare function affineTraceParityWord(seed: number, length: number): AffineTraceOrbitWitness;
export interface FirstPassageWitness {
    readonly kind: "collatz.firstPassage:witness";
    readonly word: readonly CollatzBranch[];
    readonly trace: CollatzAffineTrace;
    readonly contracting: boolean;
    readonly properPrefixesNoncontracting: boolean;
    readonly last: CollatzBranch;
    readonly endsInE: boolean;
    readonly lowerPower: number;
    readonly middlePower: number;
    readonly upperPower: number;
}
export interface FirstPassageObstruction {
    readonly kind: "collatz.firstPassage-obstruction";
    readonly word: readonly CollatzBranch[];
    readonly trace: CollatzAffineTrace;
    readonly contracting: boolean;
    readonly properPrefixesNoncontracting: boolean;
    readonly reason: "empty" | "not-contracting" | "prefix-contracts";
}
export type FirstPassageJudgment = FirstPassageWitness | FirstPassageObstruction;
export declare function coefficientContracting(word: readonly CollatzBranch[]): boolean;
export declare function coefficientNoncontracting(word: readonly CollatzBranch[]): boolean;
/** Lean `FirstPassageWord`: the first prefix where `A < B`. */
export declare function firstPassageWord(word: readonly CollatzBranch[]): FirstPassageJudgment;
export interface ParentBarrierWitness {
    readonly kind: "collatz.parentBarrier:witness";
    readonly word: readonly CollatzBranch[];
    readonly trace: CollatzAffineTrace;
    readonly noncontracting: boolean;
    readonly belowNextEvenCrossing: boolean;
    readonly properPrefixesNoncontracting: boolean;
    readonly appendEFirstPassage: boolean;
    readonly D: number;
    readonly M: number;
}
export interface ParentBarrierObstruction {
    readonly kind: "collatz.parentBarrier-obstruction";
    readonly word: readonly CollatzBranch[];
    readonly trace: CollatzAffineTrace;
    readonly noncontracting: boolean;
    readonly belowNextEvenCrossing: boolean;
    readonly properPrefixesNoncontracting: boolean;
    readonly reason: "contracting" | "beyond-next-even-crossing" | "prefix-contracts";
}
export type ParentBarrierJudgment = ParentBarrierWitness | ParentBarrierObstruction;
/** Lean `ParentBarrier`: `B ≤ A < 2B`, with every proper prefix noncontracting. */
export declare function parentBarrier(word: readonly CollatzBranch[]): ParentBarrierJudgment;
export interface TwoAdicFactorWitness {
    readonly kind: "collatz.twoAdicFactor:witness";
    readonly value: number;
    readonly exponent: number;
    readonly oddPart: number;
    readonly holds: boolean;
}
/** Factor a positive integer as `2^k * odd`. */
export declare function twoAdicFactor(value: number): TwoAdicFactorWitness;
export interface ShortcutOddPartWitness {
    readonly kind: "collatz.shortcutOddPart:witness";
    readonly seed: number;
    readonly expanded: number;
    readonly value: number;
    readonly exponent: number;
    readonly oddPart: number;
    readonly holds: boolean;
    readonly nonemptyHalvingRun: boolean;
}
/** For odd `n`, factor `3n+1 = 2^k*m` with `k ≥ 1` and odd `m`. */
export declare function shortcutOddPart(seed: number): ShortcutOddPartWitness;
/** Distinct values reached before stage `length`. */
export declare function reachedSet(seed: number, length: number): readonly number[];
export interface ReachedQuiescenceWitness {
    readonly kind: "collatz.reachedQuiescence:witness";
    readonly seed: number;
    readonly stage: number;
    readonly reached: readonly number[];
    readonly nextReached: readonly number[];
    readonly quiesces: boolean;
    readonly revisitAt: number;
    readonly terminal: boolean;
}
export interface ReachedQuiescenceObstruction {
    readonly kind: "collatz.reachedQuiescence-obstruction";
    readonly seed: number;
    readonly stage: number;
    readonly reached: readonly number[];
    readonly nextReached: readonly number[];
    readonly quiesces: boolean;
}
export type ReachedQuiescenceJudgment = ReachedQuiescenceWitness | ReachedQuiescenceObstruction;
/** Finite reached-set quiescence: stage `k+1` reaches nothing new. */
export declare function reachedQuiescence(seed: number, stage: number): ReachedQuiescenceJudgment;
/** Membership in the two-generator semigroup `<a,b>`, searched finitely up to `x`. */
export declare function inTwoGenSemigroup(x: number, a: number, b: number): boolean;
export interface ResidueCharacterizationWitness {
    readonly kind: "collatz.residueCharacterization:witness";
    readonly sourceModule: "RelMath.Closure.Collatz.ResidueGap";
    readonly C: number;
    readonly D: number;
    readonly M: number;
    readonly residue: number;
    readonly semigroupMember: boolean;
    readonly residueInequality: boolean;
    readonly equivalent: boolean;
    readonly gap: number;
}
/** Finite residue characterization: `C ∈ <D,M>` iff `D*r ≤ C` for coprime `D,M`. */
export declare function residueCharacterization(C: number, D: number, M: number): ResidueCharacterizationWitness;
/** Padovan/Perrin sequence `1,1,1,2,2,3,...`. */
export declare function padovan(index: number): number;
/** Fibonacci sequence in the Lean convention `1,1,2,3,5,...`. */
export declare function fibSeq(index: number): number;
export interface PadovanLeFibWitness {
    readonly kind: "collatz.padovanLeFibSeq:witness";
    readonly sourceModule: "RelMath.Closure.Collatz.PadovanShape";
    readonly index: number;
    readonly padovan: number;
    readonly fibSeq: number;
    readonly holds: boolean;
}
export interface SemigroupGapReceipt {
    readonly kind: "collatz.semigroupGap.receipt:witness";
    readonly sourceModule: "RelMath.Closure.Collatz.SemigroupGap";
    readonly provenTheorems: readonly [
        "nonDescent_iff_semigroup_certificate",
        "parentBarrierGap_implies_firstPassageDescent"
    ];
    readonly frontierTheorem: "parentBarrierGap_holds";
    readonly parent: ParentBarrierWitness;
    readonly residue: ResidueCharacterizationWitness;
    readonly conditionalDescent: true;
    readonly gapStatus: "frontier-sorry-in-Lean";
}
/** Lean `padovan_le_fibSeq`: the plastic integer shadow is bounded by Fibonacci. */
export declare function padovanLeFibSeq(index: number): PadovanLeFibWitness;
export declare function semigroupGapReceipt(word?: readonly CollatzBranch[]): SemigroupGapReceipt;
//# sourceMappingURL=collatz.d.mts.map