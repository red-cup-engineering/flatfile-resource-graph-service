import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { analyzeJsonResourceLifecycle, jsonSourceFocus } from '../src/provider/json-resource-lifecycle.mjs';
import { receiveJsonResourceLifecycleFiles } from '../src/adapters/json-resource-lifecycle.mjs';
import { isCell } from '@red-cup-engineering/signcell/cell';

const owner = 'https://github.com/red-cup-engineering/flatfile-resource-graph-service';
const at = '2026-10-27T21:34:00.000Z';
const sha = text => 'sha256:' + createHash('sha256').update(text).digest('hex');
const source = (path, text) => ({path,text,revision:sha(text)});
const PROV = 'http://www.w3.org/ns/prov#';

test('each JSONL occurrence enters the SAME FARS/SignCell graph with original file and row identities', () => {
  const text = '{"id":"alpha","data":{"val":1}}\n{"id":"alpha","data":{"val":1}}\n';
  const report = analyzeJsonResourceLifecycle({ namespace:owner,
    files:[source('ingress/alias-map.jsonl',text)] });
  assert.equal(report.resources.length,2);
  const [a,b] = report.resources;
  assert.equal(a.sourceFilePath,'ingress/alias-map.jsonl');
  assert.equal(a.sourcePath,'ingress/alias-map.jsonl#L1');
  assert.equal(b.sourcePath,'ingress/alias-map.jsonl#L2');
  assert.notEqual(a.resource,b.resource,'repeated shorthand must not collapse separate source occurrences');
  assert.equal(a.contentDigest,sha(text));
  assert.equal(b.contentDigest,sha(text));
  assert.equal(a.sourceOccurrence.rowContentDigest,b.sourceOccurrence.rowContentDigest);
  assert.equal(a.sourceOccurrence.lineNumber,1);
  assert.equal(b.sourceOccurrence.lineNumber,2);
  assert.equal(a.classification,'unclaimed-in-snapshot');
  assert.ok(a.actions.some(action => action.action === 'bind-runtime-consumer'));
  assert.ok(a.actions.some(action => action.action === 'define-property-meaning' && action.key === 'id'));
  assert.ok(report.cells.every(isCell));
  const fileResource = jsonSourceFocus(owner,'ingress/alias-map.jsonl') + ':' + sha(text);
  assert.ok(report.cells.some(row => row.subject === a.resource &&
    row.predicate === PROV + 'wasDerivedFrom' && row.object === fileResource));
  assert.ok(report.cells.some(row => row.subject === fileResource &&
    row.predicate === 'urn:fars:type' && row.object === 'urn:fars:type:source-jsonl'));
  const line = report.cells.find(row => row.subject === b.resource &&
    row.predicate.endsWith('line-number'));
  assert.equal(line.object,2);
  assert.equal(line.for[0].sourceOccurrence.lineNumber,2);
  assert.deepEqual(report.scope.sources.map(s=>s.sourcePath),['ingress/alias-map.jsonl']);
});

test('a code mention of the ORIGINAL JSONL path is only a reference, not an executed reader', () => {
  const content = '{"claim":"unknown"}\n';
  const report=analyzeJsonResourceLifecycle({namespace:owner,files:[
    source('data/claims.jsonl',content),
    source('src/read.mjs','const sourcePath = "data/claims.jsonl";'),
  ]});
  assert.equal(report.resources[0].classification,'referenced');
  assert.equal(report.resources[0].references[0].sourcePath,'src/read.mjs');
  assert.ok(report.resources[0].actions.some(x=>x.action==='qualify-runtime-connection'));
  assert.equal(report.resources[0].declaredConnections.length,0);
});

test('each JSONL row can inherit a genuinely declared source-owned JSON Schema, not an id-key guess', () => {
  const id = 'https://example.test/source-row.schema.json';
  const schema = {
    $schema:'https://json-schema.org/draft/2020-12/schema',
    $id:id,title:'Observed source row',description:'An exact recorded source occurrence.',
    type:'object',required:['$schema','id','val'],
    properties:{
      $schema:{type:'string'},
      id:{type:'string',title:'Original source occurrence identifier'},
      val:{type:'number',description:'Native source measurement'},
    },additionalProperties:false,
  };
  const text=JSON.stringify({$schema:id,id:'one',val:1})+'\n';
  const report=analyzeJsonResourceLifecycle({namespace:owner,files:[
    source('schemas/row.json',JSON.stringify(schema)),source('data/row.jsonl',text),
  ]});
  const row=report.resources.find(x=>x.sourcePath==='data/row.jsonl#L1');
  assert.equal(row.schema.status,'admitted');
  assert.equal(row.properties.find(x=>x.key==='id').opaqueWithoutDefinition,false);
  assert.equal(row.actions.some(x=>x.action==='define-property-meaning'&&x.key==='id'),false);
  assert.ok(report.cells.some(x=>x.subject===row.resource&&x.predicate==='http://purl.org/dc/terms/conformsTo'));
});

test('malformed, mismatched or blank JSONL source rejects the entire pure analysis', () => {
  for (const text of ['{"ok":1}\n{"wrong":', '{}\n\n{}']) {
    assert.throws(()=>analyzeJsonResourceLifecycle({namespace:owner,
      files:[source('data/claims.jsonl',text)]}));
  }
  const row=source('data/claims.jsonl','{"id":"x"}\n');
  assert.throws(()=>analyzeJsonResourceLifecycle({namespace:owner,
    files:[{...row,text:'{"id":"altered"}\n'}]}),/digest differs/);
});

test('original FARS provider/compositor receives each row without a duplicate ledger or second scanner', async () => {
  const text='{"id":"one"}\n{"id":"two"}\n';
  const received=await receiveJsonResourceLifecycleFiles({namespace:owner,observedAt:at,
    files:[source('content/rows.jsonl',text)]});
  assert.equal(received.resources.length,2);
  assert.equal(received.providers.length,1);
  assert.ok(received.cells.every(isCell));
  const subjects=new Set(received.resources.map(row=>row.resource));
  assert.equal(subjects.size,2);
  for(const row of received.resources){
    assert.ok(received.cells.some(cell=>cell.subject===row.resource &&
      cell.predicate==='urn:fars:source-revision' && cell.object===sha(text)));
  }
});

test('ordinary JSON preserves its preexisting focus and source-resource identity', () => {
  const record=source('data/original.json','{"id":"existing"}');
  const report=analyzeJsonResourceLifecycle({namespace:owner,files:[record]});
  assert.equal(report.resources.length,1);
  assert.equal(report.resources[0].resource,jsonSourceFocus(owner,record.path)+':'+record.revision);
  assert.equal(report.resources[0].sourceFilePath,undefined);
});
