// flatfile-world-verbs — this package's look, go, and say operations as a
// plain verbs module: every named export is one verb function, each carrying a `.spec`
// ({args, returns, refusal}) and, where it has one, an `.effects` array — the shape
// computer-system-engine's generic stdio verb server (scripts/serve-verbs-over-stdio.mjs) loads
// with `--verbs @red-cup-engineering/flatfile-resource-graph-service/flatfile-world-verbs`.
// Invents and ports nothing: every verb is a direct call to a function this package already
// publishes (./lagoon-world's lookWorld/moveInWorld/speakInWorld). The inspect-resource verb is
// code (it runs the code-development engine's package-resource inspection) and lives in
// computer-code-development-engine/flatfile-inspection-verbs.
//
// Formerly declared inline in computer-deployment-engine's former composite worker script, as LAGOON
// only transported the admitted request across its Guile process boundary — this package owns
// the operation, so this is where its verb contract now lives.

import * as lagoonWorld from "../src/lagoon-world.mjs";
import { readWorldRecord, seedWorld } from "../src/seed-world.mjs";
import { migrateLegacyWorld } from "../src/legacy-world.mjs";
import { recordHostObservation, OBSERVATION_SCHEMA } from "../src/world-observation.mjs";
import { REFUSAL_SCHEMA } from "@red-cup-engineering/computer-data-engineering-services-section/operation-refusal-schema";

const ROW_SCHEMA = {
  type: "object",
  properties: { e: { type: "string" }, a: { type: "string" }, v: {}, t: { type: "number" } },
  required: ["e", "a", "v", "t"],
};

// compose a place + its located-in things + their folded fibers off an on-disk trace.
export function look({ path, place }) {
  return lagoonWorld.lookWorld(path, place);
}
look.spec = {
  args: {
    type: "object",
    properties: { path: { type: "string" }, place: { type: "string" } },
    required: ["path", "place"],
  },
  returns: {
    type: "object",
    properties: {
      address: {},
      placeAttributes: {},
      placeObserved: { type: "object" },
      things: { type: "array" },
      recentDuties: { type: "array" },
    },
    required: ["address", "placeAttributes", "things"],
  },
  refusal: REFUSAL_SCHEMA,
};
look.effects = ["filesystem:read"];

// move an already-constituted actor to a named place.
export function go({ path, actor, place, t }) {
  return lagoonWorld.moveInWorld(path, actor, place, t);
}
go.spec = {
  args: {
    type: "object",
    properties: {
      path: { type: "string" },
      actor: { type: "string" },
      place: { type: "string" },
      t: { type: "number" },
    },
    required: ["path", "actor", "place", "t"],
  },
  returns: {
    type: "object",
    properties: { address: { type: "string" }, actor: { type: "string" }, place: { type: "string" } },
    required: ["address", "actor", "place"],
  },
  refusal: REFUSAL_SCHEMA,
};
go.effects = ["filesystem:read", "filesystem:write"];

// constitute+append an utterance attributed to its speaker and place.
export function say({ path, speaker, place, text, t }) {
  return lagoonWorld.speakInWorld(path, speaker, place, text, t);
}
say.spec = {
  args: {
    type: "object",
    properties: {
      path: { type: "string" },
      speaker: { type: "string" },
      place: { type: "string" },
      text: { type: "string" },
      t: { type: "number" },
    },
    required: ["path", "speaker", "place", "text", "t"],
  },
  returns: {
    type: "object",
    properties: { address: { type: "string" }, place: { type: "string" }, genesisRow: ROW_SCHEMA },
    required: ["address", "place", "genesisRow"],
  },
  refusal: REFUSAL_SCHEMA,
};
say.effects = ["filesystem:write"];

// constitute the world's first born entities (machines, platforms, places) from a dated record
// {measuredAt, entities:[{kind, attributes}]}, given inline or by path. Idempotent.
function seedWorldVerb({ path, record, recordPath }) {
  if ((record === undefined) === (recordPath === undefined)) throw new TypeError("seed-world: give exactly one of record or recordPath");
  return { results: seedWorld({ path, record: record ?? readWorldRecord(recordPath) }) };
}
seedWorldVerb.spec = {
  args: {
    type: "object",
    properties: { path: { type: "string" }, record: { type: "object" }, recordPath: { type: "string" } },
    required: ["path"],
  },
  returns: {
    type: "object",
    properties: { results: { type: "array", items: { type: "object", properties: { address: { type: "string" }, skipped: { type: "boolean" } }, required: ["address", "skipped"] } } },
    required: ["results"],
  },
  refusal: REFUSAL_SCHEMA,
};
seedWorldVerb.effects = ["filesystem:read", "filesystem:write"];

// record one host observation (scripts/status.mjs's hostStatus shape) as append-only,
// time-stamped world facts; see ./world-observation for the fact schema.
function recordHostObservationVerb({ path, status, t, observer }) {
  return { schema: OBSERVATION_SCHEMA, ...recordHostObservation({ path, status, t, observer }) };
}
recordHostObservationVerb.spec = {
  args: {
    type: "object",
    properties: { path: { type: "string" }, status: { type: "object" }, t: { type: "number" }, observer: { type: "string" } },
    required: ["path", "status", "t"],
  },
  returns: {
    type: "object",
    properties: { schema: { type: "string" }, host: { type: "string" }, generation: {}, units: { type: "number" }, attempts: { type: "number" }, rows: { type: "number" } },
    required: ["schema", "host", "units", "attempts", "rows"],
  },
  refusal: REFUSAL_SCHEMA,
};
recordHostObservationVerb.effects = ["filesystem:read", "filesystem:write"];

// carry a world trace written in the old base64-CBOR row encoding into the current row encoding,
// preserving every row exactly; the legacy file is only read.
function migrateLegacyWorldVerb({ from, path }) {
  return migrateLegacyWorld({ from, path });
}
migrateLegacyWorldVerb.spec = {
  args: { type: "object", properties: { from: { type: "string" }, path: { type: "string" } }, required: ["from", "path"] },
  returns: {
    type: "object",
    properties: { read: { type: "number" }, appended: { type: "number" }, skipped: { type: "number" }, refused: { type: "array" } },
    required: ["read", "appended", "skipped", "refused"],
  },
  refusal: REFUSAL_SCHEMA,
};
migrateLegacyWorldVerb.effects = ["filesystem:read", "filesystem:write"];

export { seedWorldVerb as "seed-world", recordHostObservationVerb as "record-host-observation", migrateLegacyWorldVerb as "migrate-legacy-world" };
