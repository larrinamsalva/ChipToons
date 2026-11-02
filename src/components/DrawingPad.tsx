import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { uid, clone } from "../model";
import type { Asset } from "../model";
import { blankDrawing } from "../art-model";
import type { DrawObject, DrawingDocument } from "../art-model";
import { paintDrawing, hitDrawing } from "../drawing";
import { readPalette, savePalette } from "../library";
import { downloadBlob, safeFilename } from "../files";
import { Modal } from "./Modal";
import { Icon } from "./Icon";

type Tool = "pencil" | "brush" | "eraser" | "select" | DrawObject["kind"];
type Gesture = {
  start: { x: number; y: number };
  points: { x: number; y: number }[];
  original?: DrawObject;
  resize?: boolean;
  preview?: DrawObject;
};
export function DrawingPad({
  onClose,
  onSave,
  initial,
  name: initialName,
  saveLabel = "Give my character a story",
}: {
  onClose: () => void;
  onSave: (asset: Asset, name: string) => void;
  initial?: DrawingDocument;
  name?: string;
  saveLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [doc, setDoc] = useState<DrawingDocument>(() =>
    clone(initial ?? blankDrawing()),
  );
  const [past, setPast] = useState<DrawingDocument[]>([]);
  const [future, setFuture] = useState<DrawingDocument[]>([]);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#ed754f");
  const [fill, setFill] = useState("#f3cf8d");
  const [filled, setFilled] = useState(true);
  const [width, setWidth] = useState(10);
  const [name, setName] = useState(initialName ?? "My little character");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [palette, setPalette] = useState([
    "#ed754f",
    "#8e86d4",
    "#6d9f88",
    "#e4ba5d",
    "#2b3042",
    "#ffffff",
  ]);
  const object = doc.objects.find((o) => o.id === selected);
  useEffect(() => {
    readPalette()
      .then((p) => {
        if (p.length) setPalette(p);
      })
      .catch(() => {
        /* Drawing stays available if settings cannot load. */
      });
  }, []);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paintDrawing(ctx, doc, selected);
  }, [doc, selected]);
  function commit(next: DrawingDocument) {
    if (
      next.objects.length > 500 ||
      next.objects.reduce((n, o) => n + o.points.length, 0) > 50000
    ) {
      setError(
        "This drawing has reached its object or point limit. Remove an object before adding another.",
      );
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) paintDrawing(ctx, doc, selected);
      return;
    }
    setPast((p) => [...p.slice(-39), doc]);
    setFuture([]);
    setDoc(next);
  }
  function preview(objects: DrawObject[]) {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) paintDrawing(ctx, { ...doc, objects }, selected);
  }
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(600, ((e.clientX - b.left) * 600) / b.width)),
      y: Math.max(0, Math.min(400, ((e.clientY - b.top) * 400) / b.height)),
    };
  }
  function shape(points: { x: number; y: number }[]): DrawObject {
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    let w = Math.max(1, Math.max(...xs) - x),
      h = Math.max(1, Math.max(...ys) - y);
    if (tool === "circle") w = h = Math.min(w, h);
    const stroke = ["brush", "pencil", "eraser"].includes(tool);
    return {
      id: uid(),
      kind: stroke ? "stroke" : (tool as DrawObject["kind"]),
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      stroke: color,
      fill: filled ? fill : "transparent",
      lineWidth: tool === "pencil" ? Math.min(3, width) : width,
      eraser: tool === "eraser",
      points: stroke
        ? points.map((p) => ({ x: (p.x - x) / w, y: (p.y - y) / h }))
        : [],
    };
  }
  function start(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    if (tool === "select") {
      const o = [...doc.objects].reverse().find((o) => hitDrawing(o, p.x, p.y));
      setSelected(o?.id ?? "");
      gesture.current = o
        ? {
            start: p,
            points: [],
            original: clone(o),
            resize:
              Math.abs(p.x - o.x - o.width) < 15 &&
              Math.abs(p.y - o.y - o.height) < 15,
          }
        : null;
    } else {
      setSelected("");
      gesture.current = { start: p, points: [p] };
      const o = shape([p]);
      gesture.current.preview = o;
      preview([...doc.objects, o]);
    }
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    let o: DrawObject;
    if (g.original) {
      o = g.resize
        ? {
            ...g.original,
            width: Math.max(
              1,
              Math.min(1200, g.original.width + p.x - g.start.x),
            ),
            height: Math.max(
              1,
              Math.min(800, g.original.height + p.y - g.start.y),
            ),
          }
        : {
            ...g.original,
            x: Math.max(-600, Math.min(1200, g.original.x + p.x - g.start.x)),
            y: Math.max(-400, Math.min(800, g.original.y + p.y - g.start.y)),
          };
      preview(doc.objects.map((v) => (v.id === o.id ? o : v)));
    } else {
      if (g.points.length >= 10000) return;
      g.points.push(p);
      o = shape(
        ["brush", "pencil", "eraser"].includes(tool) ? g.points : [g.start, p],
      );
      preview([...doc.objects, o]);
    }
    g.preview = o;
  }
  function end() {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.preview) return;
    const o = g.preview;
    commit({
      ...doc,
      objects: g.original
        ? doc.objects.map((v) => (v.id === o.id ? o : v))
        : [...doc.objects, o],
    });
    setSelected(tool === "select" ? o.id : "");
  }
  function change(patch: Partial<DrawObject>) {
    if (object)
      commit({
        ...doc,
        objects: doc.objects.map((o) =>
          o.id === selected ? { ...o, ...patch } : o,
        ),
      });
  }
  function png() {
    const canvas = canvasRef.current,
      ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    paintDrawing(ctx, doc);
    const data = canvas.toDataURL("image/png");
    paintDrawing(ctx, doc, selected);
    return data;
  }
  function save() {
    const dataUrl = png();
    if (!dataUrl || !doc.objects.length) return;
    onSave(
      {
        id: uid(),
        name: `${name.trim() || "My character"}.png`,
        type: "image",
        mime: "image/png",
        dataUrl,
        drawing: clone(doc),
      },
      name.trim().slice(0, 80) || "My character",
    );
  }
  async function keepColor() {
    const next = [...new Set([...palette, color])].slice(-16);
    setPalette(next);
    try {
      await savePalette(next);
    } catch {
      setError(
        "This palette could not be saved. Your drawing is still here; save or export it before closing.",
      );
    }
  }
  return (
    <Modal
      title={
        initial
          ? "Make your artwork a little more you."
          : "A character only you could draw."
      }
      onClose={onClose}
      wide
    >
      <p className="section-description">
        Draw freely or build with shapes. Your canvas stays transparent, and
        saved drawings keep their editable objects.
      </p>
      <div className="art-tool-grid" aria-label="Drawing tools">
        {(
          [
            "select",
            "pencil",
            "brush",
            "eraser",
            "rectangle",
            "circle",
            "ellipse",
            "line",
            "star",
          ] as Tool[]
        ).map((t) => (
          <button
            key={t}
            aria-pressed={tool === t}
            className={tool === t ? "chosen" : ""}
            onClick={() => setTool(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="drawing-tools">
        <label className="color-label">
          Brush color
          <input
            aria-label="Brush color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <label>
          Brush size
          <input
            aria-label="Brush size"
            type="range"
            min="1"
            max="60"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <label className="color-label">
          Fill color
          <input
            aria-label="Fill color"
            type="color"
            value={fill}
            onChange={(e) => setFill(e.target.value)}
          />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={filled}
            onChange={(e) => setFilled(e.target.checked)}
          />
          Fill shapes
        </label>
        <button
          className="icon-button"
          aria-label="Undo stroke"
          disabled={!past.length}
          onClick={() => {
            setFuture((f) => [...f, doc]);
            setDoc(past.at(-1)!);
            setPast((p) => p.slice(0, -1));
            setSelected("");
          }}
        >
          <Icon name="undo" />
        </button>
        <button
          className="icon-button"
          aria-label="Redo drawing"
          disabled={!future.length}
          onClick={() => {
            setPast((p) => [...p, doc]);
            setDoc(future.at(-1)!);
            setFuture((f) => f.slice(0, -1));
          }}
        >
          <Icon name="redo" />
        </button>
        <button
          className="button text small"
          disabled={!doc.objects.length}
          onClick={() => {
            commit(blankDrawing());
            setSelected("");
          }}
        >
          Clear drawing
        </button>
        <label>
          Zoom
          <select
            aria-label="Drawing zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </label>
      </div>
      <div className="saved-palette">
        {palette.map((c) => (
          <button
            key={c}
            style={{ backgroundColor: c }}
            aria-label={`Use color ${c}`}
            onClick={() => setColor(c)}
          />
        ))}
        <button className="button text small" onClick={() => void keepColor()}>
          Save this color
        </button>
      </div>
      <div className="drawing-viewport">
        <canvas
          className="drawing-canvas"
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          ref={canvasRef}
          width={600}
          height={400}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={() => {
            gesture.current = null;
            preview(doc.objects);
          }}
          aria-label="Drawing canvas. Use pointer or touch to draw; use the object controls below with a keyboard."
        />
      </div>
      <p className="field-hint">
        Select an object to drag it. Drag its bottom-right handle to resize.
        Keyboard creators can insert a shape, select it below, and edit its
        position, size and rotation.
      </p>
      <div className="drawing-object-controls">
        <button
          className="button secondary small"
          onClick={() => {
            const kind = [
              "rectangle",
              "circle",
              "ellipse",
              "line",
              "star",
            ].includes(tool)
              ? (tool as DrawObject["kind"])
              : "rectangle";
            const o: DrawObject = {
              id: uid(),
              kind,
              x: 230,
              y: 130,
              width: 140,
              height: 120,
              rotation: 0,
              stroke: color,
              fill: filled ? fill : "transparent",
              lineWidth: width,
              eraser: false,
              points: [],
            };
            commit({ ...doc, objects: [...doc.objects, o] });
            setTool("select");
            setSelected(o.id);
          }}
        >
          Insert shape
        </button>
        <label>
          Select drawn object
          <select
            aria-label="Select drawn object"
            value={object?.id ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setTool("select");
            }}
          >
            <option value="">Choose an object</option>
            {doc.objects.map((o, i) => (
              <option key={o.id} value={o.id}>
                {i + 1}. {o.eraser ? "Eraser stroke" : o.kind}
              </option>
            ))}
          </select>
        </label>
      </div>
      {object && (
        <div className="object-inspector">
          <div className="form-grid compact">
            {(["x", "y", "width", "height", "rotation"] as const).map((k) => (
              <label key={k}>
                {
                  {
                    x: "Drawing X",
                    y: "Drawing Y",
                    width: "Drawing width",
                    height: "Drawing height",
                    rotation: "Drawing rotation",
                  }[k]
                }
                <input
                  type="number"
                  aria-label={`Drawing ${k}`}
                  value={Math.round(object[k])}
                  min={
                    k === "rotation"
                      ? -180
                      : k === "x"
                        ? -600
                        : k === "y"
                          ? -400
                          : 1
                  }
                  max={k === "rotation" ? 180 : k === "height" ? 800 : 1200}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const min =
                      k === "rotation"
                        ? -180
                        : k === "x"
                          ? -600
                          : k === "y"
                            ? -400
                            : 1;
                    const max =
                      k === "rotation" ? 180 : k === "height" ? 800 : 1200;
                    if (n >= min && n <= max) change({ [k]: n });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="drawing-tools">
            <label>
              Object outline
              <input
                type="color"
                value={object.stroke}
                onChange={(e) => change({ stroke: e.target.value })}
              />
            </label>
            <label>
              Object fill
              <input
                type="color"
                value={object.fill === "transparent" ? "#ffffff" : object.fill}
                onChange={(e) => change({ fill: e.target.value })}
              />
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={object.fill === "transparent"}
                onChange={(e) =>
                  change({ fill: e.target.checked ? "transparent" : fill })
                }
              />
              Transparent fill
            </label>
            <button
              className="button secondary small"
              onClick={() => {
                const o = {
                  ...clone(object),
                  id: uid(),
                  x: Math.min(1200, object.x + 12),
                  y: Math.min(800, object.y + 12),
                };
                commit({ ...doc, objects: [...doc.objects, o] });
                setSelected(o.id);
              }}
            >
              Duplicate object
            </button>
            <button
              className="button text small"
              onClick={() => {
                commit({
                  ...doc,
                  objects: doc.objects.filter((o) => o.id !== selected),
                });
                setSelected("");
              }}
            >
              Remove object
            </button>
          </div>
        </div>
      )}
      <label>
        Character name
        <input
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="button secondary"
          disabled={!doc.objects.length}
          onClick={() => {
            const data = png();
            if (data)
              void fetch(data)
                .then((r) => r.blob())
                .then((b) => downloadBlob(b, `${safeFilename(name)}.png`));
          }}
        >
          <Icon name="download" />
          Export artwork PNG
        </button>
        <button
          className="button primary"
          onClick={save}
          disabled={!doc.objects.length || !name.trim()}
        >
          {saveLabel}
          <Icon name="arrow" />
        </button>
      </div>
    </Modal>
  );
}
