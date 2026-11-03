/* global Buffer, process, console, fetch */
// Reproducible, read-only extraction of a completed run. No project/branch writes.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
const run = process.env.EVIDENCE_RUN_ID, repo = process.env.GITHUB_REPOSITORY;
if (!/^\d+$/.test(run ?? "") || !/^[\w.-]+\/[\w.-]+$/.test(repo ?? "")) throw Error("Choose a valid successful run.");
const root = path.resolve(".evidence"), output = path.join(root, "output");
fs.mkdirSync(output, {recursive:true});
const headers = {Authorization:"Bearer "+process.env.GITHUB_TOKEN, Accept:"application/vnd.github+json"};
async function api(endpoint) {
  const response = await fetch("https://api.github.com/repos/"+repo+endpoint,{headers});
  if(!response.ok) throw Error("GitHub read failed: "+response.status);
  return response.json();
}
const recorded = await api("/actions/runs/"+run);
if(recorded.conclusion !== "success") throw Error("Evidence must come from a fully successful run.");
const artifacts = await api("/actions/runs/"+run+"/artifacts");
function walk(directory) {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(directory,e.name)):[path.join(directory,e.name)]);
}
async function report(name) {
  const artifact=artifacts.artifacts.find(a=>a.name===name&&!a.expired);
  if(!artifact) throw Error("Missing proof artifact: "+name);
  let response=await fetch(artifact.archive_download_url,{headers,redirect:"manual"});
  if(response.status>=300&&response.status<400) {
    const target=new URL(response.headers.get("location"),artifact.archive_download_url);
    if(target.protocol!=="https:") throw Error("Unsafe archive redirect");
    // Never forward the repository token to artifact storage.
    response=await fetch(target);
  }
  if(!response.ok) throw Error("Archive download failed: "+response.status);
  const directory=path.join(root,name), archive=directory+".zip";
  fs.mkdirSync(directory,{recursive:true});
  await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(archive));
  execFileSync("unzip",["-q",archive,"-d",directory]);
  const html=fs.readFileSync(path.join(directory,"index.html"),"utf8");
  let packed;
  for(const m of html.matchAll(/base64,([A-Za-z0-9+/=]+)/g)) {
    const bytes=Buffer.from(m[1],"base64");
    if(bytes[0]===80&&bytes[1]===75) {packed=bytes;break;}
  }
  if(!packed) throw Error("Missing report payload");
  const dataZip=path.join(directory,"data.zip"), dataDir=path.join(directory,"report-data");
  fs.writeFileSync(dataZip,packed);fs.mkdirSync(dataDir);
  execFileSync("unzip",["-q",dataZip,"-d",dataDir]);
  const tests=walk(dataDir).filter(f=>f.endsWith(".json")).flatMap(f=>{
    const value=JSON.parse(fs.readFileSync(f,"utf8"));return Array.isArray(value.tests)?value.tests:[];
  });
  if(tests.some(t=>t.outcome!=="expected"||t.results.length!==1)) throw Error("Report contains a failure, skip or retry");
  const attachments=tests.flatMap(t=>t.results[0].attachments??[]);
  function attachment(name) {
    const a=attachments.find(a=>a.name===name);
    if(!a) throw Error("Missing recorded evidence: "+name);
    return a;
  }
  function json(name) {const a=attachment(name);return JSON.parse(a.body??fs.readFileSync(path.join(directory,a.path),"utf8"));}
  function file(name) {const a=attachment(name);return path.join(directory,a.path);}
  return {artifact,tests,attachments,json,file};
}
const regression=await report("browser-qa-report"), episode=await report("complete-episode-qa-report");
const production=episode.json("twenty-minute-proof");
if(production.logicalSeconds!==1200||production.parts.length!==10||!production.completePortableRestore||!production.unchangedSource) throw Error("Incomplete production evidence");
for(const [i,p] of production.parts.entries()) {
  if(p.storyStart!==i*120||p.storyEnd!==(i+1)*120||p.voiceAlignment.length!==6||p.voiceAlignment.some(a=>a.correlation<=0.7)) throw Error("Missing segment continuity evidence");
}
const files=[];
function keep(source,target) {const destination=path.join(output,target);fs.copyFileSync(source,destination);files.push(target);}
for(const [name,target] of [
  ["desktop-long-voices-dark","episode-voices-desktop.png"],
  ["phone-long-voices-light","episode-voices-phone.png"],
  ["tablet-episode-readiness","episode-readiness-tablet.png"],
  ["desktop-episode-readiness","episode-readiness-desktop.png"],
]) keep(regression.file(name),target);
for(const n of [1,5,10]) keep(episode.file("part-"+n+"-frame"),"episode-part-"+n+"-frame.png");
const samples=[];
for(const n of [1,5,10]) {
  const target="episode-sample-part-"+String(n).padStart(2,"0")+".webm", destination=path.join(output,target);
  // Remux the original encoded packets; these are actual movie excerpts.
  execFileSync("ffmpeg",["-v","error","-i",episode.file("part-"+n+"-complete-video"),"-t","5","-map","0:v:0","-map","0:a:0","-c","copy",destination]);
  const probe=JSON.parse(execFileSync("ffprobe",["-v","error","-show_streams","-show_format","-of","json",destination],{encoding:"utf8"}));
  samples.push({file:target,part:n,duration:Number(probe.format.duration),streams:probe.streams.map(s=>({type:s.codec_type,codec:s.codec_name,width:s.width,height:s.height}))});
  files.push(target);
}
const media={};
for(const a of regression.attachments) if(a.name.endsWith("media-proof")||a.name.endsWith("encoder-capabilities")||a.name==="segmented-timeline-continuity") media[a.name]=regression.json(a.name);
const metrics={
  verifiedCommit:recorded.head_sha,run:"https://github.com/"+repo+"/actions/runs/"+run,
  regressionCases:regression.tests.length,regressionRetries:0,regressionSkips:0,
  projects:Object.fromEntries([...new Set(regression.tests.map(t=>t.projectName))].map(name=>[name,regression.tests.filter(t=>t.projectName===name).length])),
  production,media,samples,
  artifacts:[regression.artifact,episode.artifact].map(a=>({id:a.id,name:a.name,sha256:a.digest,bytes:a.size_in_bytes})),
  files:files.map(file=>({file,bytes:fs.statSync(path.join(output,file)).size,sha256:createHash("sha256").update(fs.readFileSync(path.join(output,file))).digest("hex")})),
};
const metadata="episode-verification.json";fs.writeFileSync(path.join(output,metadata),JSON.stringify(metrics,null,2));files.unshift(metadata);
for(const file of files) {
  const bytes=fs.readFileSync(path.join(output,file)),base64=bytes.toString("base64");
  console.log("CHIPTOONS_EVIDENCE_BEGIN "+file+" "+bytes.length);
  for(let offset=0;offset<base64.length;offset+=32768) console.log("CHIPTOONS_EVIDENCE_DATA "+base64.slice(offset,offset+32768));
  console.log("CHIPTOONS_EVIDENCE_END "+file);
}
console.log("Recorded source verified: "+recorded.head_sha+"; all ten parts, all sixty narration sections.");
