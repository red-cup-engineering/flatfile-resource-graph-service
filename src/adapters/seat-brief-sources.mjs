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
  const consider = pin => {
    if (pin === null || !pin.path.endsWith(".md")) return;
    const prior = markdown.get(pin.path);
    if (prior !== undefined && prior !== pin.digest)
      throw new TypeError("one Markdown agency path is pinned to conflicting source revisions");
    markdown.set(pin.path, pin.digest);
  };
  for (const seat of brief.seats) {
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
    omitted: json.omitted,
    complete: unresolved.length === 0 && json.omitted === 0,
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
      complete: plan.complete,
    }),
  });
}
