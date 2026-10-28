import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the original source policy routes public packages to npmjs and all private Group scopes to one house registry', () => {
  const content = readFileSync(new URL('../.npmrc', import.meta.url), 'utf8');
  const routes = content.trimEnd().split('\n');
  assert.equal(routes[0], 'registry=https://registry.npmjs.org/');
  const scopeRoutes = routes.slice(1);
  assert.deepEqual(scopeRoutes, ["561-group","causeway-services","coesite-operations","emsenn","emsweb","harmonious-union","koios-news","lenticule-science","red-cup-engineering","red-cup-science","rsc-quiescent","turntide-islands","union-officer-academy"].map(name =>
    '@' + name + ':registry=https://registry.561.group/'));
  assert.equal(new Set(scopeRoutes).size, scopeRoutes.length);
  assert.equal(content.includes('@hyperjump:registry='), false);
  assert.equal(content.includes('@foundry-rs:registry='), false);
  assert.equal(content.includes('registry=https://registry.561.group/\nregistry='), false);
});
