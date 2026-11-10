import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { cameraMotionArtworkChecks, cameraMotionArtworkSweep } from "./camera-motion-framing";
import { CameraMotionContactSheet } from "./components/CameraMotionContactSheet";
import { uid } from "./model";
import { newCameraShot } from "./shot-director";

describe("read-only full camera-move edge sweep",()=>{
  it("inspects 21 half-open times without duplicating the following shot",()=>{
    const p=cameraShotDemo(),scene=p.scenes[0],shot={start:0,end:2};
    const sweep=cameraMotionArtworkSweep(p,scene,shot);
    expect(sweep.checks).toHaveLength(21);
    expect(sweep.checks[0].time).toBe(0);
    expect(sweep.checks[10].time).toBe(1);
    expect(sweep.checks[20].time).toBeCloseTo(1.995);
    expect(sweep.checks.every(check=>check.time<2)).toBe(true);
    expect(cameraMotionArtworkSweep(p,scene,{start:2,end:2}).checks).toEqual([]);
  });

  it("finds an unsafe quarter-second between three safe full previews",()=>{
    const project=cameraShotDemo(), before=JSON.stringify(project);
    const original=project.scenes[0];
    const scene={...original,cameraShots:undefined,
      cameraAnimation:{ keyframes:[
        {id:uid(),time:0,easing:"linear" as const,x:400,y:225,zoom:1},
        {id:uid(),time:0.5,easing:"linear" as const,x:100,y:225,zoom:1},
        {id:uid(),time:1,easing:"linear" as const,x:400,y:225,zoom:1},
        {id:uid(),time:2,easing:"linear" as const,x:400,y:225,zoom:1},
      ]},
    };
    const shot={...newCameraShot(project,scene,0),start:0,end:2};
    const three=cameraMotionArtworkChecks(project,scene,shot);
    expect(three).toHaveLength(3);
    expect(three.every(check=>check.edges.length===0)).toBe(true);
    const sweep=cameraMotionArtworkSweep(project,scene,shot);
    expect(sweep.flaggedCount).toBeGreaterThan(0);
    expect(sweep.worst?.time).toBeCloseTo(0.5,2);
    expect(sweep.worst?.edges).toContain("left");
    expect(sweep.worst?.outsideFraction).toBeGreaterThan(0.25);
    const rendered=renderToStaticMarkup(createElement(CameraMotionContactSheet,{
      project,scene,shot,onInspectTime:()=>{},
    }));
    expect(rendered).toContain("Artwork-edge check: no canvas edges exposed at the three sampled times.");
    expect(rendered).toMatch(/Full-move scan: \d+ of 21 sampled moments/);
    expect(rendered).toContain("Worst sampled moment:");
    expect(rendered).toContain("Inspect worst sampled moment in preview");
    expect(JSON.stringify(project)).toBe(before);
  });

  it("labels safe full scans without inventing a problem or callback",()=>{
    const project=cameraShotDemo(),scene={...project.scenes[0],
      cameraShots:undefined,cameraAnimation:undefined};
    const shot={...newCameraShot(project,scene,0),start:0,end:2};
    const sweep=cameraMotionArtworkSweep(project,scene,shot);
    expect(sweep.flaggedCount).toBe(0);
    expect(sweep.worst).toBeUndefined();
    const output=renderToStaticMarkup(createElement(CameraMotionContactSheet,{project,scene,shot}));
    expect(output).toContain("Full-move scan: no canvas overrun found at 21 sampled moments.");
    expect(output).not.toContain("Inspect worst sampled moment in preview");
  });
});
