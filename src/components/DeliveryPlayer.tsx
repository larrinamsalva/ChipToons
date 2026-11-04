import { useEffect, useRef, useState } from "react";
import { durationLabel } from "../model";
import { srtToVtt } from "../episode-delivery";
import type { DeliveryPlayerPart } from "../episode-delivery";

export function DeliveryPlayer({ parts, title, onClose }: {
  parts: DeliveryPlayerPart[]; title: string; onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [message, setMessage] = useState("");
  const [captions, setCaptions] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLTrackElement>(null);
  const autoPlay = useRef(false);
  const part = parts[index];
  useEffect(() => {
    const element = video.current;
    if (!element || !part) return;
    const movieUrl = URL.createObjectURL(part.video.slice(0, part.video.size, "video/webm"));
    element.src = movieUrl;
    element.load();
    let live = true, subtitleUrl = "";
    if (part.subtitle) void part.subtitle.text().then(text => {
      if (live && track.current) {
        subtitleUrl = URL.createObjectURL(new Blob([srtToVtt(text)], { type: "text/vtt" }));
        track.current.src = subtitleUrl;
      }
    }).catch(() => { if (live) setMessage("This part’s subtitle file could not be read."); });
    return () => {
      live = false;
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(movieUrl);
      if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
    };
  }, [part]);
  if (!part) return null;

  function go(next: number, continuePlaying = false) {
    if (next < 0 || next >= parts.length) return;
    autoPlay.current = continuePlaying;
    setIndex(next);
    setPosition(0);
    setMessage("");
  }
  function subtitleMode(enabled: boolean) {
    if (track.current) track.current.track.mode = enabled ? "showing" : "hidden";
  }
  return <section className="delivery-card" aria-label="Episode watch-through">
    <h3>{title}</h3>
    <p role="status">{part.label} of {parts.length}</p>
    <p>Story position {durationLabel(Math.min(part.end, part.start + position))} / {durationLabel(parts.at(-1)!.end)}</p>
    <p>Each file plays separately. There may be a brief pause between parts.</p>
    <video key={index} ref={video} controls playsInline preload="metadata" aria-label="Episode part video"
      onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
      onCanPlay={event => {
        if (!autoPlay.current) return;
        autoPlay.current = false;
        void event.currentTarget.play().catch(() => setMessage("Press Play to continue with this part."));
      }}
      onError={() => setMessage("This part could not play. Try a supported browser or replace the affected file.")}
      onEnded={() => {
        if (index + 1 < parts.length) go(index + 1, true);
        else setMessage("You reached the end of the episode.");
      }}>
      {part.subtitle && <track ref={track} kind="subtitles" srcLang="en" label="Episode subtitles" default={captions}
        onLoad={() => subtitleMode(captions)} />}
    </video>
    {message && <p role="status">{message}</p>}
    <div className="delivery-actions">
      <button className="button secondary" disabled={index === 0} onClick={() => go(index - 1)}>Previous part</button>
      <button className="button secondary" onClick={() => {
        if (video.current) {
          video.current.currentTime = 0;
          void video.current.play().catch(() => setMessage("Press Play to replay this part."));
        }
      }}>Replay part</button>
      <button className="button secondary" disabled={index + 1 === parts.length} onClick={() => go(index + 1)}>Next part</button>
      {typeof HTMLVideoElement.prototype.requestFullscreen === "function" && document.fullscreenEnabled &&
        <button className="button secondary" onClick={() => {
          void video.current?.requestFullscreen().catch(() => setMessage("Fullscreen is unavailable on this device."));
        }}>Fullscreen</button>}
      {part.subtitle && <label className="inline-check">
        <input type="checkbox" checked={captions} onChange={event => {
          setCaptions(event.target.checked);
          subtitleMode(event.target.checked);
        }} /> Show separate subtitles
      </label>}
    </div>
    {part.baked && <p className="field-hint">This export already has captions drawn into the picture.</p>}
    <label>Part order
      <select value={index} onChange={event => go(Number(event.target.value))}>
        {parts.map((item, order) => <option key={item.label} value={order}>{item.label}</option>)}
      </select>
    </label>
    <button className="button secondary" onClick={onClose}>Back to delivery list</button>
  </section>;
}
