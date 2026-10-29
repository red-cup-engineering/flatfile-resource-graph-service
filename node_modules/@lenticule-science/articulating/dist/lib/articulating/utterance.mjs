const MarkSchema = {
    type: "object",
    required: ["kind", "value"],
    properties: {
        kind: { const: "utterance.mark" },
        value: {},
    },
    additionalProperties: false,
};
const TokenSchema = {
    type: "object",
    required: ["kind", "hand", "mark"],
    properties: {
        kind: { const: "utterance.token" },
        hand: { const: "left" },
        mark: MarkSchema,
    },
    additionalProperties: false,
};
const ClaimSchema = {
    type: "object",
    required: ["kind", "hand", "mark"],
    properties: {
        kind: { const: "utterance.claim" },
        hand: { const: "right" },
        mark: MarkSchema,
    },
    additionalProperties: false,
};
/** The base admission carrier shape: token + claim, each carrying a Mark. */
const utteranceShape = {
    kind: { const: "utterance.carrier" },
    token: TokenSchema,
    claim: ClaimSchema,
};
/** The base admission carrier schema: one plain JSON-Schema literal with a bare `$id`. */
export const utteranceSchema = {
    $id: "relating/articulating/utterance",
    type: "object",
    required: ["kind", "token", "claim"],
    properties: utteranceShape,
    additionalProperties: false,
    title: "UtteranceCarrier",
    description: "The base admission carrier: a token and a claim, each carrying a Mark.",
};
/** The articulation cell carrier shape opened from an utterance. */
const articulationCellShape = {
    kind: { const: "utterance.articulation.cell" },
    potentialAperiodicArticulationCell: {
        type: "array",
        items: [
            utteranceSchema,
            {
                type: "array",
                items: [
                    { type: "array", items: [TokenSchema], minItems: 1, maxItems: 1, additionalItems: false },
                    { type: "array", items: [], minItems: 0, maxItems: 0, additionalItems: false },
                ],
                minItems: 2,
                maxItems: 2,
                additionalItems: false,
            },
        ],
        minItems: 2,
        maxItems: 2,
        additionalItems: false,
    },
};
/** The articulation cell carrier schema opened from an utterance. */
export const articulationCellSchema = {
    $id: "relating/articulating/articulation-cell",
    type: "object",
    required: ["kind", "potentialAperiodicArticulationCell"],
    properties: articulationCellShape,
    additionalProperties: false,
    title: "ArticulationCell",
    description: "An utterance opened at its potential aperiodic articulation cell.",
};
/** A mark: an immutable carrier wrapping a single present value. The opaque atom. */
export class Mark {
    kind = "utterance.mark";
    value;
    constructor(value) {
        if (value === undefined)
            throw new TypeError("Mark: value must be present");
        this.value = value;
        Object.freeze(this);
    }
}
/** A token: the immutable left-hand utterance carrier holding one mark. */
export class Token {
    kind = "utterance.token";
    hand = "left";
    mark;
    constructor(mark) {
        this.mark = mark;
        Object.freeze(this);
    }
}
/** A claim: the immutable right-hand utterance carrier holding one mark. */
export class Claim {
    kind = "utterance.claim";
    hand = "right";
    mark;
    constructor(mark) {
        this.mark = mark;
        Object.freeze(this);
    }
}
/** The complete finite enumeration of `RelMath.Mark.Kind`. */
export const markKinds = Object.freeze(["token", "claim"]);
/** Decide membership in the two-element mark-kind carrier. */
export const isMarkKind = (kind) => kind === "token" || kind === "claim";
/** `RelMath.Mark.Kind.two_kinds`: every mark kind is token or claim. */
export const markKindTwoKinds = (kind) => markKinds.includes(kind);
/** `RelMath.Mark.Kind.token_ne_claim`: the two mark roles are distinct. */
export const tokenNeClaim = () => true;
/** Constructs a Mark wrapping the given value. */
export function mark(value) {
    return new Mark(value);
}
/** Constructs a Token from the given mark. */
export function token(markCarrier) {
    return new Token(markCarrier);
}
/** Constructs a Claim from the given mark. */
export function claim(markCarrier) {
    return new Claim(markCarrier);
}
/** Constructs an utterance carrier from two marks: left becomes a token, right a claim. */
export function utterance(left, right) {
    return Object.freeze({ kind: "utterance.carrier", token: token(left), claim: claim(right) });
}
/** The innermost `RelMath.Articulating.utter` constructor. */
export function articulatingUtter(carrier) {
    return Object.freeze({ kind: "articulating.utter", utterance: carrier });
}
/** The recursive `RelMath.Articulating.pair` constructor. */
export function articulatingPair(carrier, nested) {
    return Object.freeze({ kind: "articulating.pair", utterance: carrier, articulating: nested });
}
/** `RelMath.Articulating.head`: the utterance at the head of the recursion. */
export function articulatingHead(carrier) {
    return carrier.utterance;
}
/** `RelMath.Articulating.depth`: the finite recursion depth to the primitive floor. */
export function articulatingDepth(carrier) {
    return carrier.kind === "articulating.utter" ? 0 : articulatingDepth(carrier.articulating) + 1;
}
/** `RelMath.Articulating.floor`: the innermost utterance at the primitive floor. */
export function articulatingFloor(carrier) {
    return carrier.kind === "articulating.utter" ? carrier.utterance : articulatingFloor(carrier.articulating);
}
/** `RelMath.Articulating.utter_ne_pair`: the two constructors remain distinguishable. */
export function articulatingUtterNePair(_u, _v, _a) {
    return true;
}
/** Whether two mark payloads coincide: identical primitives, or structurally
 *  equal plain JSON. This is the only place core code reads a Mark payload, and
 *  it reads it only to judge coincidence — never to branch on its content.
 *
 *  Structural (value) coincidence, not reference identity: this package is
 *  boundary-first, so carriers are routinely reconstructed from JSON with no
 *  shared references. Coincidence must survive a transport round-trip; reference
 *  identity would not. (This is the one deliberate divergence from the prior
 *  reference-identity carrier coincidence.) */
export function coincides(left, right) {
    if (Object.is(left, right))
        return true;
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
        return false;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
            return false;
        return left.every((item, index) => coincides(item, right[index]));
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (leftKeys.length !== rightKeys.length || !leftKeys.every((key, index) => key === rightKeys[index]))
        return false;
    return leftKeys.every((key) => coincides(left[key], right[key]));
}
/** Structural guard for a Mark carrier. Boundary-first: a Mark rehydrated from JSON
 *  is a plain object, not a class instance, so membership is judged by shape (kind +
 *  a present value), the same stance `coincides` takes — never by `instanceof`, which
 *  would not survive a transport round-trip. */
export function isMark(value) {
    return typeof value === "object" && value !== null
        && value.kind === "utterance.mark"
        && "value" in value;
}
/** Judges whether two tokens coincide: a witness when their marks coincide, else an obstruction. */
export function tokenIdentity(left, right) {
    return coincides(left.mark.value, right.mark.value)
        ? Object.freeze({ kind: "utterance.coincidence:witness", left, right })
        : Object.freeze({ kind: "utterance.coincidence-obstruction", left, right });
}
/** Judges whether two claims coincide: a witness when their marks coincide, else an obstruction. */
export function claimIdentity(left, right) {
    return coincides(left.mark.value, right.mark.value)
        ? Object.freeze({ kind: "utterance.coincidence:witness", left, right })
        : Object.freeze({ kind: "utterance.coincidence-obstruction", left, right });
}
/**
 * Articulates an utterance carrier: opens the aperiodic articulation category at
 * its potential cell. The carrier's token occupies the token slot and the claim
 * slot remains empty: the raw articulation status is exactly (true, false).
 */
export function articulate(carrier) {
    const pairing = Object.freeze([Object.freeze([carrier.token]), Object.freeze([])]);
    return Object.freeze({
        kind: "utterance.articulation.cell",
        potentialAperiodicArticulationCell: Object.freeze([carrier, pairing]),
    });
}
/** Type guard for the potential (token-present, claim-empty) articulation cell. */
export function isArticulationCell(value) {
    const kind = "kind" in value ? value.kind : undefined;
    const cell = "potentialAperiodicArticulationCell" in value ? value.potentialAperiodicArticulationCell : undefined;
    return kind === "utterance.articulation.cell"
        && Array.isArray(cell)
        && cell.length === 2
        && typeof cell[0] === "object"
        && cell[0] !== null
        && "kind" in cell[0]
        && cell[0].kind === "utterance.carrier"
        && Array.isArray(cell[1])
        && cell[1].length === 2
        && Array.isArray(cell[1][0])
        && cell[1][0].length === 1
        && typeof cell[1][0][0] === "object"
        && cell[1][0][0] !== null
        && cell[1][0][0].kind === "utterance.token"
        && coincides(cell[1][0][0].mark?.value, cell[0].token?.mark?.value)
        && Array.isArray(cell[1][1])
        && cell[1][1].length === 0;
}
//# sourceMappingURL=utterance.mjs.map