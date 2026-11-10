import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { liveCameraFraming } from "./camera-motion-framing";
import { newCameraShot } from "./shot-director";
import { stageCameraAt } from "./timeline";

describe("live camera framing meter",()=>{
  it("samples the same camera values used by the real Stage without modifying the cartoon",()=>{
    const project=cameraShotDemo(),scene=project.scenes[0];
    const source=JSON.stringify(project);
    for(const time of [0,1.2,2,8.1,scene.duration-0.001]){
      const measured=liveCameraFraming(project,scene,time);
      const fromStage=stageCameraAt(project,scene,time);
      expect(measured.camera.x).toBeCloseTo(fromStage.x,6);
      expect(measured.camera.y).toBeCloseTo(fromStage.y,6);
      expect(measured.camera.zoom).toBeCloseTo(fromStage.zoom,6);
      expect(measured.coverage.time).toBe(time);
      expect(measured.coverage.outsideFraction).toBeGreaterThanOrEqual(0);
      expect(measured.coverage.outsideFraction).toBeLessThanOrEqual(1);
    }
    expect(JSON.stringify(project)).toBe(source);
  });

  it("shows exposure on the exact moment of a source-boundary crossing",()=>{
    const p=cameraShotDemo(),source=JSON.stringify(p),scene=p.scenes[0];
    const shot={...newCameraShot(p,scene,0),
      start:0,end:2,move:2,style:"move" as const,
      fromFrame:{x:100,y:225,zoom:1},
      frame:{x:400,y:225,zoom:1},targets:[],follow:false,
    };
    const proposed={...scene,cameraShots:[shot]};
    const early=liveCameraFraming(p,proposed,0);
    const middle=liveCameraFraming(p,proposed,1);
    const late=liveCameraFraming(p,proposed,1.999);
    expect(early.camera.zoom).toBe(1);
    expect(early.coverage.edges).toEqual(["left"]);
    expect(early.coverage.outsideFraction).toBeGreaterThan(.3);
    expect(middle.coverage.outsideFraction).toBeGreaterThan(0);
    expect(late.coverage.edges).toEqual([]);
    expect(JSON.stringify(p)).toBe(source);
  });
});
