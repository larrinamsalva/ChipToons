import { describe, expect, it } from "vitest";
import { adjacentCameraRiskTime, cameraRiskMarkerOffset,
  cameraScrubWindow, inCameraScrubWindow, cameraSettleTiming } from "./camera-motion-scrub";

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


describe("camera finish and hold guide",()=>{
 it("marks exact finish, hold length and seek point for a normal shot",()=>{
  const window=cameraScrubWindow(0,2)!;
  const g=cameraSettleTiming({start:0,end:2,move:1.5},window)!;
  expect(g.settleAt).toBe(1.5);
  expect(g.holdSeconds).toBe(.5);
  expect(g.seekAt).toBe(1.5);
  expect(g.markerPercent).toBeCloseTo(75.18,1);
 });
 it("uses last in-shot frame for a full-duration glide, never the next shot",()=>{
  const window=cameraScrubWindow(0,2)!;
  const guide=cameraSettleTiming({start:0,end:2,move:2},window)!;
  expect(guide.settleAt).toBe(2);
  expect(guide.holdSeconds).toBe(0);
  expect(guide.seekAt).toBeLessThan(2);
  expect(guide.seekAt).toBeCloseTo(1.995);
  expect(guide.markerPercent).toBe(100);
 });
 it("accounts for a shot starting later in an entire sequence review",()=>{
  const window=cameraScrubWindow(0,5)!;
  const guide=cameraSettleTiming({start:2,end:4,move:1},window)!;
  expect(guide.settleAt).toBe(3);
  expect(guide.holdSeconds).toBe(1);
  expect(guide.seekAt).toBe(3);
 });
 it("rejects bad or outside shot metadata without writing anything",()=>{
  const win=cameraScrubWindow(0,2)!;
  expect(cameraSettleTiming({start:0,end:2,move:0},win)).toBeUndefined();
  expect(cameraSettleTiming({start:0,end:2,move:3},win)).toBeUndefined();
  expect(cameraSettleTiming({start:2,end:2,move:1},win)).toBeUndefined();
  expect(cameraSettleTiming({start:5,end:6,move:1},win)).toBeUndefined();
 });
});
