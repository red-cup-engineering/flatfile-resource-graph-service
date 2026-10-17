import { jsonSourcesProvider, selectSeatBriefJsonSources } from "./json-sources.mjs";
import { markdownDirectoryProvider } from "./markdown-directory.mjs";
import { composeProviders } from "../provider/compositor.mjs";
import { sourceNamespace } from "../provider/source-namespace.mjs";
import { sourceSelections } from "../provider/source-selections.mjs";

/**
 * Compose the already held Organizing seat brief into native FARS documentary
 * providers. The authenticated caller supplies one exact agency source root
 * and its owner namespace. These providers NEVER create an incumbency, power,
 * Work Arena move, or execution authority.
 *
 * Unknown source pins and omitted sources remain explicit in the plan.
 */
export function seatBriefSourceProviders({ brief, root, namespace, id }) {
  if (typeof id !== "string" || !id.trim())
    throw new TypeError("a source-provider id is required");
  if (typeof root !== "string" || !root.trim())
    throw new TypeError("a source-owning agency root is required");
  sourceNamespace(namespace);
  const json = selectSeatBriefJsonSources(brief);
  const markdown = new Map();
  let workOmitted = 0, ambiguityOmitted = 0, metadataOmitted = 0;
  const workAmbiguities = [];
  const consider = pin => {
    if (pin === null || !pin.path.endsWith(".md")) return;
    const prior = markdown.get(pin.path);
    if (prior !== undefined && prior !== pin.digest)
      throw new TypeError("one Markdown agency path is pinned to conflicting source revisions");
    markdown.set(pin.path, pin.digest);
  };
  for (const seat of brief.seats) {
    for (const field of ["moreReportsTo", "moreAuthorityScope", "moreDuties",
      "moreSkills", "moreReceivesFrom", "moreAssignsTo", "moreEnterprises"]) {
      const omitted = seat[field] ?? 0;
      if (!Number.isSafeInteger(omitted) || omitted < 0 ||
        !Number.isSafeInteger(metadataOmitted + omitted))
        throw new TypeError("seat brief metadata remainder is not a bounded source reading");
      metadataOmitted += omitted;
    }
    if (!Number.isSafeInteger(seat.moreWork) || seat.moreWork < 0 ||
        !Number.isSafeInteger(workOmitted + seat.moreWork))
      throw new TypeError("seat brief has no bounded Work Arena omission count");
    workOmitted += seat.moreWork;
    const collisions = seat.ambiguousEnterprises ?? [];
    const further = seat.moreAmbiguousEnterprises ?? 0;
    if (!Array.isArray(collisions) || !Number.isSafeInteger(further) || further < 0 ||
        !Number.isSafeInteger(ambiguityOmitted + further))
      throw new TypeError("seat brief enterprise identity ambiguity is malformed");
    ambiguityOmitted += further;
    for (const collision of collisions) {
      if (typeof collision?.id !== "string" || !collision.id ||
          !Array.isArray(collision.candidates) || collision.candidates.length < 2 ||
          collision.candidates.length > 8 ||
          collision.candidates.some(key => typeof key !== "string" || !key) ||
          !Number.isSafeInteger(collision.moreCandidates) || collision.moreCandidates < 0)
        throw new TypeError("sovereign enterprise player candidates are malformed");
      if (workAmbiguities.length < 64) workAmbiguities.push(Object.freeze({
        office: seat.office, id: collision.id,
        candidates: Object.freeze([...collision.candidates]),
        moreCandidates: collision.moreCandidates,
      }));
      else ambiguityOmitted += 1;
    }
    consider(seat.source);
    for (const group of ["duties", "skills", "works"])
      for (const entry of seat.sourceRecords[group].records) consider(entry.source);
  }
  const markdownSources = markdown.size === 0 ? Object.freeze([]) :
    sourceSelections([...markdown].map(([path, digest]) => ({ path, digest })), { extension: ".md" });
  const unresolved = Object.freeze(json.unresolved.filter(
    issue => issue.reason !== "requires-appropriate-non-json-provider" || !markdown.has(issue.path)));
  const providers = Object.freeze([
    ...(json.sources.length === 0 ? [] : [jsonSourcesProvider({
      id: `${id}:json`, root, namespace, sources: json.sources,
    })]),
    ...(markdownSources.length === 0 ? [] : [markdownDirectoryProvider({
      id: `${id}:markdown`, root, namespace, pins: markdownSources,
    })]),
  ]);
  return Object.freeze({
    kind: "fars.seat-brief-source-plan",
    bearer: brief.bearer,
    providers,
    jsonSources: json.sources,
    markdownSources,
    unresolved,
    omitted: json.omitted, workOmitted, metadataOmitted,
    workAmbiguities: Object.freeze(workAmbiguities), ambiguityOmitted,
    sourcesComplete: unresolved.length === 0 && json.omitted === 0,
    complete: unresolved.length === 0 && json.omitted === 0 && workOmitted === 0
      && metadataOmitted === 0 && workAmbiguities.length === 0 && ambiguityOmitted === 0,
  });
}

/** Read the selected exact source bytes into the existing FARS/DREW graph. */
export async function observeSeatBriefResources(input, { observedAt } = {}) {
  const plan = seatBriefSourceProviders(input);
  if (plan.providers.length === 0)
    throw new TypeError("no source-pinned agency records can be observed");
  const graph = await composeProviders(plan.providers, {
    context: observedAt === undefined ? {} : { observedAt },
  });
  return Object.freeze({
    ...graph,
    sourcePlan: Object.freeze({
      kind: plan.kind, bearer: plan.bearer,
      jsonSources: plan.jsonSources, markdownSources: plan.markdownSources,
      unresolved: plan.unresolved, omitted: plan.omitted,
      workOmitted: plan.workOmitted, metadataOmitted: plan.metadataOmitted,
      workAmbiguities: plan.workAmbiguities,
      ambiguityOmitted: plan.ambiguityOmitted, sourcesComplete: plan.sourcesComplete,
      complete: plan.complete,
    }),
  });
}
