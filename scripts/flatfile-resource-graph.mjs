import { entities, readEavtEntries, relateFromEavtRows } from "@red-cup-engineering/eavt-services-section";
import { runDischarge, runLint, runReplay, runShow, runValidate, runWitness, runWitnessLog } from "../src/cli/verbs.mjs";
import { getRecord } from "../src/kernel/record-store.mjs";
import { replayEventLog, serializeState } from "../src/kernel/replay.mjs";
import { loadFlatfiles } from "../src/substrate/read-flatfiles.mjs";
import { readLog } from "@red-cup-engineering/semiotic-eavt-services-section/store";
import { jsonSourcesProvider } from "../src/adapters/json-sources.mjs";
import { composeProviders, serializeComposition } from "../src/provider/compositor.mjs";
import { observeJsonResourceLifecycle, receiveJsonResourceLifecycleFiles } from "../src/adapters/json-resource-lifecycle.mjs";
import { readGitRefSourceSnapshot } from "../src/adapters/git-ref-sources.mjs";
import { gitTrackedLifecyclePins } from "../src/adapters/git-source-pins.mjs";

const USAGE = `flatfile-resource-graph <verb> [args]

  source-json <root> <owner-namespace-URI> <observed-at>  # JSON [{path,digest}, ...] via stdin
  source-json-lifecycle <root> <owner-namespace-URI> <observed-at>  # pinned JSON/code snapshot via stdin
  source-json-lifecycle-git <root> <owner-namespace-URI> <observed-at> [path-prefix...]  # exact committed JSON/code tree
  source-json-lifecycle-git-ref <root> <owner-namespace-URI> <observed-at> <git-ref> [path-prefix...]  # original archive/branch Git objects into same FARS Cell graph
  validate <root>
  lint <root>
  show <root> <slug-or-path>
  witness <root> <witness-id>
  witness-log <root> <channel> <at>
  discharge <root> <record-id>
  replay <root>
  list-entities <flatfile>
  read-imports <flatfile> <entity>
  read-operations <flatfile> <entity>
`;

const MAX_JSON_SOURCE_SELECTION_BYTES = 1_048_576;

/**
 * Accept the original owner's explicit source pins, not a second catalog.
 * Bound stdin BEFORE parsing it or opening the source root; the original
 * jsonSourcesProvider retains sole custody of path/digest admission.
 */
async function readJsonSelectionsFromStdin(stdin) {
  if (!stdin || typeof stdin[Symbol.asyncIterator] !== "function")
    throw new TypeError("source-json requires a bounded UTF-8 selector list on stdin");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stdin) {
    if (typeof chunk !== "string" && !(chunk instanceof Uint8Array))
      throw new TypeError("source-json selection stream must carry bytes");
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_JSON_SOURCE_SELECTION_BYTES)
      throw new RangeError("source-json selection exceeds its 1 MiB admission budget");
    chunks.push(buffer);
  }
  if (bytes === 0) throw new TypeError("source-json requires a nonempty source selection");
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new TypeError("source-json selections must be valid UTF-8 JSON");
  }
  return parsed;
}

/** Run one verb against the given streams; the result is the exit status. */
async function main({ argv, stdin, stdout, stderr }) {
  const printAndExit = (value, code = 0) => {
    stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return code;
  };
  const usageError = (message) => {
    stderr.write(`${message}\n\n${USAGE}`);
    return 2;
  };
  const [verb, ...rest] = argv;
  if (verb === undefined || verb === "help" || verb === "--help" || verb === "-h") {
    stdout.write(USAGE);
    return verb === undefined ? 2 : 0;
  }
  switch (verb) {
    case "source-json-lifecycle": {
      if (rest.length !== 3)
        return usageError("source-json-lifecycle: expected <root> <owner-namespace-URI> <observed-at>");
      const [root, namespace, observedAt] = rest;
      const sources = await readJsonSelectionsFromStdin(stdin);
      return printAndExit(await observeJsonResourceLifecycle({ root, namespace, sources, observedAt }));
    }
    case "source-json-lifecycle-git-ref": {
      if (rest.length < 4)
        return usageError("source-json-lifecycle-git-ref: expected <root> <owner-namespace-URI> <observed-at> <git-ref> [path-prefix...]");
      const [root, namespace, observedAt, ref, ...prefixes] = rest;
      const original = readGitRefSourceSnapshot({ root, ref, prefixes });
      const report = await receiveJsonResourceLifecycleFiles({ namespace, observedAt, files: original.files });
      return printAndExit(Object.freeze({ ...report,
        gitSource: Object.freeze({ kind: original.kind, sourceRef: original.sourceRef,
          sourceCommit: original.sourceCommit, sourceTree: original.sourceTree,
          sourceObjectFormat: original.sourceObjectFormat,
          sourceFiles: original.sourceFiles,
          prefixes: original.prefixes, exhaustiveRepository: false }),
      }));
    }
    case "source-json-lifecycle-git": {
      if (rest.length < 3)
        return usageError("source-json-lifecycle-git: expected <root> <owner-namespace-URI> <observed-at> [path-prefix...]");
      const [root, namespace, observedAt, ...prefixes] = rest;
      const sources = gitTrackedLifecyclePins({ root, prefixes });
      return printAndExit(await observeJsonResourceLifecycle({ root, namespace, sources, observedAt }));
    }
    case "source-json": {
      if (rest.length !== 3)
        return usageError("source-json: expected <root> <owner-namespace-URI> <observed-at>");
      const [root, namespace, observedAt] = rest;
      if (typeof observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(observedAt)
          || !Number.isFinite(Date.parse(observedAt)))
        throw new TypeError("source-json requires an explicit observation instant");
      const sources = await readJsonSelectionsFromStdin(stdin);
      const provider = jsonSourcesProvider({ id: "fars-cli:source-json", root, namespace, sources });
      const observed = await composeProviders([provider], { context: { observedAt } });
      return printAndExit(serializeComposition(observed));
    }
    case "validate":
    case "lint": {
      const [root] = rest;
      if (!root) return usageError(`${verb}: missing <root>`);
      const loaded = await loadFlatfiles(root);
      const result = verb === "validate" ? runValidate(loaded) : runLint(loaded);
      return printAndExit(result, result.diagnostics.length === 0 ? 0 : 1);
    }
    case "show": {
      const [root, target] = rest;
      if (!root || !target) return usageError("show: missing <root> <slug-or-path>");
      const { notes } = await loadFlatfiles(root);
      const note = runShow(notes, target);
      return printAndExit(note, note === null ? 1 : 0);
    }
    case "witness": {
      const [root, witnessId] = rest;
      if (!root || !witnessId) return usageError("witness: missing <root> <witness-id>");
      const record = runWitness(getRecord(root, witnessId));
      return printAndExit(record, record === null ? 1 : 0);
    }
    case "witness-log": {
      const [root, channel, at] = rest;
      if (!root || !channel || !at) return usageError("witness-log: missing <root> <channel> <at>");
      const rows = [...readLog(root, channel, at.slice(0, 10))].map(({ line }, index) => ({ entry: { e: line.e, a: line.a, v: line.v, t: line.at }, trace: index + 1 }));
      const witnessesById = {};
      for (const row of rows) {
        const id = row.entry.v;
        if (!(id in witnessesById)) witnessesById[id] = getRecord(root, id);
      }
      return printAndExit(runWitnessLog(rows, witnessesById));
    }
    case "discharge": {
      const [root, recordId] = rest;
      if (!root || !recordId) return usageError("discharge: missing <root> <record-id>");
      const result = runDischarge(replayEventLog(root), recordId);
      return printAndExit(result, result.found ? 0 : 1);
    }
    case "replay": {
      const [root] = rest;
      if (!root) return usageError("replay: missing <root>");
      const state = replayEventLog(root);
      return printAndExit(runReplay(state, serializeState(state).toString("hex")));
    }
    case "list-entities": {
      const [flatfilePath] = rest;
      if (!flatfilePath || rest.length !== 1) return usageError("list-entities: expected <flatfile>");
      return printAndExit(entities(readEavtEntries({ path: flatfilePath })));
    }
    case "read-imports": {
      const [flatfilePath, entity] = rest;
      if (!flatfilePath || !entity || rest.length !== 2) return usageError("read-imports: expected <flatfile> <entity>");
      return printAndExit(relateFromEavtRows({ rows: readEavtEntries({ path: flatfilePath }), subject: entity, predicate: "imports" }).objects);
    }
    case "read-operations": {
      const [flatfilePath, entity] = rest;
      if (!flatfilePath || !entity || rest.length !== 2) return usageError("read-operations: expected <flatfile> <entity>");
      return printAndExit(relateFromEavtRows({ rows: readEavtEntries({ path: flatfilePath }), subject: entity, predicate: "has-operation" }).objects);
    }
    default:
      return usageError(`unknown verb: ${verb}`);
  }
}

export const command = Object.freeze({
  run: main,
  resultExitCode: (status) => status,
  formatError: (error) => `${error.message}\n`,
  exitCode: 2,
});

