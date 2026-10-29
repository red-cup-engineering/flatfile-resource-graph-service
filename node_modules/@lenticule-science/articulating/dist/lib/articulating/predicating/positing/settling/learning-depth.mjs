import { classifyRegime } from "./value-category.mjs";
/** All learning-depth names in regime order. */
export const learningDepthNames = Object.freeze([
    "rote",
    "automatization",
    "conceptual-change",
    "adaptive-expertise",
]);
/** Read a closure regime as its learning-depth carrier. */
export function learningDepthOfRegime(regime) {
    switch (regime.kind) {
        case "ordinal.closure.regime.finite":
            return Object.freeze({
                kind: "learning.depth",
                name: "rote",
                regime,
                closureOrdinalRegime: "finite",
                learningReading: "finite-practice",
            });
        case "ordinal.closure.regime.scott":
            return Object.freeze({
                kind: "learning.depth",
                name: "automatization",
                regime,
                closureOrdinalRegime: "scott",
                learningReading: "limit-practice",
            });
        case "ordinal.closure.regime.transfinite":
            return Object.freeze({
                kind: "learning.depth",
                name: "conceptual-change",
                regime,
                closureOrdinalRegime: "transfinite",
                learningReading: "post-limit-restructuring",
            });
        case "ordinal.closure.regime.aperiodic":
            return Object.freeze({
                kind: "learning.depth",
                name: "adaptive-expertise",
                regime,
                closureOrdinalRegime: "aperiodic",
                learningReading: "open-ended-adaptation",
            });
    }
}
/** Classify admitted closure-regime data and read it as a learning depth. */
export const learningDepthOfRegimeData = (data) => learningDepthOfRegime(classifyRegime(data));
//# sourceMappingURL=learning-depth.mjs.map