// world-observation — what LAGOON has observed of its hosts, recorded as world facts.
//
// FACT SCHEMA  "lagoon-observation/1"
// -----------------------------------
// Every fact is one strict EAVT row {e, a, v, t} appended to the world trace through
// eavt-services-section. Rows are APPEND-ONLY and TIME-STAMPED: nothing is overwritten, retracted
// or deleted. `t` is the observation instant in epoch milliseconds, supplied by the observer
// (never read from a clock here). The CURRENT value of an observed attribute is the row with the
// greatest t; the earlier rows remain as history. `since` is the t at which that value was first
// seen in the unbroken run of identical observations that ends at the current one.
//
// Entities (constituted once each, by content address; found again by their attributes):
//   machine          attributes {name, ...}  the host itself. It is the machine entity seed-world
//                    constituted from the machine record; constituted here as {name} only when no
//                    machine of that name exists yet, so `look <host>` finds one entity, never two.
//   generation       attributes {name: store basename, storePath}              located-in machine
//   unit             attributes {name: "<unit>.service", host: host name}      located-in host
//   release-attempt  attributes {name: "release <host> <at>", host, at, outcome, actor?, builder?,
//                    target?, machine?, profile?, compositionCommit?, hostCommit?, reason?,
//                    startedAt?, generation?}  genesis t = Date.parse(at)       located-in host
//                    (an attempt is one immutable fact: it is constituted whole, never re-observed)
//
// Observed rows (re-appended at every observation, a new t each time):
//   machine     observed-by      the observer (string, e.g. "status.mjs@<hostname>")
//   machine     profile          the Guix profile path observed
//   machine     link             the profile symlink target, or "none"
//   machine     live-generation  address of the generation entity live there, or "none"
//   machine     store-free-percent / store-size-bytes / store-avail-bytes   (when df answered)
//   unit        state            systemd is-active answer: active, failed, inactive, ... , or
//                                "not-observed" when a unit seen before is absent from this
//                                observation (the absence is recorded, the unit is not forgotten)
//   unit        runs-generation  address of the generation whose store path the unit file names
//   machine     hold-inventory-complete  true/false when explicitly observed, "unknown" on later
//                    legacy reads that cannot sustain a prior assertion.
//   unit        admission-hold-marker  "present" (original profile marker observed), "absent"
//                    (complete directory scan proves no marker), or "unknown" (incomplete or
//                    later legacy scan). A marker is NOT proof of an effective systemd guard,
//                    a live holder, or independently received Work.
//
// Immutable rows (appended once, skipped when the identical e/a/v already exists):
//   generation  composition-commit, host-commit, promoted-by, built-by, promoted-at
//   release-attempt  released-by (actor), produced (generation address)
//
// look reads this through observedStateOf(): per attribute {value, t, since}.

import { constitute } from "@red-cup-engineering/eavt-services-section/constitute-entity";
import { appendEavtRow } from "@red-cup-engineering/eavt-services-section/append-eavt-row";
import { readEavtEntries } from "@red-cup-engineering/eavt-services-section/read-eavt-entries";

export const OBSERVATION_SCHEMA = "lagoon-observation/1";

/** Attributes whose newest row is "the current value" and whose older rows are history. */
export const OBSERVED_ATTRIBUTES = Object.freeze([
  "observed-by", "profile", "link", "live-generation",
  "store-free-percent", "store-size-bytes", "store-avail-bytes",
  "state", "runs-generation", "hold-inventory-complete", "admission-hold-marker",
]);

const STORE = /^\/gnu\/store\/[0-9a-z]{32}-[A-Za-z0-9+._-]+$/u;
const OBSERVED = new Set(OBSERVED_ATTRIBUTES);

function readRows(path) {
  try {
    return readEavtEntries({ path }, { strict: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Current value of every observed attribute of one entity: {attribute: {value, t, since}}.
 * Pure; the entity's older rows are left untouched and are still in the trace.
 */
export function observedStateOf(rows, address) {
  const byAttribute = new Map();
  rows.forEach((row, index) => {
    if (row.e !== address || !OBSERVED.has(row.a)) return;
    if (!byAttribute.has(row.a)) byAttribute.set(row.a, []);
    byAttribute.get(row.a).push({ ...row, index });
  });
  const state = {};
  for (const [attribute, list] of byAttribute) {
    list.sort((left, right) => left.t - right.t || left.index - right.index);
    const latest = list[list.length - 1];
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    let since = latest.t;
    for (let i = list.length - 2; i >= 0 && same(list[i].v, latest.v); i -= 1) since = list[i].t;
    state[attribute] = { value: latest.v, t: latest.t, since };
  }
  return state;
}

function genesisRows(rows) {
  return rows.filter((row) => row.a === "constituted");
}

function sameAttributes(actual, wanted) {
  return Object.entries(wanted).every(([key, value]) => actual?.[key] === value);
}

/**
 * Record one host observation (the shape scripts/status.mjs's hostStatus returns) as world facts.
 * @param {{path: string, status: object, t: number, observer?: string}} input
 * @returns {{host: string, generation: string|null, units: number, attempts: number, rows: number}}
 */
export function recordHostObservation({ path, status, t, observer = "status" }) {
  if (typeof path !== "string" || path.length === 0) throw new TypeError("record-host-observation: path must be a non-empty string");
  if (!Number.isFinite(t)) throw new TypeError("record-host-observation: t must be a finite epoch-millisecond number");
  if (status === null || typeof status !== "object" || typeof status.host !== "string" || status.host === "") {
    throw new TypeError("record-host-observation: status needs a host name");
  }
  const units = status.units ?? [], history = status.history ?? [];
  if (!Array.isArray(units) || !Array.isArray(history)) throw new TypeError("record-host-observation: status.units and status.history must be arrays");
  // Absence of a legacy field is not a complete inventory. Validate before
  // writing any source facts, so malformed observed holds have zero effects.
  const hasHoldReading = Object.hasOwn(status, "holdInventoryComplete");
  const holds = status.holds ?? [];
  if ((hasHoldReading && typeof status.holdInventoryComplete !== "boolean")
      || !Array.isArray(holds) || (!hasHoldReading && status.holds !== undefined)
      || holds.length > 256
      || holds.some(value => !value || typeof value !== "object" ||
          !/^[A-Za-z0-9_.@-]+\.(?:service|timer|socket|target|path|mount)$/u.test(value.unit) ||
          value.markerPresent !== true)
      || new Set(holds.map(value => value.unit)).size !== holds.length)
    throw new TypeError("record-host-observation: invalid or unqualified native hold inventory");

  let rows = readRows(path);
  const appended = { count: 0 };
  const append = (row, { once = false } = {}) => {
    if (once && rows.some((have) => have.e === row.e && have.a === row.a && JSON.stringify(have.v) === JSON.stringify(row.v))) return;
    if (rows.some((have) => have.e === row.e && have.a === row.a && have.t === row.t && JSON.stringify(have.v) === JSON.stringify(row.v))) return;
    appendEavtRow({ path, row });
    rows = [...rows, row];
    appended.count += 1;
  };
  // An entity is found by kind + attributes; constituted (at the instant first seen) when absent.
  const ensure = (kind, attributes, at = t) => {
    const found = genesisRows(rows).find((row) => row.e.startsWith(`${kind}:`) && sameAttributes(row.v, attributes) && Object.keys(row.v).length === Object.keys(attributes).length);
    if (found) return found.e;
    const { address, genesis } = constitute({ kind, attributes, t: at });
    append(genesis);
    return address;
  };

  const host = genesisRows(rows).find((row) => row.e.startsWith("machine:") && row.v?.name === status.host)?.e ?? ensure("machine", { name: status.host });
  const place = (address) => append({ e: address, a: "located-in", v: host, t: Math.min(t, rows.find((r) => r.e === address && r.a === "constituted")?.t ?? t) }, { once: true });

  // Generation live on the host.
  let generation = null;
  const live = status.live;
  if (live && typeof live.generation === "string" && STORE.test(live.generation)) {
    generation = ensure("generation", { name: live.generation.slice("/gnu/store/".length), storePath: live.generation });
    place(generation);
    for (const [attribute, value] of [["composition-commit", live.compositionCommit], ["host-commit", live.hostCommit], ["promoted-by", live.actor], ["built-by", live.builder], ["promoted-at", live.at]]) {
      if (typeof value === "string" && value !== "") append({ e: generation, a: attribute, v: value, t }, { once: true });
    }
  }

  append({ e: host, a: "observed-by", v: observer, t });
  if (typeof status.profile === "string") append({ e: host, a: "profile", v: status.profile, t });
  append({ e: host, a: "link", v: status.link ?? "none", t });
  append({ e: host, a: "live-generation", v: generation ?? "none", t });
  if (hasHoldReading) append({ e: host, a: "hold-inventory-complete", v: status.holdInventoryComplete, t });
  else if (observedStateOf(rows, host)["hold-inventory-complete"])
    append({ e: host, a: "hold-inventory-complete", v: "unknown", t });
  if (status.disk) {
    append({ e: host, a: "store-free-percent", v: status.disk.freePercent, t });
    append({ e: host, a: "store-size-bytes", v: status.disk.size, t });
    append({ e: host, a: "store-avail-bytes", v: status.disk.avail, t });
  }

  // Units: every observed unit gets a state; units known on this host but absent now are said so.
  const seen = new Set();
  for (const { unit, state } of units) {
    seen.add(unit);
    const address = ensure("unit", { name: unit, host: status.host });
    place(address);
    append({ e: address, a: "state", v: state ?? "unknown", t });
    if (generation) append({ e: address, a: "runs-generation", v: generation, t });
  }
  for (const row of genesisRows(rows)) {
    if (!row.e.startsWith("unit:") || row.v?.host !== status.host || seen.has(row.v.name)) continue;
    if (observedStateOf(rows, row.e).state?.value !== "not-observed") append({ e: row.e, a: "state", v: "not-observed", t });
  }
  // Held-only units are real source-observed Things even when the generation is
  // unavailable. Do not invent a running status or an affirmative native guard.
  const marked = new Set(holds.map(hold => hold.unit));
  for (const unit of marked) {
    const address = ensure("unit", { name: unit, host: status.host });
    place(address);
    if (!seen.has(unit) && !observedStateOf(rows, address).state)
      append({ e: address, a: "state", v: "not-observed", t });
  }
  if (hasHoldReading) {
    for (const row of genesisRows(rows)) {
      if (!row.e.startsWith("unit:") || row.v?.host !== status.host) continue;
      append({ e: row.e, a: "admission-hold-marker",
        v: marked.has(row.v.name) ? "present" : status.holdInventoryComplete ? "absent" : "unknown", t });
    }
  } else {
    // An old producer cannot keep a previously observed hold "present" forever.
    for (const row of genesisRows(rows)) {
      if (!row.e.startsWith("unit:") || row.v?.host !== status.host) continue;
      if (observedStateOf(rows, row.e)["admission-hold-marker"])
        append({ e: row.e, a: "admission-hold-marker", v: "unknown", t });
    }
  }

  // Release attempts: each an immutable fact, constituted at its own recorded instant.
  let attempts = 0;
  for (const entry of history) {
    const at = Date.parse(entry?.at);
    if (Number.isNaN(at)) throw new TypeError(`record-host-observation: release attempt has no parseable "at": ${JSON.stringify(entry?.at)}`);
    const attributes = { name: `release ${status.host} ${entry.at}`, host: status.host, at: entry.at };
    for (const key of ["outcome", "actor", "builder", "target", "machine", "profile", "compositionCommit", "hostCommit", "reason", "startedAt"]) {
      if (typeof entry[key] === "string" && entry[key] !== "") attributes[key] = entry[key];
    }
    const before = rows.length;
    const attempt = ensure("release-attempt", attributes, at);
    if (rows.length === before) continue; // already recorded
    attempts += 1;
    append({ e: attempt, a: "located-in", v: host, t: at }, { once: true });
    if (attributes.actor) append({ e: attempt, a: "released-by", v: attributes.actor, t: at }, { once: true });
    if (typeof entry.generation === "string" && STORE.test(entry.generation)) {
      const produced = ensure("generation", { name: entry.generation.slice("/gnu/store/".length), storePath: entry.generation }, at);
      place(produced);
      append({ e: attempt, a: "produced", v: produced, t: at }, { once: true });
    }
  }
  return { host, generation, units: units.length, attempts, rows: appended.count };
}
