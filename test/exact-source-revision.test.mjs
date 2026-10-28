import assert from "node:assert/strict";
import test from "node:test";
import { exactSourceRevision, admitExactTextSourceRevisions, MAX_SOURCE_BYTES } from "../src/provider/exact-source-revision.mjs";

const selected = (path, text) => ({ path, text, revision: exactSourceRevision(text) });

test("the pure source admission receives the same source bytes as the file adapter", () => {
  const text = JSON.stringify({ name: "observation", values: [2.75, 2.75] });
  const revision = exactSourceRevision(text);
  assert.equal(revision, exactSourceRevision(Buffer.from(text, "utf8")));
  assert.equal(admitExactTextSourceRevisions([selected("data/record.json", text)]).length, 1);
});

test("the pure source admission refuses a substituted revision even with the same text length", () => {
  const original = selected("data/record.json", '{"value":1}');
  assert.throws(() => admitExactTextSourceRevisions([{ ...original, text: '{"value":2}' }]), /digest differs/);
  assert.throws(() => admitExactTextSourceRevisions([original, original]), /exact and distinct/);
});

test("the pure source admission enforces its byte ceiling before graph construction", () => {
  assert.throws(() => exactSourceRevision("a".repeat(MAX_SOURCE_BYTES + 1)), /1 MiB/);
  assert.throws(() => admitExactTextSourceRevisions([]), /bounded exact/);
});
