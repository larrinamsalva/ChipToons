import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { uid } from "../model";
import type { Asset } from "../model";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

type Stroke = {
  color: string;
  width: number;
  eraser: boolean;
  points: { x: number; y: number }[];
};
export function DrawingPad({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (asset: Asset, name: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState("#ed754f");
  const [width, setWidth] = useState(10);
  const [eraser, setEraser] = useState(false);
  const [name, setName] = useState("My little character");
  function paint(list: Stroke[]) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of list) {
      ctx.globalCompositeOperation = stroke.eraser
        ? "destination-out"
        : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = ctx.lineJoin = "round";
      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          stroke.points[0].x,
          stroke.points[0].y,
          stroke.width / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        stroke.points.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }
  useEffect(() => {
    paint(strokes);
  }, [strokes]);
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) * 600) / bounds.width,
      y: ((e.clientY - bounds.top) * 400) / bounds.height,
    };
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    active.current = { color, width, eraser, points: [point(e)] };
    paint([...strokes, active.current]);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!active.current) return;
    active.current.points.push(point(e));
    paint([...strokes, active.current]);
  }
  function end() {
    if (!active.current) return;
    const stroke = active.current;
    active.current = null;
    setStrokes((s) => [...s, stroke]);
  }
  function save() {
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    if (!dataUrl || !strokes.length) return;
    onSave(
      {
        id: uid(),
        name: `${name.trim() || "My character"}.png`,
        type: "image",
        mime: "image/png",
        dataUrl,
      },
      name.trim().slice(0, 80) || "My character",
    );
  }
  return (
    <Modal title="A character only you could draw." onClose={onClose} wide>
      <p className="section-description">
        Make a little doodle. We’ll keep it as its own original image and put it
        in a story.
      </p>
      <div className="drawing-tools">
        <label className="color-label">
          Brush color
          <input
            aria-label="Brush color"
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value);
              setEraser(false);
            }}
          />
        </label>
        <label>
          Brush size
          <input
            aria-label="Brush size"
            type="range"
            min="2"
            max="36"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <button
          className={`button secondary small ${eraser ? "chosen" : ""}`}
          aria-pressed={eraser}
          onClick={() => setEraser((v) => !v)}
        >
          Eraser
        </button>
        <button
          className="icon-button"
          disabled={!strokes.length}
          aria-label="Undo stroke"
          onClick={() => setStrokes((s) => s.slice(0, -1))}
        >
          <Icon name="undo" />
        </button>
        <button
          className="button text small"
          disabled={!strokes.length}
          onClick={() => setStrokes([])}
        >
          Clear drawing
        </button>
      </div>
      <canvas
        className="drawing-canvas"
        ref={canvasRef}
        width={600}
        height={400}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Drawing canvas. Use a pointer or touch to draw. Keyboard users can use the original shape characters in the story editor."
      />
      <p className="field-hint">
        Draw with a mouse, pen, or touch. Prefer a keyboard? Start a story and
        customize its shape characters instead.
      </p>
      <label>
        Character name
        <input
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={save}
          disabled={!strokes.length || !name.trim()}
        >
          Give my character a story
          <Icon name="arrow" />
        </button>
      </div>
    </Modal>
  );
}
