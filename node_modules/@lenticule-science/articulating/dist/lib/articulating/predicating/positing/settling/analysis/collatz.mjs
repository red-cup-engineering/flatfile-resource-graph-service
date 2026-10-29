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
const nat = (value, label) => {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new RangeError(`${label} must be a non-negative safe integer`);
    return value;
};
const posNat = (value, label) => {
    nat(value, label);
    if (value === 0)
        throw new RangeError(`${label} must be positive`);
    return value;
};
const pow = (base, exponent) => {
    nat(exponent, "exponent");
    return base ** exponent;
};
/** The accelerated Collatz map: even `n/2`, odd `(3n+1)/2`. */
export function step(n) {
    nat(n, "n");
    return n % 2 === 0 ? n / 2 : (3 * n + 1) / 2;
}
/** The branch selected by the accelerated map. */
export function branch(n) {
    nat(n, "n");
    return n % 2 === 0 ? "E" : "O";
}
/** The iterate `T^k(n)`. */
export function orbit(seed, length) {
    nat(seed, "seed");
    nat(length, "length");
    let value = seed;
    for (let index = 0; index < length; index += 1)
        value = step(value);
    return value;
}
/** The parity word of the first `length` accelerated steps. */
export function parityWord(seed, length) {
    nat(seed, "seed");
    nat(length, "length");
    const word = [];
    let value = seed;
    for (let index = 0; index < length; index += 1) {
        word.push(branch(value));
        value = step(value);
    }
    return Object.freeze(word);
}
/** Count the odd branches in a parity word. */
export function oddCount(word) {
    return word.filter((item) => item === "O").length;
}
export const identityTrace = Object.freeze({ kind: "collatz.affineTrace", A: 1, B: 1, C: 0 });
export const evenTrace = Object.freeze({ kind: "collatz.affineTrace", A: 1, B: 2, C: 0 });
export const oddTrace = Object.freeze({ kind: "collatz.affineTrace", A: 3, B: 2, C: 1 });
/** Compose affine traces: `g.comp f` realizes "`f` then `g`". */
export function composeTrace(g, f) {
    return Object.freeze({
        kind: "collatz.affineTrace",
        A: g.A * f.A,
        B: g.B * f.B,
        C: g.A * f.C + f.B * g.C,
    });
}
/** Advance an affine trace by one parity letter. */
export function traceStep(trace, letter) {
    return Object.freeze(letter === "E"
        ? { kind: "collatz.affineTrace", A: trace.A, B: 2 * trace.B, C: trace.C }
        : { kind: "collatz.affineTrace", A: 3 * trace.A, B: 2 * trace.B, C: 3 * trace.C + trace.B });
}
/** Accumulate the affine trace of a finite parity word. */
export function traceOfWord(word) {
    return word.reduce((trace, letter) => traceStep(trace, letter), identityTrace);
}
/** Lean `affine_trace_parityWord`: `B_w*T^k(n)=A_w*n+C_w`, as a finite witness. */
export function affineTraceParityWord(seed, length) {
    const word = parityWord(seed, length);
    const trace = traceOfWord(word);
    const iterate = orbit(seed, length);
    const lhs = trace.B * iterate;
    const rhs = trace.A * seed + trace.C;
    return Object.freeze({
        kind: "collatz.affineTraceParityWord:witness",
        seed,
        length,
        word,
        trace,
        iterate,
        lhs,
        rhs,
        holds: lhs === rhs,
        coefficientContracting: trace.A < trace.B,
        descends: iterate < seed,
    });
}
export function coefficientContracting(word) {
    const trace = traceOfWord(word);
    return trace.A < trace.B;
}
export function coefficientNoncontracting(word) {
    const trace = traceOfWord(word);
    return trace.B <= trace.A;
}
const properPrefixesNoncontracting = (word) => word.every((_, index) => coefficientNoncontracting(word.slice(0, index)));
/** Lean `FirstPassageWord`: the first prefix where `A < B`. */
export function firstPassageWord(word) {
    const frozen = Object.freeze([...word]);
    const trace = traceOfWord(frozen);
    const contracting = trace.A < trace.B;
    const prefixes = properPrefixesNoncontracting(frozen);
    if (frozen.length === 0) {
        return Object.freeze({ kind: "collatz.firstPassage-obstruction", word: frozen, trace, contracting, properPrefixesNoncontracting: prefixes, reason: "empty" });
    }
    if (!contracting) {
        return Object.freeze({ kind: "collatz.firstPassage-obstruction", word: frozen, trace, contracting, properPrefixesNoncontracting: prefixes, reason: "not-contracting" });
    }
    if (!prefixes) {
        return Object.freeze({ kind: "collatz.firstPassage-obstruction", word: frozen, trace, contracting, properPrefixesNoncontracting: prefixes, reason: "prefix-contracts" });
    }
    return Object.freeze({
        kind: "collatz.firstPassage:witness",
        word: frozen,
        trace,
        contracting,
        properPrefixesNoncontracting: prefixes,
        last: frozen[frozen.length - 1],
        endsInE: frozen[frozen.length - 1] === "E",
        lowerPower: pow(2, frozen.length - 1),
        middlePower: pow(3, oddCount(frozen)),
        upperPower: pow(2, frozen.length),
    });
}
/** Lean `ParentBarrier`: `B ≤ A < 2B`, with every proper prefix noncontracting. */
export function parentBarrier(word) {
    const frozen = Object.freeze([...word]);
    const trace = traceOfWord(frozen);
    const noncontracting = trace.B <= trace.A;
    const belowNextEvenCrossing = trace.A < 2 * trace.B;
    const prefixes = properPrefixesNoncontracting(frozen);
    if (noncontracting && belowNextEvenCrossing && prefixes) {
        return Object.freeze({
            kind: "collatz.parentBarrier:witness",
            word: frozen,
            trace,
            noncontracting,
            belowNextEvenCrossing,
            properPrefixesNoncontracting: prefixes,
            appendEFirstPassage: firstPassageWord([...frozen, "E"]).kind === "collatz.firstPassage:witness",
            D: 2 * trace.B - trace.A,
            M: 2 * trace.B,
        });
    }
    return Object.freeze({
        kind: "collatz.parentBarrier-obstruction",
        word: frozen,
        trace,
        noncontracting,
        belowNextEvenCrossing,
        properPrefixesNoncontracting: prefixes,
        reason: !noncontracting ? "contracting" : !belowNextEvenCrossing ? "beyond-next-even-crossing" : "prefix-contracts",
    });
}
/** Factor a positive integer as `2^k * odd`. */
export function twoAdicFactor(value) {
    posNat(value, "value");
    let exponent = 0;
    let oddPart = value;
    while (oddPart % 2 === 0) {
        exponent += 1;
        oddPart /= 2;
    }
    return Object.freeze({
        kind: "collatz.twoAdicFactor:witness",
        value,
        exponent,
        oddPart,
        holds: pow(2, exponent) * oddPart === value && oddPart % 2 === 1,
    });
}
/** For odd `n`, factor `3n+1 = 2^k*m` with `k ≥ 1` and odd `m`. */
export function shortcutOddPart(seed) {
    posNat(seed, "seed");
    if (seed % 2 !== 1)
        throw new RangeError("shortcutOddPart: seed must be odd");
    const expanded = 3 * seed + 1;
    const factor = twoAdicFactor(expanded);
    return Object.freeze({
        kind: "collatz.shortcutOddPart:witness",
        seed,
        expanded,
        value: expanded,
        exponent: factor.exponent,
        oddPart: factor.oddPart,
        holds: factor.holds,
        nonemptyHalvingRun: factor.exponent >= 1,
    });
}
/** Distinct values reached before stage `length`. */
export function reachedSet(seed, length) {
    nat(seed, "seed");
    nat(length, "length");
    const reached = new Set();
    for (let index = 0; index < length; index += 1)
        reached.add(orbit(seed, index));
    return Object.freeze([...reached].sort((left, right) => left - right));
}
/** Finite reached-set quiescence: stage `k+1` reaches nothing new. */
export function reachedQuiescence(seed, stage) {
    posNat(seed, "seed");
    nat(stage, "stage");
    const reached = reachedSet(seed, stage);
    const nextReached = reachedSet(seed, stage + 1);
    const quiesces = reached.length === nextReached.length && reached.every((value, index) => value === nextReached[index]);
    if (!quiesces) {
        return Object.freeze({ kind: "collatz.reachedQuiescence-obstruction", seed, stage, reached, nextReached, quiesces });
    }
    const value = orbit(seed, stage);
    const revisitAt = reached.indexOf(value);
    return Object.freeze({
        kind: "collatz.reachedQuiescence:witness",
        seed,
        stage,
        reached,
        nextReached,
        quiesces,
        revisitAt,
        terminal: value === 1 || value === 2,
    });
}
/** Membership in the two-generator semigroup `<a,b>`, searched finitely up to `x`. */
export function inTwoGenSemigroup(x, a, b) {
    nat(x, "x");
    posNat(a, "a");
    posNat(b, "b");
    for (let m = 0; a * m <= x; m += 1) {
        const rest = x - a * m;
        if (rest % b === 0)
            return true;
    }
    return false;
}
const gcd = (left, right) => {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b !== 0)
        [a, b] = [b, a % b];
    return a;
};
/** Finite residue characterization: `C ∈ <D,M>` iff `D*r ≤ C` for coprime `D,M`. */
export function residueCharacterization(C, D, M) {
    nat(C, "C");
    posNat(D, "D");
    posNat(M, "M");
    if (gcd(D, M) !== 1)
        throw new RangeError("residueCharacterization: D and M must be coprime");
    let residue = 0;
    while ((D * residue) % M !== C % M)
        residue += 1;
    const semigroupMember = inTwoGenSemigroup(C, D, M);
    const residueInequality = D * residue <= C;
    return Object.freeze({
        kind: "collatz.residueCharacterization:witness",
        sourceModule: "RelMath.Closure.Collatz.ResidueGap",
        C,
        D,
        M,
        residue,
        semigroupMember,
        residueInequality,
        equivalent: semigroupMember === residueInequality,
        gap: D * residue - C,
    });
}
/** Padovan/Perrin sequence `1,1,1,2,2,3,...`. */
export function padovan(index) {
    nat(index, "index");
    const values = [1, 1, 1];
    for (let current = 3; current <= index; current += 1)
        values[current] = values[current - 2] + values[current - 3];
    return values[index];
}
/** Fibonacci sequence in the Lean convention `1,1,2,3,5,...`. */
export function fibSeq(index) {
    nat(index, "index");
    const values = [1, 1];
    for (let current = 2; current <= index; current += 1)
        values[current] = values[current - 1] + values[current - 2];
    return values[index];
}
/** Lean `padovan_le_fibSeq`: the plastic integer shadow is bounded by Fibonacci. */
export function padovanLeFibSeq(index) {
    return Object.freeze({
        kind: "collatz.padovanLeFibSeq:witness",
        sourceModule: "RelMath.Closure.Collatz.PadovanShape",
        index,
        padovan: padovan(index),
        fibSeq: fibSeq(index),
        holds: padovan(index) <= fibSeq(index),
    });
}
export function semigroupGapReceipt(word = ["O"]) {
    const parent = parentBarrier(word);
    if (parent.kind !== "collatz.parentBarrier:witness") {
        throw new TypeError("semigroupGapReceipt: expected a parent-barrier word");
    }
    const residue = residueCharacterization(parent.trace.C, parent.D, parent.M);
    return Object.freeze({
        kind: "collatz.semigroupGap.receipt:witness",
        sourceModule: "RelMath.Closure.Collatz.SemigroupGap",
        provenTheorems: Object.freeze([
            "nonDescent_iff_semigroup_certificate",
            "parentBarrierGap_implies_firstPassageDescent",
        ]),
        frontierTheorem: "parentBarrierGap_holds",
        parent,
        residue,
        conditionalDescent: true,
        gapStatus: "frontier-sorry-in-Lean",
    });
}
//# sourceMappingURL=collatz.mjs.map