import { cell } from "@red-cup-engineering/signcell/cell";
import { readPinnedTextSources, REPOSITORY_TEXT_EXTENSIONS } from "./pinned-sources.mjs";
import { analyzeJsonResourceLifecycle } from "../provider/json-resource-lifecycle.mjs";
import { defineProvider } from "../provider/provider.mjs";
import { composeProviders } from "../provider/compositor.mjs";

/** Read a bounded source snapshot into the original FARS provider/compositor. */
export async function observeJsonResourceLifecycle({ root, namespace, sources, observedAt }) {
  if (typeof observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(observedAt) || !Number.isFinite(Date.parse(observedAt)))
    throw new TypeError("JSON lifecycle requires an explicit observation instant");
  const files = await readPinnedTextSources({ root, sources, extensions: REPOSITORY_TEXT_EXTENSIONS });
  const report = analyzeJsonResourceLifecycle({ namespace, files });
  const resources = report.resources.map(source => Object.freeze({
    resource: source.resource, focus: source.focus, observedAt,
    cells: Object.freeze(report.cells.flatMap(at => {
      const witnesses = at.for.filter(witness => witness.sourcePath === source.sourcePath);
      return witnesses.length ? [cell(at.subject, at.predicate, at.object, { for: witnesses })] : [];
    })), diagnostics: Object.freeze([]),
  }));
  const provider = defineProvider({ id: "fars:json-resource-lifecycle", async observe() {
    return Object.freeze({ resources: Object.freeze(resources), diagnostics: Object.freeze([]) });
  } });
  const composition = await composeProviders([provider], { context: { observedAt } });
  return Object.freeze({ ...report, cells: composition.cells,
    providers: composition.providers, diagnostics: composition.diagnostics });
}
