/**
 * analysis/hauptvermutung - finite spacetime fingerprints.
 *
 * Executable shadow for `RelMath.Lorentzian.Hauptvermutung`: the green,
 * order-intrinsic fingerprint `(relations, action)` computed from a finite
 * causal order alone. Continuum uniqueness remains outside this Node surface.
 */
import { apexCount, bdAction, diamondCausalSet, settleCausalSet, } from "./causal.mjs";
function isObstruction(value) {
    return typeof value === "object"
        && value !== null
        && value.kind === "lorentzian.causalSettle-obstruction";
}
/** Read the order-intrinsic spacetime fingerprint `(relations, action)`. */
export function fingerprint(carrier) {
    const settled = settleCausalSet(carrier);
    if (settled.kind !== "lorentzian.causalSettle:witness")
        return settled;
    const normalized = Object.freeze({ kind: "lorentzian.causalSet", events: settled.events, links: settled.closure });
    const action = bdAction(normalized);
    if (isObstruction(action))
        return action;
    return Object.freeze({
        kind: "lorentzian.spacetimeFingerprint",
        relations: apexCount(settled.events, settled.closure),
        action,
    });
}
/** Bundle the finite, testable content of the Hauptvermutung module. */
export function hauptvermutungReceipt(carrier = diamondCausalSet) {
    const value = fingerprint(carrier);
    if (isObstruction(value))
        return value;
    const diamond = fingerprint(diamondCausalSet);
    if (diamond.relations !== 5 || diamond.action !== 1) {
        throw new TypeError("hauptvermutung.receipt: diamond fingerprint law failed");
    }
    return Object.freeze({
        kind: "lorentzian.hauptvermutungFingerprint:witness",
        fingerprint: value,
        diamondFingerprint: diamond,
        orderIntrinsic: true,
        manifoldFree: true,
        continuumUniquenessBoundary: "faithful embedding uniqueness remains frontier",
    });
}
//# sourceMappingURL=hauptvermutung.mjs.map