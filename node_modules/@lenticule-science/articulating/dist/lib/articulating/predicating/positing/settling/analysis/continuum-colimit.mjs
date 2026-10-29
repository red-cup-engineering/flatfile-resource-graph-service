/**
 * analysis/continuum-colimit - finite Scott-colimit limit shape.
 *
 * Executable shadow for `RelMath.Lorentzian.ContinuumColimit`: over the finite
 * FOUR charge lattice, a directed sprinkling tower attains its knowledge join,
 * and any monotone integer functional reaches its join value at a stage. This
 * is the colimit shape, not the analytic Ricci-scalar magnitude.
 */
import { chargeValue, chargeValueName, joinKnowledgeValue, } from "../../bilattice-charge.mjs";
import { directedFamily, } from "./scott-coalgebra.mjs";
function knowledgeLeq(left, right) {
    return chargeValueName(joinKnowledgeValue(chargeValue(left), chargeValue(right))) === right;
}
function assertMonotoneOnFamily(family, functional) {
    for (const left of family.elems) {
        for (const right of family.elems) {
            if (knowledgeLeq(left, right) && functional(left) > functional(right)) {
                throw new TypeError("continuumColimit: expected a monotone charge functional on the directed family");
            }
        }
    }
}
export const chargeInformationRank = (value) => value === "absurd" ? 0 : value === "potential" || value === "active" ? 1 : 2;
export const kContent = chargeInformationRank;
function knowledgeSup(values) {
    return values.reduce((out, value) => chargeValueName(joinKnowledgeValue(chargeValue(out), chargeValue(value))), "absurd");
}
export function observedKnowledge(cells) {
    return knowledgeSup(cells.map((cell) => cell.charge));
}
/** A monotone functional commutes with the finite directed join. */
export function actionCommutesWithJoin(family, functional = chargeInformationRank) {
    assertMonotoneOnFamily(family, functional);
    const joinFunctionalValue = functional(family.sup);
    const stageValues = Object.freeze(Object.fromEntries(family.elems.map((stage) => [stage, functional(stage)])));
    const bounds = family.elems.every((stage) => functional(stage) <= joinFunctionalValue);
    const realized = family.elems.some((stage) => functional(stage) === joinFunctionalValue);
    if (!bounds || !realized) {
        throw new TypeError("continuumColimit.actionCommutesWithJoin: finite join value was not attained");
    }
    return Object.freeze({
        kind: "lorentzian.continuumColimit.actionJoin:witness",
        family,
        joinValue: family.sup,
        stageValues,
        joinFunctionalValue,
        boundsEveryStage: true,
        realizedAmongStages: true,
    });
}
/** The continuum colimit value is reached at a finite stage of the tower. */
export function actionLimitAttained(join) {
    return Object.freeze({
        kind: "lorentzian.continuumColimit.actionLimit:witness",
        attainedAt: join.joinValue,
        value: join.joinFunctionalValue,
        dominatesEveryStage: true,
        finiteStageAttainment: true,
    });
}
/** Bundle the finite Scott-colimit reading of the continuum-limit shape. */
export function continuumColimitReceipt(family = directedFamily(["absurd", "potential", "stable"]), functional = chargeInformationRank) {
    const actionJoin = actionCommutesWithJoin(family, functional);
    return Object.freeze({
        kind: "lorentzian.continuumColimit:witness",
        actionJoin,
        limit: actionLimitAttained(actionJoin),
        scottColimitNotEpsilonDelta: true,
        finiteCarrierForcesAttainment: true,
        magnitudeBoundary: "metric Ricci-scalar contraction remains frontier",
    });
}
/** Bundle the Chu/FOUR information-action colimit over a finite reveal prefix. */
export function chuInformationActionColimitReceipt(cells = Object.freeze([
    Object.freeze({ point: "p0", state: "s0", charge: "absurd" }),
    Object.freeze({ point: "p0", state: "s1", charge: "potential" }),
    Object.freeze({ point: "p1", state: "s1", charge: "stable" }),
])) {
    if (cells.length === 0)
        throw new RangeError("chuInformationActionColimitReceipt: expected at least one revealed cell");
    const prefixes = cells.map((_cell, index) => observedKnowledge(cells.slice(0, index + 1)));
    const family = directedFamily(prefixes);
    const actionJoin = actionCommutesWithJoin(family, kContent);
    const observed = observedKnowledge(cells);
    const monotone = prefixes.every((left, index) => prefixes.slice(index).every((right) => knowledgeLeq(left, right)));
    if (!monotone || actionJoin.joinValue !== observed) {
        throw new TypeError("chuInformationActionColimitReceipt: FOUR information action colimit laws failed");
    }
    return Object.freeze({
        kind: "lorentzian.chuActionColimit.receipt:witness",
        sourceModule: "RelMath.Lorentzian.ChuActionColimit",
        theorems: Object.freeze([
            "RelMath.Lorentzian.ChuActionColimit.kContent_mono",
            "RelMath.Lorentzian.ChuActionColimit.observedKnowledge_mono",
            "RelMath.Lorentzian.ChuActionColimit.chu_info_action_continuum_attained",
            "RelMath.Lorentzian.ChuActionColimit.chu_action_colimit",
        ]),
        cells: Object.freeze(cells.map((cell) => Object.freeze({ ...cell }))),
        observedKnowledge: observed,
        observedKnowledgeContent: kContent(observed),
        actionJoin,
        contentMonotone: true,
        observedKnowledgeMonotone: true,
        continuumValueAttained: actionJoin.realizedAmongStages,
        boundary: "FOUR information action only; Mobius gravitational BD action remains proof-side frontier",
    });
}
//# sourceMappingURL=continuum-colimit.mjs.map