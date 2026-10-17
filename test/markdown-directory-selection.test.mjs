import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import fsp from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {join,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {markdownDirectoryProvider} from '../src/adapters/markdown-directory.mjs';
import * as markdownAdapter from '../src/adapters/markdown-directory.mjs';
import {DEFAULT_EXCLUDES} from '../src/substrate/store.mjs';
const note=name=>'---\ntype: text\nname: '+name+'\n---\n'+name+' body\n';
const put=(root,path,body=note(path))=>{mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),body);};
const paths=out=>out.resources.map(r=>r.cells.find(c=>c.predicate==='urn:fars:path').object);
async function trapped(root,allowedFiles,allowedDirs,operation){
 const originalRead=fsp.readFile,originalDir=fsp.readdir,files=[],dirs=[],forbidden=[];
 fsp.readFile=async function(path,...args){const rel=relative(root,String(path));files.push(rel);if(!allowedFiles.includes(rel)){forbidden.push('read:'+rel);throw Error('forbidden body read '+rel);}return originalRead.call(this,path,...args);};
 fsp.readdir=async function(path,...args){const rel=relative(root,String(path));dirs.push(rel);if(!allowedDirs.includes(rel)){forbidden.push('walk:'+rel);throw Error('forbidden directory walk '+rel);}return originalDir.call(this,path,...args);};
 syncBuiltinESMExports();
 try{const result=await operation();assert.deepEqual(forbidden,[]);return {result,files,dirs};}
 finally{fsp.readFile=originalRead;fsp.readdir=originalDir;syncBuiltinESMExports();}
}
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'fars-select-'));
 put(root,'README.md');put(root,'entry.md');put(root,'nested/README.md');put(root,'nested/entry.md');put(root,'nested/deeper/entry.md');
 for(const name of DEFAULT_EXCLUDES.filter(x=>x!=='README.md'))put(root,name+'/private.md');
 return root;
}
test('root-only selection filters bodies before acquisition and never traverses child or excluded directories',async()=>{
 const root=fixture();
 try{
  const out=await trapped(root,['README.md'],[''],()=>markdownDirectoryProvider({
   id:'test:root',root,excludes:DEFAULT_EXCLUDES.filter(x=>x!=='README.md'),maxDepth:0,includeFile:({path})=>path==='README.md',
  }).observe());
  assert.deepEqual(paths(out.result),['README.md']);assert.deepEqual(out.files,['README.md']);assert.deepEqual(out.dirs,['']);
  assert.ok(out.result.resources[0].cells.some(c=>c.predicate==='urn:fars:body-content-id'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('default observation keeps every existing exclusion and its original ordinary resources',async()=>{
 const root=fixture();
 try{
  const allowed=['entry.md','nested/entry.md','nested/deeper/entry.md'];
  const out=await trapped(root,allowed,['','nested','nested/deeper'],()=>markdownDirectoryProvider({id:'test:default',root}).observe());
  assert.deepEqual(paths(out.result),[...allowed].sort());assert.deepEqual(out.result.diagnostics,[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('native maxDepth semantics and includeFile selection are passed through without reinterpretation',async()=>{
 const root=fixture();
 try{
  const out=await trapped(root,['nested/entry.md'],['','nested'],()=>markdownDirectoryProvider({
   id:'test:depth-one',root,maxDepth:1,includeFile:({path,depth})=>depth===1&&path==='nested/entry.md',
  }).observe());
  assert.deepEqual(paths(out.result),['nested/entry.md']);
  await assert.rejects(()=>markdownDirectoryProvider({id:'test:invalid',root,maxDepth:-1}).observe(),/invalid maxDepth/u);
  await assert.rejects(()=>markdownDirectoryProvider({id:'test:invalid',root,includeFile:null}).observe(),/invalid includeFile/u);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('a root README directory or symlink is never followed by the bounded selection',async()=>{
 const root=fixture();
 try{
  rmSync(join(root,'README.md'));put(root,'README.md/private.md');
  const observe=()=>markdownDirectoryProvider({id:'test:kind',root,excludes:DEFAULT_EXCLUDES.filter(x=>x!=='README.md'),maxDepth:0,includeFile:({path})=>path==='README.md'}).observe();
  assert.deepEqual(paths((await trapped(root,[],[''],observe)).result),[]);
  rmSync(join(root,'README.md'),{recursive:true});symlinkSync(join(root,'nested/README.md'),join(root,'README.md'));
  assert.deepEqual(paths((await trapped(root,[],[''],observe)).result),[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('named root-file capability fixes exact basename selection despite unrelated caller options',async()=>{
 const root=fixture();
 try{
  const out=await trapped(root,['README.md'],[''],()=>markdownAdapter.markdownRootFileProvider({
   id:'test:named-root',root,basename:'README.md',maxDepth:Infinity,includeFile:()=>true,excludes:[],
  }).observe());
  assert.deepEqual(paths(out.result),['README.md']);assert.deepEqual(out.files,['README.md']);assert.deepEqual(out.dirs,['']);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('named root-file capability refuses traversal and non-basename targets before acquisition',async()=>{
 const root=fixture();
 try{
  const out=await trapped(root,[],[],async()=>{
   for(const basename of ['', '.', '..', '../README.md', 'nested/README.md', 'nested\\README.md', '\u0000README.md',null,undefined,{},42])
    assert.throws(()=>markdownAdapter.markdownRootFileProvider({id:'test:invalid-name',root,basename}),/basename must name one root file/u);
  });
  assert.deepEqual(out.files,[]);assert.deepEqual(out.dirs,[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('named root-file capability does not follow same-named directory or symlink',async()=>{
 const root=fixture();
 try{
  rmSync(join(root,'README.md'));put(root,'README.md/private.md');
  const observe=()=>markdownAdapter.markdownRootFileProvider({id:'test:root-kind',root,basename:'README.md'}).observe();
  assert.deepEqual(paths((await trapped(root,[],[''],observe)).result),[]);
  rmSync(join(root,'README.md'),{recursive:true});symlinkSync(join(root,'nested/README.md'),join(root,'README.md'));
  assert.deepEqual(paths((await trapped(root,[],[''],observe)).result),[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
