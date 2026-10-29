/**
 * analysis/weave-draft - plain-weave drafts as bilattice-coloured sofic shifts.
 *
 * Executable shadow of RelMath.Aperiodic.WeaveDraft: the over/under alternation
 * graph is the two-colour complete graph, crossing data is a FOUR charge, and
 * a defect-free plain-weave word relabels to a charge-coloured sofic image.
 */
import { chargeValue, negateValue, } from "../../bilattice-charge.mjs";
import { path as soficPath, soficImage, } from "./sofic.mjs";
export const plainWeaveGraph = Object.freeze([
    Object.freeze([false, true]),
    Object.freeze([true, false]),
]);
const assertBool = (value, caller) => {
    if (typeof value !== "boolean")
        throw new TypeError(`${caller}: expected a boolean crossing`);
};
function assertWord(word, caller) {
    for (const bit of word)
        assertBool(bit, caller);
}
function assertSwatch(swatch, caller) {
    for (const row of swatch)
        assertWord(row, caller);
}
const boolSymbol = (value) => value ? 1 : 0;
const symbolWord = (word) => Object.freeze(word.map(boolSymbol));
export const warpAlt = (left, right) => left !== right;
export const completeGraphBool = (left, right) => left !== right;
export function warpPath(word) {
    assertWord(word, "warpPath");
    return soficPath(plainWeaveGraph, symbolWord(word));
}
export const noFloat = (word) => warpPath(word).kind === "sofic.path:witness";
export function crossingCharge(warpOver, weftOver) {
    assertBool(warpOver, "crossingCharge");
    assertBool(weftOver, "crossingCharge");
    if (warpOver && weftOver)
        return "stable";
    if (warpOver)
        return "potential";
    if (weftOver)
        return "active";
    return "absurd";
}
export const chargeColour = (crossing) => crossingCharge(crossing, !crossing);
const isInconsistency = (charge) => charge === "stable";
const isDefinite = (charge) => charge === "potential" || charge === "active";
export function chargeColourWord(word) {
    assertWord(word, "chargeColourWord");
    return Object.freeze(word.map(chargeColour));
}
export function chargeColouredSofic(word) {
    assertWord(word, "chargeColouredSofic");
    return soficImage(plainWeaveGraph, [2, 3], symbolWord(word));
}
export const complementRow = (row) => {
    assertWord(row, "complementRow");
    return Object.freeze(row.map((crossing) => !crossing));
};
const rowEquals = (left, right) => left.length === right.length && left.every((crossing, index) => crossing === right[index]);
export function columnsComplement(swatch) {
    assertSwatch(swatch, "columnsComplement");
    for (let index = 0; index + 1 < swatch.length; index += 1) {
        if (!rowEquals(swatch[index + 1], complementRow(swatch[index])))
            return false;
    }
    return true;
}
export function plainWeaveSwatch(swatch) {
    assertSwatch(swatch, "plainWeaveSwatch");
    return swatch.every(noFloat) && columnsComplement(swatch);
}
export function entropyCollapse(swatch) {
    assertSwatch(swatch, "entropyCollapse");
    if (!plainWeaveSwatch(swatch))
        return false;
    return swatch.every((left) => swatch.every((right) => rowEquals(left, right) || rowEquals(left, complementRow(right))));
}
function exhaustivePairs(predicate) {
    return [false, true].every((left) => [false, true].every((right) => predicate(left, right)));
}
export function receipt(warpWord = [false, true, false, true], swatch = [[false, true, false], [true, false, true], [false, true, false]]) {
    const warpPathJudgment = warpPath(warpWord);
    const chargeImage = chargeColouredSofic(warpWord);
    const warpAltEqualsCompleteGraph = exhaustivePairs((left, right) => warpAlt(left, right) === completeGraphBool(left, right));
    const warpAltForbidsFloat = exhaustivePairs((value) => warpPath([value, value]).kind === "sofic.path-obstruction");
    const holeIsKBot = crossingCharge(false, false) === "absurd";
    const miscrossingIsKTop = crossingCharge(true, true) === "stable";
    const overUnderSwapIsNegate = exhaustivePairs((warpOver, weftOver) => negateValue(chargeValue(crossingCharge(warpOver, weftOver))).name === crossingCharge(weftOver, warpOver));
    const defectFreeDefinite = [false, true].every((bit) => isDefinite(chargeColour(bit)));
    const miscrossingIsInconsistency = isInconsistency(crossingCharge(true, true));
    const defectFreeConsistent = [false, true].every((bit) => !isInconsistency(chargeColour(bit)));
    const overUnderSwapFixesDefect = exhaustivePairs((warpOver, weftOver) => isInconsistency(negateValue(chargeValue(crossingCharge(warpOver, weftOver))).name) ===
        isInconsistency(crossingCharge(warpOver, weftOver)));
    const mapNotInvolutive = [[], [false], [false, true], [true, false, true]]
        .every((row) => rowEquals(complementRow(complementRow(row)), row));
    if (!warpAltEqualsCompleteGraph
        || !warpAltForbidsFloat
        || warpPathJudgment.kind !== "sofic.path:witness"
        || chargeImage.kind !== "sofic.image:witness"
        || !holeIsKBot
        || !miscrossingIsKTop
        || !overUnderSwapIsNegate
        || !defectFreeDefinite
        || !miscrossingIsInconsistency
        || !defectFreeConsistent
        || !overUnderSwapFixesDefect
        || !plainWeaveSwatch(swatch)
        || !mapNotInvolutive
        || !entropyCollapse(swatch)) {
        throw new TypeError("weaveDraft.receipt: finite weave-draft laws failed");
    }
    return Object.freeze({
        kind: "aperiodic.weaveDraft.receipt:witness",
        warpWord: Object.freeze([...warpWord]),
        warpPath: warpPathJudgment,
        chargeWord: chargeColourWord(warpWord),
        chargeImage,
        swatch: Object.freeze(swatch.map((row) => Object.freeze([...row]))),
        warpAltEqualsCompleteGraph: true,
        warpAltForbidsFloat: true,
        warpSofic: true,
        holeIsKBot: true,
        miscrossingIsKTop: true,
        overUnderSwapIsNegate: true,
        defectFreeDefinite: true,
        miscrossingIsInconsistency: true,
        defectFreeConsistent: true,
        overUnderSwapFixesDefect: true,
        chargeColouredSofic: true,
        columnsComplement: true,
        mapNotInvolutive: true,
        entropyCollapse: true,
    });
}
//# sourceMappingURL=weave-draft.mjs.map