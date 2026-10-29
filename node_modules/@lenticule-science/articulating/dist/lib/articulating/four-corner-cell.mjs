import { chargeValue, chargeValueName, } from "./predicating/positing/bilattice-charge.mjs";
const status = (tokenArticulated, claimArticulated) => Object.freeze({
    kind: "fourCorner.status",
    tokenArticulated,
    claimArticulated,
});
const cornerStatusByName = Object.freeze({
    absurd: status(false, false),
    potential: status(true, false),
    stable: status(true, true),
    active: status(false, true),
});
const chargeAliasByCorner = Object.freeze({
    absurd: "kBot",
    potential: "tTop",
    stable: "kTop",
    active: "tBot",
});
const chargeNameByCorner = Object.freeze({
    potential: "potential",
    active: "active",
    absurd: "absurd",
    stable: "stable",
});
export const fourCornerNames = Object.freeze(["absurd", "potential", "stable", "active"]);
export function cornerOfStatus(tokenArticulated, claimArticulated) {
    if (!tokenArticulated && !claimArticulated)
        return "absurd";
    if (tokenArticulated && !claimArticulated)
        return "potential";
    if (tokenArticulated && claimArticulated)
        return "stable";
    return "active";
}
export function statusOfCorner(corner) {
    return cornerStatusByName[corner];
}
export function chargeNameOfCorner(corner) {
    return chargeNameByCorner[corner];
}
export function readFourCorner(tokenArticulated, claimArticulated) {
    const corner = cornerOfStatus(tokenArticulated, claimArticulated);
    const charge = chargeValue(chargeNameOfCorner(corner));
    return Object.freeze({
        kind: "fourCorner.reading",
        status: status(tokenArticulated, claimArticulated),
        corner,
        chargeAlias: chargeAliasByCorner[corner],
        chargeName: chargeValueName(charge),
        charge,
        sameCoordinates: true,
    });
}
const sameStatus = (left, right) => left.tokenArticulated === right.tokenArticulated && left.claimArticulated === right.claimArticulated;
const pairingOf = (cell) => {
    if ("potentialAperiodicArticulationCell" in cell)
        return cell.potentialAperiodicArticulationCell[1];
    return cell[1];
};
export function fourCornerOfArticulationCell(cell) {
    const [tokenSlot, claimSlot] = pairingOf(cell);
    return readFourCorner(tokenSlot.length > 0, claimSlot.length > 0);
}
export function fourCornerCellReceipt(cell) {
    const readings = Object.freeze(fourCornerNames.map((name) => {
        const cornerStatus = statusOfCorner(name);
        return readFourCorner(cornerStatus.tokenArticulated, cornerStatus.claimArticulated);
    }));
    const cornerRoundTrip = readings.every((reading) => sameStatus(statusOfCorner(reading.corner), reading.status));
    const chargeCoordinateRoundTrip = readings.every((reading) => reading.chargeName === chargeNameOfCorner(reading.corner));
    const cellReading = fourCornerOfArticulationCell(cell);
    return Object.freeze({
        kind: "fourCornerCell.receipt:witness",
        readings,
        cellReading,
        cornerRoundTrip: cornerRoundTrip,
        chargeCoordinateRoundTrip: chargeCoordinateRoundTrip,
        articulationPhaseIsChargeByCoordinates: true,
        initialAbsurdIsKnowledgeBottom: cellReading.corner === "absurd" && cellReading.chargeAlias === "kBot",
    });
}
//# sourceMappingURL=four-corner-cell.mjs.map