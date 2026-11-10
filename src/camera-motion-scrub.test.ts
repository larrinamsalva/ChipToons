import { describe, expect, it } from "vitest";
import { adjacentCameraRiskTime, cameraRiskMarkerOffset,
  cameraScrubWindow, inCameraScrubWindow } from "./camera-motion-scrub";

describe("review-only camera motion scrubber",()=>{
 it("keeps the slider in the half-open shot and supports tiny scenes",()=>{
  expect(cameraScrubWindow(1.2,3.2)).toEqual({start:1.2,end:3.1950000000000003});
  const small=cameraScrubWindow(.5,.6)!;
  expect(small.end).toBeLessThan(.6);
  expect(small.end).toBeGreaterThan(.55);
  expect(cameraScrubWindow(2,2)).toBeUndefined();
  expect(cameraScrubWindow(Number.NaN,2)).toBeUndefined();
  const win=cameraScrubWindow(1,3)!;
  expect(inCameraScrubWindow(0,win)).toBe(1);
  expect(inCameraScrubWindow(4,win)).toBeCloseTo(2.995);
  expect(cameraRiskMarkerOffset(1,win)).toBeCloseTo(0);
  expect(cameraRiskMarkerOffset(win.end,win)).toBeCloseTo(100);
 });
 it("steps between real flagged sample times without inventing new ones",()=>{
  const win=cameraScrubWindow(0,2)!;
  const risk=[1.8,.5,1,3,Number.NaN,-1,1.8];
  expect(adjacentCameraRiskTime(risk,0,"previous",win)).toBeUndefined();
  expect(adjacentCameraRiskTime(risk,0,"next",win)).toBe(.5);
  expect(adjacentCameraRiskTime(risk,.5,"next",win)).toBe(1);
  expect(adjacentCameraRiskTime(risk,1.3,"previous",win)).toBe(1);
  expect(adjacentCameraRiskTime(risk,1.8,"next",win)).toBeUndefined();
  expect(adjacentCameraRiskTime(risk,1.8,"previous",win)).toBe(1);
 });
});
