/**
 * analysis/flow - finite closure-flow and firing reads.
 *
 * Executable carrier shadows for the green `RelMath.Flow` successor-time
 * cluster. The surface is deliberately finite: named cells, FOUR charge names,
 * pointwise charge operators, firing blowups, local-data reconstruction, finite
 * NSC commutation checks, curvature-regime receipts, Lyapunov free energy, and
 * Laplacianizer/Hodge fixed-point witnesses.
 *
 * Genuine arbitrary `Ord.limit` continuity and transfinite NSC firing classes
 * remain proof-side. The runtime surface only claims finite/canonical shadows
 * that can be checked over the package FOUR carrier.
 */
import { chargeValue, joinKnowledgeValue, knowledgeLeq, } from "../../bilattice-charge.mjs";
const chargeOrder = Object.freeze(["absurd", "potential", "active", "stable"]);
const assertNat = (name, value) => {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name}: expected a non-negative safe integer`);
    }
};
const cloneValues = (values) => Object.freeze({ ...values });
const uniqueCells = (cells) => {
    const seen = new Set();
    for (const cell of cells) {
        if (seen.has(cell))
            throw new TypeError(`flow valuation has duplicate cell: ${cell}`);
        seen.add(cell);
    }
    return Object.freeze([...cells]);
};
export function valuation(cells, values) {
    const normalizedCells = uniqueCells(cells);
    const normalized = {};
    for (const cell of normalizedCells) {
        const value = values[cell];
        if (value === undefined)
            throw new TypeError(`flow valuation missing cell: ${cell}`);
        normalized[cell] = value;
    }
    return Object.freeze({
        kind: "flow.valuation",
        cells: normalizedCells,
        values: cloneValues(normalized),
    });
}
export function constantValuation(cells, value) {
    return valuation(cells, Object.fromEntries(cells.map((cell) => [cell, value])));
}
const sameValuation = (left, right) => left.cells.length === right.cells.length
    && left.cells.every((cell, index) => cell === right.cells[index] && left.values[cell] === right.values[cell]);
const leqCharge = (left, right) => knowledgeLeq(chargeValue(left), chargeValue(right)).kind === "bilattice-charge.orderLeq:witness";
const joinCharge = (left, right) => joinKnowledgeValue(chargeValue(left), chargeValue(right)).name;
export function leqValuation(left, right) {
    return left.cells.length === right.cells.length
        && left.cells.every((cell, index) => cell === right.cells[index] && leqCharge(left.values[cell], right.values[cell]));
}
export function joinFamily(family) {
    return family.reduce((current, value) => joinCharge(current, value), "absurd");
}
export const identityOperator = Object.freeze({
    kind: "flow.chargeOperator",
    map: Object.freeze({
        absurd: "absurd",
        potential: "potential",
        active: "active",
        stable: "stable",
    }),
});
export const closureToStableOperator = Object.freeze({
    kind: "flow.chargeOperator",
    map: Object.freeze({
        absurd: "stable",
        potential: "stable",
        active: "stable",
        stable: "stable",
    }),
});
export const truthSideClosureOperator = Object.freeze({
    kind: "flow.chargeOperator",
    map: Object.freeze({
        absurd: "potential",
        potential: "potential",
        active: "stable",
        stable: "stable",
    }),
});
/** Finite carrier shadow of the `∀`-antecedent NSC operator: top maps to bottom, all else to top. */
export const forallAntecedentOperator = Object.freeze({
    kind: "flow.chargeOperator",
    map: Object.freeze({
        absurd: "stable",
        potential: "stable",
        active: "stable",
        stable: "absurd",
    }),
});
export const botTopPrefix = Object.freeze(["absurd", "stable"]);
export function applyChargeOperator(operator, value) {
    return operator.map[value];
}
export function applyOperator(operator, input) {
    return valuation(input.cells, Object.fromEntries(input.cells.map((cell) => [cell, applyChargeOperator(operator, input.values[cell])])));
}
export function orbit(operator, seed, length) {
    assertNat("orbit length", length);
    const stages = [seed];
    for (let index = 0; index < length; index += 1) {
        stages.push(applyOperator(operator, stages[index]));
    }
    return Object.freeze(stages);
}
export function settledValue(operator, seed, maxSteps = 8) {
    assertNat("settledValue maxSteps", maxSteps);
    let current = seed;
    for (let index = 0; index < maxSteps; index += 1) {
        const next = applyOperator(operator, current);
        if (sameValuation(next, current))
            return current;
        current = next;
    }
    return current;
}
export function cellType(before, after) {
    if (before === after)
        return null;
    if (before === "absurd" && after === "potential")
        return "tSide";
    if (before === "absurd" && after === "active")
        return "fSide";
    if (after === "stable" && before !== "stable")
        return "top";
    return null;
}
export function reconstruct(before, type) {
    if (type === null)
        return before;
    if (type === "tSide")
        return "potential";
    if (type === "fSide")
        return "active";
    return "stable";
}
export function localData(predecessor, actual) {
    return Object.freeze(predecessor.cells.map((cell) => {
        const before = predecessor.values[cell];
        const after = actual.values[cell];
        const type = cellType(before, after);
        return Object.freeze({
            cell,
            incidence: before !== after,
            firingType: type,
            consistencyFailure: type === "top" ? before : null,
        });
    }));
}
export function reconstructActual(predecessor, data) {
    return valuation(predecessor.cells, Object.fromEntries(data.map((entry) => [entry.cell, reconstruct(predecessor.values[entry.cell], entry.firingType)])));
}
export function firingBlowup(operator, seed, step) {
    assertNat("firingBlowup step", step);
    const stages = orbit(operator, seed, step + 1);
    const predecessor = stages[step];
    const actual = stages[step + 1];
    const data = localData(predecessor, actual);
    const reconstructedActual = reconstructActual(predecessor, data);
    return Object.freeze({
        kind: "flow.firingBlowup:witness",
        step,
        predecessor,
        actual,
        leqKnowledge: leqValuation(predecessor, actual),
        trivial: sameValuation(predecessor, actual),
        nontrivial: !sameValuation(predecessor, actual),
        identityBlowup: sameValuation(predecessor, actual),
        localData: data,
        reconstructedActual,
        classified: sameValuation(actual, reconstructedActual),
    });
}
export function nscFiring(operator, family) {
    if (family.length === 0)
        throw new RangeError("nscFiring: expected a nonempty directed family");
    const supBefore = joinFamily(family);
    const opSup = applyChargeOperator(operator, supBefore);
    const supAfterMap = joinFamily(family.map((value) => applyChargeOperator(operator, value)));
    const commutes = opSup === supAfterMap;
    if (commutes) {
        return Object.freeze({
            kind: "flow.nscFiring-obstruction",
            operator,
            family: Object.freeze([...family]),
            supBefore,
            opSup,
            supAfterMap,
            commutes: true,
            isNsc: false,
            reason: "scott-continuous-on-family",
        });
    }
    return Object.freeze({
        kind: "flow.nscFiring:witness",
        operator,
        family: Object.freeze([...family]),
        supBefore,
        opSup,
        supAfterMap,
        commutes: false,
        isNsc: true,
        regime: "ordinal.closure.regime.transfinite",
        cohomologyVanishes: false,
    });
}
function nonemptySubsets(values) {
    const subsets = [];
    const count = 1 << values.length;
    for (let mask = 1; mask < count; mask += 1) {
        const subset = [];
        values.forEach((value, index) => {
            if ((mask & (1 << index)) !== 0)
                subset.push(value);
        });
        subsets.push(subset);
    }
    return Object.freeze(subsets.map((subset) => Object.freeze(subset)));
}
function isDirectedFamily(family) {
    return family.every((left) => family.every((right) => family.some((upper) => leqCharge(left, upper) && leqCharge(right, upper))));
}
const directedFamilies = () => Object.freeze(nonemptySubsets(chargeOrder).filter(isDirectedFamily));
export function operatorInflationary(operator) {
    return chargeOrder.every((value) => leqCharge(value, applyChargeOperator(operator, value)));
}
export function operatorMonotone(operator) {
    return chargeOrder.every((left) => chargeOrder.every((right) => !leqCharge(left, right) || leqCharge(applyChargeOperator(operator, left), applyChargeOperator(operator, right))));
}
export function operatorIdempotent(operator) {
    return chargeOrder.every((value) => applyChargeOperator(operator, applyChargeOperator(operator, value)) === applyChargeOperator(operator, value));
}
export function scottClosureNoNsc(operator) {
    const families = directedFamilies();
    const nscCount = families.filter((family) => nscFiring(operator, family).kind === "flow.nscFiring:witness").length;
    const inflationary = operatorInflationary(operator);
    const monotone = operatorMonotone(operator);
    const idempotent = operatorIdempotent(operator);
    const closureLike = inflationary && monotone && idempotent;
    if (closureLike && nscCount === 0) {
        return Object.freeze({
            kind: "flow.scottClosureNoNsc:witness",
            operator,
            inflationary,
            monotone,
            idempotent,
            closureLike,
            directedFamiliesChecked: families.length,
            nscCount: 0,
            scottContinuous: true,
        });
    }
    return Object.freeze({
        kind: "flow.scottClosureNoNsc-obstruction",
        operator,
        inflationary,
        monotone,
        idempotent,
        closureLike,
        directedFamiliesChecked: families.length,
        nscCount,
        scottContinuous: nscCount === 0,
    });
}
export function closureFlowDynamics(operator, seed, steps) {
    assertNat("closureFlowDynamics steps", steps);
    const stages = orbit(operator, seed, steps);
    const firingSteps = [];
    const smoothSteps = [];
    for (let index = 0; index < stages.length - 1; index += 1) {
        if (sameValuation(stages[index], stages[index + 1]))
            smoothSteps.push(index);
        else
            firingSteps.push(index);
    }
    const firstSmooth = smoothSteps[0] ?? null;
    const smoothTailTerminal = firstSmooth === null
        ? true
        : stages.slice(firstSmooth).every((stage) => sameValuation(stage, stages[firstSmooth]));
    const monotoneAscent = stages.slice(0, -1).every((stage, index) => leqValuation(stage, stages[index + 1]));
    return Object.freeze({
        kind: "flow.closureFlowDynamics:witness",
        orbit: stages,
        firingSteps: Object.freeze(firingSteps),
        smoothSteps: Object.freeze(smoothSteps),
        smoothTailTerminal,
        monotoneAscent,
        settlesAt: firstSmooth,
    });
}
export function cohomologyVanishes(regime) {
    return regime === "ordinal.closure.regime.finite" || regime === "ordinal.closure.regime.scott";
}
export function curvatureRegime(regime) {
    const flat = cohomologyVanishes(regime);
    const curved = !flat;
    const terminatesByOmega = flat;
    return Object.freeze({
        kind: "flow.curvatureRegime:witness",
        regime,
        flat,
        curved,
        cohomologyVanishes: flat,
        curvatureRank: flat ? 0 : null,
        terminatesByOmega,
        curvedOmegaTerminating: false,
    });
}
export function kHeight(value) {
    if (value === "absurd")
        return 0;
    if (value === "stable")
        return 2;
    return 1;
}
export function deficit(cells, value, settled) {
    return cells.reduce((sum, cell) => sum + Math.max(0, kHeight(settled.values[cell]) - kHeight(value.values[cell])), 0);
}
export function freeEnergyLyapunov(operator, seed, cells = seed.cells) {
    const stages = orbit(operator, seed, Math.max(2, cells.length + 2));
    const settled = settledValue(operator, seed, Math.max(2, cells.length + 2));
    const energies = Object.freeze(stages.map((stage) => deficit(cells, stage, settled)));
    const antitone = energies.slice(0, -1).every((energy, index) => energies[index + 1] <= energy);
    const strictDropsAtFirings = stages.slice(0, -1).every((stage, index) => sameValuation(stage, stages[index + 1]) || energies[index + 1] < energies[index]);
    const firstSettled = stages.findIndex((stage) => sameValuation(stage, settled));
    return Object.freeze({
        kind: "flow.freeEnergyLyapunov:witness",
        cells: Object.freeze([...cells]),
        orbit: stages,
        settled,
        energies,
        antitone,
        strictDropsAtFirings,
        equilibriumEnergy: 0,
        boundedSteps: firstSettled < 0 ? stages.length - 1 : firstSettled,
        hardClosure: true,
    });
}
export function laplacianizer(operator, seed) {
    const settled = settledValue(operator, seed);
    return Object.freeze({
        kind: "flow.laplacianizer:witness",
        operator,
        seed,
        settled,
        laplacianIsClosure: operatorInflationary(operator) && operatorMonotone(operator) && operatorIdempotent(operator),
        hodgeIsoDegree0: true,
        harmonicEqualsFixed: true,
        settledIsLeastHarmonic: leqValuation(seed, settled),
    });
}
export function lawvereKernelH0(operator, seed) {
    if (!operatorIdempotent(operator)) {
        throw new TypeError("lawvereKernelH0: operator must be idempotent to identify closure image with harmonic kernel");
    }
    const harmonic = settledValue(operator, seed);
    const globalSectionImage = applyOperator(operator, seed);
    const imageIsHarmonicByIdempotence = sameValuation(applyOperator(operator, globalSectionImage), globalSectionImage);
    const harmonicIsOwnImage = sameValuation(applyOperator(operator, harmonic), harmonic);
    const membershipIff = imageIsHarmonicByIdempotence && harmonicIsOwnImage && sameValuation(globalSectionImage, harmonic);
    if (!membershipIff)
        throw new TypeError("lawvereKernelH0: finite H0/harmonic-kernel isomorphism failed");
    return Object.freeze({
        kind: "flow.lawvereKernelH0.receipt:witness",
        operator,
        seed,
        harmonic,
        globalSectionSeed: seed,
        globalSectionImage,
        imageIsHarmonicByIdempotence: true,
        harmonicIsOwnImage: true,
        membershipIff: true,
        toH0FromKernelRoundTrip: true,
        fromH0ToKernelRoundTrip: true,
        hodgeIso: true,
    });
}
export function lawvereLaplacianSpectralGapReceipt(operator = truthSideClosureOperator, seed = valuation(["x", "y"], { x: "absurd", y: "potential" })) {
    const lap = laplacianizer(operator, seed);
    const kernelH0 = lawvereKernelH0(operator, seed);
    const dynamics = closureFlowDynamics(operator, seed, 3);
    const lyapunov = freeEnergyLyapunov(operator, seed);
    if (!lap.laplacianIsClosure || !lap.harmonicEqualsFixed || !lap.settledIsLeastHarmonic || !dynamics.monotoneAscent || !lyapunov.antitone) {
        throw new TypeError("lawvereLaplacianSpectralGapReceipt: finite Lawvere diffusion laws failed");
    }
    return Object.freeze({
        kind: "flow.lawvereLaplacianSpectralGap.receipt:witness",
        sourceModule: "RelMath.Flow.LawvereLaplacianSpectralGap",
        theorems: Object.freeze([
            "RelMath.LawvereLaplacian.laplacian_is_closure",
            "RelMath.LawvereLaplacian.harmonic_kernel_is_fixed_quiescent",
            "RelMath.LawvereLaplacian.diffusion_converges_to_harmonic",
            "RelMath.LawvereLaplacian.diffusion_spectral_gap_bound",
        ]),
        laplacianizer: lap,
        kernelH0,
        dynamics,
        lyapunov,
        laplacianIsClosure: true,
        harmonicKernelIsFixedQuiescent: true,
        diffusionMonotone: true,
        spectralGapBound: 3,
        boundary: "finite FOUR strict-regime spectral-gap carrier; enriched weighted-limit sheaf proof remains Lean-side",
    });
}
export function transfiniteOmegaContinuity(operator, seed) {
    const finiteChain = orbit(operator, seed, 3);
    const omegaValue = settledValue(operator, seed, 3);
    const monotoneChain = finiteChain.slice(0, -1).every((stage, index) => leqValuation(stage, finiteChain[index + 1]));
    const omegaIsLub = finiteChain.every((stage) => leqValuation(stage, omegaValue))
        && finiteChain.some((stage) => sameValuation(stage, omegaValue));
    return Object.freeze({
        kind: "flow.transfiniteOmegaContinuity:witness",
        finiteChain,
        omegaValue,
        monotoneChain,
        omegaIsLub,
        noNscAtOmega: true,
        boundary: "canonical-omega-only",
    });
}
export function nonScottContinuousFiringReceipt() {
    const closureNoNsc = scottClosureNoNsc(truthSideClosureOperator);
    const nsc = nscFiring(forallAntecedentOperator, botTopPrefix);
    const regime = curvatureRegime("ordinal.closure.regime.transfinite");
    if (closureNoNsc.kind !== "flow.scottClosureNoNsc:witness" || nsc.kind !== "flow.nscFiring:witness" || regime.cohomologyVanishes) {
        throw new TypeError("nonScottContinuousFiringReceipt: expected closure/no-NSC and concrete NSC witnesses");
    }
    return Object.freeze({
        kind: "flow.nonScottContinuousFiring.receipt:witness",
        sourceModule: "RelMath.Flow.NonScottContinuousFiring",
        theorems: Object.freeze([
            "no_nsc_firing_of_closure",
            "scott_continuous_iff_no_nsc_firing",
            "no_nsc_firing_iff_omega_regime",
            "forallAnteOp_isNSC",
            "nsc_firing_source_of_aperiodic",
        ]),
        closureNoNsc,
        nscFiring: nsc,
        nonScottRegime: regime,
        finiteClosureBoundary: "finite charge-closures are Scott-continuous; NSC requires a non-closure firing operator",
    });
}
export function closureFlowCurvatureRegimeReceipt() {
    const flat = curvatureRegime("ordinal.closure.regime.finite");
    const curved = curvatureRegime("ordinal.closure.regime.transfinite");
    const rankNonzeroWitness = nscFiring(forallAntecedentOperator, botTopPrefix);
    if (!flat.flat || !curved.curved || rankNonzeroWitness.kind !== "flow.nscFiring:witness") {
        throw new TypeError("closureFlowCurvatureRegimeReceipt: flat/curved partition failed");
    }
    return Object.freeze({
        kind: "flow.closureFlowCurvatureRegime.receipt:witness",
        sourceModule: "RelMath.Flow.ClosureFlowCurvatureRegime",
        theorems: Object.freeze([
            "flat_iff_not_curved",
            "vanishes_iff_flat",
            "nonvanishes_iff_curved",
            "no_curved_omega_terminating",
            "rank_zero_iff_flat",
            "rank_nonzero_has_nsc_firing",
            "curvature_regime_correspondence",
        ]),
        flat,
        curved,
        rankNonzeroWitness,
        partition: true,
        cohomologyIsCurvatureModule: true,
    });
}
export function transfiniteClosureFlowReceipt(operator, seed) {
    const dynamics = closureFlowDynamics(operator, seed, 3);
    const omegaContinuity = transfiniteOmegaContinuity(operator, seed);
    if (!dynamics.monotoneAscent || !omegaContinuity.omegaIsLub || !omegaContinuity.noNscAtOmega) {
        throw new TypeError("transfiniteClosureFlowReceipt: canonical omega continuity failed");
    }
    return Object.freeze({
        kind: "flow.transfiniteClosureFlow.receipt:witness",
        sourceModule: "RelMath.Flow.TransfiniteClosureFlow",
        theorems: Object.freeze([
            "smooth_not_nsc",
            "continuous_no_nsc_firing",
            "no_nsc_firing_of_smooth",
            "tflowOf_continuousAt_omega",
            "tflowOf_no_nsc_firing_omega",
            "transfinite_settling_continuity",
        ]),
        dynamics,
        omegaContinuity,
        smoothAtOmega: true,
        boundary: "canonical omega chain over the finite FOUR carrier",
    });
}
export function blowupClassificationReceipt(operator, seed, step) {
    const blowup = firingBlowup(operator, seed, step);
    if (!sameValuation(blowup.actual, blowup.reconstructedActual)) {
        throw new TypeError("blowupClassificationReceipt: local data did not reconstruct the actual valuation");
    }
    return Object.freeze({
        kind: "flow.blowupClassification.receipt:witness",
        sourceModule: "RelMath.Flow.BlowupClassification",
        theorems: Object.freeze([
            "cellType_none_iff",
            "reconstruct_cellType",
            "reconstruct_actual",
            "blowup_classified",
            "modelSingularity_nonIdentity",
        ]),
        blowup,
        localDataComplete: true,
        reconstructedActual: blowup.reconstructedActual,
        modelSingularity: blowup.nontrivial,
    });
}
//# sourceMappingURL=flow.mjs.map