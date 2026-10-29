/**
 * positing/diataxis — Diataxis as a FOUR charge read.
 *
 * The package-side Diataxis surface is deliberately small: it reads the
 * tutorial / how-to / explanation / reference four over the existing bilattice
 * `ChargeValue` carrier instead of introducing a parallel value algebra.
 *
 * The mapping is by bilattice role, not by label coincidence with RelMath
 * `Corner` names:
 *
 * - tutorial -> package `absurd` (knowledge bottom)
 * - how-to -> package `potential` (truth side present)
 * - explanation -> package `active` (falsity side present)
 * - reference -> package `stable` (knowledge top)
 *
 * With that transport, lookup duality is existing charge conflation and doing
 * duality is existing charge negation. This is the code-backed Diataxis slice:
 * a total finite read over FOUR. It deliberately stops before Diataxis coverage
 * analysis, learning-cycle closure, or documentation generation.
 *
 * The broader content/Lean artifact proves the Diataxis quartet as another face
 * of the recurring FOUR. This package module is the Node carrier read that is
 * actually exported today: modes, charge transport, two axis reads, and the
 * three transported duality edge families.
 *
 * @example
 * ```ts
 * chargeValueOfDiataxisMode("reference").name
 * // "stable"
 *
 * diataxisLookupDual("tutorial").name
 * // "reference"
 *
 * diataxisDoingDual("how-to").name
 * // "explanation"
 * ```
 *
 * @packageDocumentation
 */
import { asChargeValue, chargeValue, conflateValue, gauge, negateValue, } from "./bilattice-charge.mjs";
/** All Diataxis mode names. */
export const diataxisModeNames = Object.freeze(["tutorial", "how-to", "explanation", "reference"]);
const chargeByMode = {
    tutorial: "absurd",
    "how-to": "potential",
    explanation: "active",
    reference: "stable",
};
const modeByCharge = {
    absurd: "tutorial",
    potential: "how-to",
    active: "explanation",
    stable: "reference",
};
/** Whether a string names a Diataxis mode. */
export function isDiataxisModeName(value) {
    return diataxisModeNames.includes(value);
}
/** Coerce a string to a Diataxis mode name, or throw. */
export function asDiataxisModeName(value) {
    if (!isDiataxisModeName(value)) {
        throw new TypeError(`not a Diataxis mode name: ${JSON.stringify(value)} (expected one of ${diataxisModeNames.join(", ")})`);
    }
    return value;
}
const modeNameOf = (mode) => typeof mode === "string" ? asDiataxisModeName(mode) : mode.name;
/** Construct a Diataxis mode and its package charge reading. */
export function diataxisMode(name) {
    const charge = chargeValue(chargeByMode[name]);
    return Object.freeze({
        kind: "diataxis.mode",
        name,
        charge,
        application: charge.coordinates[0].name === "present",
        cognition: charge.coordinates[1].name === "present",
    });
}
/** All four Diataxis modes. */
export const diataxisModes = Object.freeze(diataxisModeNames.map(diataxisMode));
/** The name of a Diataxis mode. */
export const diataxisModeName = (mode) => mode.name;
/** Read the package FOUR charge value carried by a Diataxis mode. */
export function chargeValueOfDiataxisMode(mode) {
    return chargeValue(chargeByMode[modeNameOf(mode)]);
}
/** Read the Diataxis mode corresponding to a package FOUR charge value. */
export function diataxisModeOfCharge(value) {
    return diataxisMode(modeByCharge[asChargeValue(value).name]);
}
/** Whether a Diataxis mode is application-facing. */
export function diataxisApplication(mode) {
    return chargeValueOfDiataxisMode(mode).coordinates[0].name === "present";
}
/** Whether a Diataxis mode is cognition-facing. */
export function diataxisCognition(mode) {
    return chargeValueOfDiataxisMode(mode).coordinates[1].name === "present";
}
/** Lookup duality: tutorial <-> reference, with how-to and explanation fixed. */
export function diataxisLookupDual(mode) {
    return diataxisModeOfCharge(conflateValue(chargeValueOfDiataxisMode(mode)));
}
/** Doing duality: how-to <-> explanation, with tutorial and reference fixed. */
export function diataxisDoingDual(mode) {
    return diataxisModeOfCharge(negateValue(chargeValueOfDiataxisMode(mode)));
}
/** The composite diagonal duality on the Diataxis four. */
export function diataxisAntipode(mode) {
    return diataxisModeOfCharge(gauge("double", chargeValueOfDiataxisMode(mode)));
}
const dualityEdge = (duality, from, to) => Object.freeze({
    kind: "diataxis.duality-edge",
    duality,
    from,
    to,
});
/** Return the finite Diataxis reading carried by the package FOUR charge square.
 *
 * The returned value contains all four modes plus the three transported diagonal
 * edge sets: lookup duality, doing duality, and their composite antipode.
 */
export function diataxisReading() {
    const modes = diataxisModes;
    return Object.freeze({
        kind: "diataxis.reading",
        modes,
        lookupDual: Object.freeze(modes.map((mode) => dualityEdge("lookup", mode, diataxisLookupDual(mode)))),
        doingDual: Object.freeze(modes.map((mode) => dualityEdge("doing", mode, diataxisDoingDual(mode)))),
        antipode: Object.freeze(modes.map((mode) => dualityEdge("antipode", mode, diataxisAntipode(mode)))),
    });
}
//# sourceMappingURL=diataxis.mjs.map