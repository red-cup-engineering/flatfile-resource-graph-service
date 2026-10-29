/**
 * settling/dynamics/substitution/sofic — the sofic SFT cover of a substitution.
 *
 * A substitution tiling is SOFIC: it is a factor (forget a finite decoration) of a SHIFT OF FINITE
 * TYPE — a system defined by finitely many local matching rules / Wang adjacencies (Goodman-Strauss
 * 1998; Vereshchagin 2026: every finite-local-complexity substitution is sofic). This module builds the
 * canonical 1-block transition presentation: the SFT over the substitution's own alphabet whose allowed
 * transition `x → y` is exactly the pair `xy` that occurs consecutively in the substitution's language.
 * Its topological entropy is `log₂` of the Perron eigenvalue of the transition matrix — the genuine
 * entropy of the cover (which upper-bounds the zero entropy of the substitution subshift).
 *
 * Bounded: the 1-block follower SFT, the forgetful map the identity on letters. The genuine DECORATED
 * cover — a non-trivial forgetful map whose decorations carry the supertile hierarchy (the Mozes /
 * Goodman-Strauss construction) — is the deeper frontier and is not built here.
 *
 * @packageDocumentation
 */
import { type SubstitutionRule, type SubstitutionSymbol } from "./index.mjs";
import { type Matrix } from "../../analysis/exact-number.mjs";
/** A shift of finite type over a finite alphabet: a `0/1` transition matrix `transitions[i][j] = 1`
 *  iff symbol `i` may be immediately followed by symbol `j` (the local matching rule / Wang adjacency). */
export interface ShiftOfFiniteType {
    readonly kind: "substitution.dynamics.sofic.sft";
    readonly alphabet: readonly SubstitutionSymbol[];
    readonly transitions: Matrix;
}
/** The 1-block (follower-set) SFT COVER of a substitution: the same alphabet, with `x → y` allowed
 *  exactly when `xy` occurs consecutively in a deep iterate (inflated until at least `sampleLength`
 *  tiles, so every admissible pair appears even for slow-growing rules; for a primitive rule the
 *  follower set then stabilises). The substitution subshift is a factor of this SFT. */
export declare function substitutionCoverSFT(substitution: SubstitutionRule, alphabet: readonly SubstitutionSymbol[], sampleLength?: number): ShiftOfFiniteType;
/** The TOPOLOGICAL ENTROPY of a shift of finite type: `log₂` of the Perron eigenvalue of its transition
 *  matrix (the growth rate of admissible words). The entropy of the substitution's SFT cover — an upper
 *  bound on the (zero) entropy of the substitution subshift it factors onto. */
export declare function sftEntropy(sft: ShiftOfFiniteType): number;
/** The pairs FORBIDDEN by the SFT — the local matching rules, as the `(from, to)` symbol-index pairs
 *  with no allowed transition. A substitution is sofic precisely because finitely many such forbidden
 *  pairs (a finite-type constraint) suffice to present its cover. */
export declare function forbiddenPairs(sft: ShiftOfFiniteType): readonly (readonly [number, number])[];
//# sourceMappingURL=sofic.d.mts.map