/** Camera-only preview helpers. Never store these values in a saved project. */
export type CameraScrubWindow = { start: number; end: number };

/** Clamp to the shot's half-open time range so the end doesn't jump into
 * the next shot. Uses the same end margin as the motion contact sheet. */
export function cameraScrubWindow(start:number,end:number):CameraScrubWindow|undefined {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end<=start) return;
  return {start,end:end-Math.min(.005,(end-start)/10)};
}

export function inCameraScrubWindow(time:number,window:CameraScrubWindow) {
  return Math.max(window.start,Math.min(window.end,time));
}

/** Find the next flagged sweep time in the current preview window.
 * Crossing it with keyboard controls never changes the saved shot. */
export function adjacentCameraRiskTime(
  times:readonly number[],current:number,
  direction:"previous"|"next",window:CameraScrubWindow,
) {
  const filtered=times.filter(t=>Number.isFinite(t)&&t>=window.start&&t<=window.end);
  if(direction==="next") return filtered.filter(t=>t>current+.0005).sort((a,b)=>a-b)[0];
  return filtered.filter(t=>t<current-.0005).sort((a,b)=>b-a)[0];
}

export function cameraRiskMarkerOffset(time:number,window:CameraScrubWindow) {
  return 100*(inCameraScrubWindow(time,window)-window.start)/(window.end-window.start||1);
}
