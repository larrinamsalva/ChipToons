import { SUNNY_NAME, sunnyLibraryItem } from "../puppet-project";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { paintDrawing } from "../drawing";
import { readImage } from "../files";
import { listLibrary, saveLibraryItem, validateLibraryItem } from "../library";
import type { LibraryItem } from "../library";
import { makeScene, uid } from "../model";
import type { Asset, Character, Emotion } from "../model";
import { PlaybackClock } from "../playback";
import { actionsForPuppet, presetAnimation } from "../presets";
import type { Action } from "../presets";
import {
  defaultPivot,
  EXPRESSIONS,
  MAX_PUPPET_PARTS,
  MAX_PUPPET_POSES,
  neutralJoint,
  newPart,
  PART_ROLES,
  puppetAssetIds,
  puppetTransforms,
  PUPPET_MOUTHS,
  sunnyRig,
  validPuppet,
} from "../puppet-model";
import type {
  JointSnapshot,
  PartRole,
  PuppetPart,
  PuppetPose,
} from "../puppet-model";
import { clamp, elementAt } from "../timeline";
import { Modal } from "./Modal";
import { PuppetArt } from "./PuppetArt";

const label = (role: PartRole) => role.replace(/([A-Z])/g, " $1");

const parentFor = (parts: PuppetPart[], role: PartRole) => {
  const key = role.replace(/Forearm|Hand/, "Arm").replace(/Shin|Foot/, "Leg");
  return (
    parts.find((p) => p.role === key && key !== role) ??
    parts.find(
      (p) =>
        p.role === (/hair|accessory|eyes|mouth/.test(role) ? "head" : "torso"),
    )
  );
};

function numberValue(value: number, low: number, high: number) {
  return (
    Math.round(clamp(Number.isFinite(value) ? value : 0, low, high) * 10) / 10
  );
}

function drawingPart(asset: Asset, selected: Set<number>, name: string): Asset {
  if (!asset.drawing || !selected.size)
    throw new Error("Choose drawing objects for this part.");
  const drawing = {
    ...asset.drawing,
    objects: asset.drawing.objects.filter((_, i) => selected.has(i)),
  };
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This device could not prepare the drawing.");
  paintDrawing(ctx, drawing);
  const pixels = ctx.getImageData(0, 0, 600, 400).data;
  let left = 600,
    right = -1,
    top = 400,
    bottom = -1;
  for (let y = 0; y < 400; y++)
    for (let x = 0; x < 600; x++) {
      if (pixels[(y * 600 + x) * 4 + 3]) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  if (right < left) throw new Error("Select some visible drawing objects.");
  const part = document.createElement("canvas");
  part.width = right - left + 1;
  part.height = bottom - top + 1;
  part
    .getContext("2d")
    ?.drawImage(
      canvas,
      left,
      top,
      part.width,
      part.height,
      0,
      0,
      part.width,
      part.height,
    );
  return {
    ...asset,
    id: uid(),
    name,
    type: "image",
    mime: "image/png",
    drawing,
    dataUrl: part.toDataURL("image/png"),
    sourceWidth: part.width,
    sourceHeight: part.height,
  };
}

function PuppetPreview({
  character,
  assets,
  joints,
  emotion,
  mouth,
  selected,
  onMove,
  action,
  clock,
}: {
  character: Character;
  assets: Asset[];
  joints: JointSnapshot;
  emotion: Emotion;
  mouth: PuppetPose["mouth"];
  selected?: PuppetPart;
  onMove: (x: number, y: number) => void;
  action: Action | "";
  clock: PlaybackClock;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const offset = useRef<{ x: number; y: number } | null>(null);
  const frame = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const rig = character.puppet!;
  const [element] = useState(() => ({
    ...makeScene([character]).elements[0],
    motion: "still" as const,
  }));
  const animation = useMemo(
    () => (action ? presetAnimation(element, 3, action, 0, 3, rig) : undefined),
    [action, element, rig],
  );
  const animated = animation
    ? elementAt({ ...element, emotion, animation }, frame.seconds, 3)
    : undefined;
  const timeMouth =
    mouth === "talking"
      ? Math.floor(frame.seconds * 5) % 3 === 0
        ? "closed"
        : "open"
      : mouth;
  const world = puppetTransforms(rig, joints);
  const marker = selected && world[rig.parts.indexOf(selected)];
  const parent = selected?.parentId
    ? world[rig.parts.findIndex((p) => p.id === selected.parentId)]
    : neutralJoint;
  const coords = (x: number, y: number) => {
    const transform = svg.current?.getScreenCTM();
    if (!transform || !parent) return;
    const point = new DOMPoint(x, y).matrixTransform(transform.inverse());
    const angle = (-parent.angle * Math.PI) / 180;
    const dx = point.x - parent.x,
      dy = point.y - parent.y;
    return {
      x: dx * Math.cos(angle) - dy * Math.sin(angle),
      y: dx * Math.sin(angle) + dy * Math.cos(angle),
    };
  };
  return (
    <svg
      ref={svg}
      viewBox="-205 -290 410 330"
      aria-label="Puppet preview"
      className="puppet-preview"
    >
      <rect
        x="-205"
        y="-290"
        width="410"
        height="330"
        rx="16"
        fill="var(--field)"
      />
      <path d="M-150 0H150" stroke="var(--line)" strokeDasharray="6 6" />
      <g
        transform={
          animated
            ? `translate(${action === "walk" ? (animated.x - element.x) * 0.25 : 0} ${animated.y - element.y}) rotate(${animated.rotation})`
            : undefined
        }
      >
        <PuppetArt
          character={character}
          assets={assets}
          joints={animated?.joints ?? joints}
          emotion={animated?.emotion ?? emotion}
          mouth={animated?.mouth ?? timeMouth}
          heartOpacity={animated?.heartOpacity}
          heartScale={animated?.heartScale}
        />
      </g>
      {selected && marker && !action && (
        <g
          transform={`translate(${marker.x} ${marker.y})`}
          role="button"
          tabIndex={0}
          aria-label="Move joint"
          className="puppet-handle"
          onPointerDown={(e) => {
            const p = coords(e.clientX, e.clientY);
            if (!p) return;
            offset.current = { x: p.x - selected.x, y: p.y - selected.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const p = coords(e.clientX, e.clientY),
              start = offset.current;
            if (p && start) onMove(p.x - start.x, p.y - start.y);
          }}
          onPointerUp={() => {
            offset.current = null;
          }}
          onPointerCancel={() => {
            offset.current = null;
          }}
          onKeyDown={(e) => {
            const movement = {
              ArrowLeft: [-4, 0],
              ArrowRight: [4, 0],
              ArrowUp: [0, -4],
              ArrowDown: [0, 4],
            }[e.key];
            if (!movement) return;
            e.preventDefault();
            onMove(selected.x + movement[0], selected.y + movement[1]);
          }}
        >
          <circle r="22" fill="transparent" />
          <circle r="9" fill="#fff" stroke="#234d85" strokeWidth="3" />
          <path d="M-5 0h10M0-5v10" stroke="#234d85" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

export function PuppetMaker({
  initial,
  onClose,
  onUse,
  onDemo,
}: {
  initial?: LibraryItem;
  onClose: () => void;
  onUse: (item: LibraryItem) => void | Promise<void>;
  onDemo?: () => void;
}) {
  const [base] = useState(() => initial ?? sunnyLibraryItem());
  const [character, setCharacter] = useState(
    () => base.character ?? sunnyLibraryItem().character!,
  );
  const [name, setName] = useState(initial?.name ?? SUNNY_NAME);
  const [rig, setRig] = useState(
    () => initial?.character?.puppet ?? sunnyRig(),
  );
  const [assets, setAssets] = useState(base.assets);
  const [mode, setMode] = useState<"shapes" | "drawing" | "upload">("shapes");
  const [step, setStep] = useState(initial ? 1 : 0);
  const stepHeading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (step > 0) stepHeading.current?.focus();
  }, [step]);
  const [partId, setPartId] = useState("head");
  const [role, setRole] = useState<PartRole>("leftForearm");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [drawingId, setDrawingId] = useState("");
  const [objects, setObjects] = useState<Set<number>>(new Set());
  const [joints, setJoints] = useState<JointSnapshot>({});
  const [emotion, setEmotion] = useState<Emotion>("happy");
  const [mouth, setMouth] = useState<PuppetPose["mouth"]>("auto");
  const [poseId, setPoseId] = useState("");
  const [poseName, setPoseName] = useState("");
  const [action, setAction] = useState<Action | "">("");
  const [clock] = useState(() => new PlaybackClock());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedFingerprint = useRef("");
  const saving = useRef(false);
  const part = rig.parts.find((p) => p.id === partId) ?? rig.parts[0];
  const drawing = library
    .flatMap((i) => i.assets)
    .find((a) => a.id === drawingId);
  const complete = { ...character, name, puppet: rig };
  useEffect(() => {
    let current = true;
    void listLibrary()
      .then((items) => {
        if (current) setLibrary(items.filter((i) => i.kind === "drawing"));
      })
      .catch(() => {
        if (current)
          setError(
            "The drawing library could not be opened. Shape and upload tools are still available.",
          );
      });
    clock.configure(0, 3, false);
    return () => {
      current = false;
      clock.pause();
    };
  }, [clock]);
  function stop() {
    clock.pause();
    setAction("");
  }
  function editPart(changes: Partial<PuppetPart>, id = part?.id) {
    stop();
    setRig((r) => ({
      ...r,
      parts: r.parts.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    }));
    setSaved(false);
  }
  function addPart(role: PartRole) {
    if (rig.parts.length >= MAX_PUPPET_PARTS) {
      setError("A puppet can have up to 20 parts.");
      return;
    }
    if (role === "artwork") {
      setError("Choose an existing part for the uploaded artwork.");
      return;
    }
    const next = newPart(
      role,
      uid(),
      role === "torso" ? undefined : parentFor(rig.parts, role),
    );
    setRig({ ...rig, parts: [...rig.parts, next] });
    setPartId(next.id);
    stop();
    setSaved(false);
    setError("");
  }
  function parent(parentId: string) {
    const next = {
      ...rig,
      parts: rig.parts.map((p) =>
        p.id === part.id ? { ...p, parentId: parentId || undefined } : p,
      ),
    };
    const ready = new Set(assets.map((a) => a.id));
    if (!validPuppet(next, ready)) {
      setError(
        "That connection would create a joint loop. Choose another parent.",
      );
      return;
    }
    editPart({ parentId: parentId || undefined });
    setError("");
  }
  function attach(asset: Asset, id: string) {
    setAssets((prev) => [...prev, asset]);
    editPart({ assetId: asset.id }, id);
    setMessage("Original artwork assigned to this part.");
    setError("");
  }
  async function upload(file?: File) {
    if (!file || !part || busy) return;
    if (!["image/png", "image/webp"].includes(file.type)) {
      setError("Choose a PNG or WebP part image.");
      return;
    }
    const target = part.id;
    setBusy(true);
    try {
      attach(await readImage(file), target);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This part image could not be read.",
      );
    } finally {
      setBusy(false);
    }
  }
  function loadPose(pose: PuppetPose) {
    stop();
    setPoseId(pose.id);
    setPoseName(pose.name);
    setJoints(structuredClone(pose.joints));
    setEmotion(pose.emotion);
    setMouth(pose.mouth);
  }
  function savePose(duplicate = false) {
    const previous = rig.poses.find((p) => p.id === poseId);
    const title = (
      duplicate && previous ? `${previous.name.slice(0, 52)} copy` : poseName
    ).trim();
    if (!title) {
      setError("Give this pose a name.");
      return;
    }
    if ((!previous || duplicate) && rig.poses.length >= MAX_PUPPET_POSES) {
      setError("A puppet can have up to 24 poses.");
      return;
    }
    const pose = {
      id: previous && !duplicate ? previous.id : uid(),
      name: title,
      joints,
      emotion,
      mouth,
    };
    setRig({
      ...rig,
      poses:
        previous && !duplicate
          ? rig.poses.map((p) => (p.id === pose.id ? pose : p))
          : [...rig.poses, pose],
    });
    loadPose(pose);
    setError("");
    setSaved(false);
    setMessage(`Saved pose ${title} in this puppet draft.`);
  }
  function tryAction(next: Action) {
    setAction(next);
    clock.pause();
    clock.seek(0);
    clock.play();
  }
  async function save(add = false) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const needed = new Set(puppetAssetIds(rig));
      const item = validateLibraryItem({
        ...base,
        name: name.trim(),
        character: { ...complete, name: name.trim() },
        assets: assets.filter((a) => needed.has(a.id)),
        group: "Puppets",
      });
      const fingerprint = JSON.stringify(item);
      if (fingerprint !== savedFingerprint.current) {
        await saveLibraryItem(
          { ...item, updatedAt: new Date().toISOString() },
          !initial && !savedFingerprint.current,
        );
        savedFingerprint.current = fingerprint;
      }
      setSaved(true);
      setMessage(`Saved ${item.name} in your character library.`);
      if (add) await onUse(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this puppet.");
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  return (
    <Modal
      title="Create a Puppet Character"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <p
        className="assistant-step"
        role="status"
        tabIndex={-1}
        ref={stepHeading}
      >
        {
          [
            "Choose a starting point",
            "Assemble parts and move joints",
            "Pose Studio",
            "Preview and save",
          ][step]
        }
      </p>
      {step === 0 ? (
        <>
          <p>
            Use original shapes, parts from an editable drawing, or separate
            PNG/WebP artwork. You choose how parts connect.
          </p>
          <div className="assistant-fields">
            {(
              [
                ["shapes", "Build a Character"],
                ["drawing", "Use My Drawing"],
                ["upload", "Use My Uploaded Artwork"],
              ] as const
            ).map(([value, title]) => (
              <button
                key={value}
                className="button secondary"
                onClick={() => {
                  setMode(value);
                  setStep(1);
                  if (value === "upload")
                    setRig((prev) => ({ ...prev, face: false }));
                }}
              >
                {title}
              </button>
            ))}
          </div>
          {onDemo && (
            <button className="button primary" onClick={onDemo}>
              Open Sunny’s animated example
            </button>
          )}
          <p className="field-hint">
            A single image can move as one part. Prepare separate images
            yourself for moving limbs.
          </p>
        </>
      ) : (
        <>
          <div className="puppet-workspace">
            <section>
              <PuppetPreview
                character={complete}
                assets={assets}
                joints={step === 1 ? {} : joints}
                emotion={emotion}
                mouth={mouth}
                selected={step === 1 ? part : undefined}
                action={action}
                clock={clock}
                onMove={(x, y) =>
                  editPart({
                    x: numberValue(x, -320, 320),
                    y: numberValue(y, -320, 320),
                  })
                }
              />
              <div className="assistant-actions">
                {actionsForPuppet(rig).some(([id]) => id === "wave") && (
                  <button
                    className="button secondary"
                    onClick={() => tryAction("wave")}
                  >
                    Make It Wave
                  </button>
                )}
                <button className="button secondary" onClick={stop}>
                  Show still puppet
                </button>
              </div>
            </section>
            <section
              className="assistant-fields"
              aria-label={step === 2 ? "Pose Studio" : "Puppet controls"}
            >
              {step === 1 && part && (
                <>
                  <label>
                    Character name
                    <input
                      maxLength={80}
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setSaved(false);
                      }}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={rig.description}
                      onChange={(e) => {
                        setRig({ ...rig, description: e.target.value });
                        setSaved(false);
                      }}
                    />
                  </label>
                  <label>
                    Shirt color
                    <input
                      type="color"
                      value={character.shirt}
                      onChange={(e) => {
                        setCharacter({ ...character, shirt: e.target.value });
                        setSaved(false);
                      }}
                    />
                  </label>
                  <label className="assistant-check">
                    <input
                      type="checkbox"
                      checked={rig.face}
                      onChange={(e) => {
                        setRig({ ...rig, face: e.target.checked });
                        setSaved(false);
                      }}
                    />{" "}
                    Use original expression overlays on the head
                  </label>
                  <label>
                    Body-part hierarchy
                    <select
                      value={part.id}
                      onChange={(e) => {
                        setPartId(e.target.value);
                        stop();
                      }}
                    >
                      {rig.parts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {label(p.role)}
                          {p.parentId
                            ? ` · attached to ${label(rig.parts.find((parent) => parent.id === p.parentId)!.role)}`
                            : " · root"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="assistant-actions">
                    <button
                      className="button secondary"
                      onClick={() => addPart("head")}
                    >
                      Add Head
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        addPart(
                          rig.parts.some((p) => p.role === "leftArm")
                            ? "rightArm"
                            : "leftArm",
                        )
                      }
                    >
                      Add Arm
                    </button>
                    <button
                      className="button secondary"
                      disabled={rig.parts.some((p) => p.assetId)}
                      onClick={() => {
                        setRig({
                          ...sunnyRig(),
                          face: rig.face,
                          description: rig.description,
                          poses: [],
                          parts: sunnyRig()
                            .parts.filter((p) => !/Leg/.test(p.role))
                            .concat(
                              newPart(
                                "lowerBody",
                                "lowerBody",
                                sunnyRig().parts.find(
                                  (p) => p.role === "torso",
                                ),
                              ),
                            ),
                        });
                        setJoints({});
                        setPoseId("");
                        setPoseName("");
                        setPartId("head");
                        setSaved(false);
                        stop();
                      }}
                    >
                      Use simple five-part layout
                    </button>
                  </div>
                  <label>
                    Another body part
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as PartRole)}
                    >
                      {PART_ROLES.filter((r) => r !== "artwork").map((r) => (
                        <option key={r} value={r}>
                          {label(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    onClick={() => addPart(role)}
                  >
                    Add selected part
                  </button>
                  <button
                    className="button secondary"
                    disabled={
                      rig.parts.length <= 1 ||
                      rig.parts.some((p) => p.parentId === part.id)
                    }
                    onClick={() => {
                      const withoutPart = (snapshot: JointSnapshot) =>
                        Object.fromEntries(
                          Object.entries(snapshot).filter(
                            ([id]) => id !== part.id,
                          ),
                        );
                      setRig({
                        ...rig,
                        parts: rig.parts.filter((p) => p.id !== part.id),
                        poses: rig.poses.map((p) => ({
                          ...p,
                          joints: withoutPart(p.joints),
                        })),
                      });
                      setJoints(withoutPart(joints));
                      setSaved(false);
                      stop();
                    }}
                  >
                    Remove selected part
                  </button>
                  <label>
                    Attach selected part to
                    <select
                      value={part.parentId ?? ""}
                      onChange={(e) => parent(e.target.value)}
                    >
                      <option value="">Stage root</option>
                      {rig.parts
                        .filter((p) => p.id !== part.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {label(p.role)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Move Joint</legend>
                    <p>
                      Drag the marker or use its arrow keys. Pivot offsets move
                      the artwork around the joint.
                    </p>
                    <div className="assistant-numbers">
                      {(
                        [
                          "x",
                          "y",
                          "pivotX",
                          "pivotY",
                          "width",
                          "height",
                        ] as const
                      ).map((axis) => {
                        const size = axis === "width" || axis === "height",
                          pivot = axis.startsWith("pivot");
                        const bound = pivot ? 200 : 320;
                        return (
                          <label key={axis}>
                            {axis === "x"
                              ? "Joint X"
                              : axis === "y"
                                ? "Joint Y"
                                : axis === "pivotX"
                                  ? "Pivot X"
                                  : axis === "pivotY"
                                    ? "Pivot Y"
                                    : `Artwork ${axis}`}
                            <input
                              type="number"
                              min={size ? 8 : -bound}
                              max={bound}
                              value={part[axis]}
                              onChange={(e) =>
                                editPart({
                                  [axis]: numberValue(
                                    e.target.valueAsNumber,
                                    size ? 8 : -bound,
                                    bound,
                                  ),
                                })
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => editPart(defaultPivot(part.role))}
                    >
                      Reset Pivot
                    </button>
                  </fieldset>
                  <label>
                    Artwork source
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as typeof mode)}
                    >
                      <option value="shapes">Original shape</option>
                      <option value="drawing">Editable drawing</option>
                      <option value="upload">Uploaded part artwork</option>
                    </select>
                  </label>
                  {mode === "upload" && (
                    <>
                      <label>
                        Upload artwork for selected part
                        <input
                          type="file"
                          accept="image/png,image/webp"
                          disabled={busy}
                          onChange={(e) => void upload(e.target.files?.[0])}
                        />
                      </label>
                      <button
                        className="button secondary"
                        onClick={() => {
                          if (!part.assetId) {
                            setError(
                              "Upload artwork for the selected part first.",
                            );
                            return;
                          }
                          const single = {
                            ...part,
                            role: "artwork" as const,
                            parentId: undefined,
                            x: 0,
                            y: -115,
                            pivotX: 0,
                            pivotY: 0,
                            width: 150,
                            height: 170,
                          };
                          setRig({
                            ...rig,
                            parts: [single],
                            poses: [],
                            face: false,
                          });
                          setPartId(single.id);
                          setJoints({});
                          setPoseId("");
                          setPoseName("");
                          setSaved(false);
                          setError("");
                          stop();
                        }}
                      >
                        Use as one whole-image part
                      </button>
                    </>
                  )}
                  {mode === "drawing" && (
                    <>
                      <label>
                        Saved drawing
                        <select
                          value={drawingId}
                          onChange={(e) => {
                            setDrawingId(e.target.value);
                            setObjects(new Set());
                          }}
                        >
                          <option value="">Choose a drawing</option>
                          {library.flatMap((i) =>
                            i.assets
                              .filter((a) => a.drawing)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {i.name}
                                </option>
                              )),
                          )}
                        </select>
                      </label>
                      {!library.length && (
                        <p>
                          Save an editable drawing in the art library first.
                        </p>
                      )}
                      {drawing?.drawing && (
                        <fieldset>
                          <legend>Drawing objects for this part</legend>
                          {drawing.drawing.objects.map((obj, i) => (
                            <label className="assistant-check" key={i}>
                              <input
                                type="checkbox"
                                checked={objects.has(i)}
                                onChange={(e) => {
                                  const set = new Set(objects);
                                  if (e.target.checked) set.add(i);
                                  else set.delete(i);
                                  setObjects(set);
                                }}
                              />{" "}
                              {i + 1}. {obj.kind}{" "}
                              {obj.eraser ? "eraser" : obj.fill}
                            </label>
                          ))}
                          <button
                            className="button secondary"
                            onClick={() => {
                              try {
                                attach(
                                  drawingPart(
                                    drawing,
                                    objects,
                                    `${label(part.role)} from drawing`,
                                  ),
                                  part.id,
                                );
                              } catch (e) {
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : "Drawing could not be assigned.",
                                );
                              }
                            }}
                          >
                            Assign selected objects
                          </button>
                        </fieldset>
                      )}
                    </>
                  )}
                  {part.assetId && (
                    <p>
                      Part artwork:{" "}
                      {assets.find((a) => a.id === part.assetId)?.name}
                    </p>
                  )}
                </>
              )}
              {step === 2 && part && (
                <>
                  <label>
                    Try a Pose
                    <select
                      value={poseId}
                      onChange={(e) => {
                        const pose = rig.poses.find(
                          (p) => p.id === e.target.value,
                        );
                        if (pose) loadPose(pose);
                        else {
                          setPoseId("");
                          setPoseName("");
                          setJoints({});
                          stop();
                        }
                      }}
                    >
                      <option value="">New pose</option>
                      {rig.poses.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Make a pose from an action
                    <select
                      value=""
                      onChange={(e) => {
                        const value = e.target.value as Action;
                        const choice = actionsForPuppet(rig).find(
                          ([id]) => id === value,
                        );
                        if (!choice) return;
                        const actor = {
                          ...makeScene([complete]).elements[0],
                          motion: "still" as const,
                        };
                        const animation = presetAnimation(
                          actor,
                          3,
                          value,
                          0,
                          3,
                          rig,
                        );
                        const frame = elementAt(
                          { ...actor, animation },
                          value === "sit" || value === "stand" ? 3 : 1.25,
                          3,
                        );
                        stop();
                        setPoseId("");
                        setPoseName(choice[1].slice(0, 60));
                        setJoints(frame.joints ?? {});
                        setEmotion(frame.emotion);
                        setMouth(frame.mouth);
                      }}
                    >
                      <option value="">Choose a starting movement</option>
                      {actionsForPuppet(rig).map(([id, title]) => (
                        <option key={id} value={id}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Pose name
                    <input
                      maxLength={60}
                      value={poseName}
                      onChange={(e) => setPoseName(e.target.value)}
                    />
                  </label>
                  <label>
                    Pose part
                    <select
                      value={part.id}
                      onChange={(e) => {
                        setPartId(e.target.value);
                        stop();
                      }}
                    >
                      {rig.parts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {label(p.role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="assistant-numbers">
                    {(["angle", "x", "y"] as const).map((axis) => (
                      <label key={axis}>
                        {axis === "angle"
                          ? "Pose rotation (degrees)"
                          : `Pose offset ${axis.toUpperCase()}`}
                        <input
                          type="number"
                          min={axis === "angle" ? -180 : -160}
                          max={axis === "angle" ? 180 : 160}
                          value={(joints[part.id] ?? neutralJoint)[axis]}
                          onChange={(e) => {
                            stop();
                            const bound = axis === "angle" ? 180 : 160;
                            setJoints({
                              ...joints,
                              [part.id]: {
                                ...(joints[part.id] ?? neutralJoint),
                                [axis]: numberValue(
                                  e.target.valueAsNumber,
                                  -bound,
                                  bound,
                                ),
                              },
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <label>
                    Expression
                    <select
                      aria-label="Expression"
                      value={emotion}
                      onChange={(e) => {
                        stop();
                        setEmotion(e.target.value as Emotion);
                      }}
                    >
                      {EXPRESSIONS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mouth state
                    <select
                      value={mouth}
                      onChange={(e) => {
                        stop();
                        setMouth(e.target.value as PuppetPose["mouth"]);
                      }}
                    >
                      {PUPPET_MOUTHS.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <p className="field-hint">
                    Original overlays show these expressions. Custom eyes and
                    mouths keep the art you assigned.
                  </p>
                  <div className="assistant-actions">
                    <button
                      className="button primary"
                      onClick={() => savePose()}
                    >
                      Save Pose
                    </button>
                    <button
                      className="button secondary"
                      disabled={!poseId}
                      onClick={() => savePose(true)}
                    >
                      Duplicate Pose
                    </button>
                    <button
                      className="button secondary"
                      disabled={!poseId || !poseName.trim()}
                      onClick={() => {
                        setRig({
                          ...rig,
                          poses: rig.poses.map((p) =>
                            p.id === poseId
                              ? { ...p, name: poseName.trim() }
                              : p,
                          ),
                        });
                        setSaved(false);
                        setMessage("Pose renamed in this puppet draft.");
                      }}
                    >
                      Rename Pose
                    </button>
                    <button
                      className="button secondary"
                      disabled={!poseId}
                      onClick={() => {
                        setRig({
                          ...rig,
                          poses: rig.poses.filter((p) => p.id !== poseId),
                        });
                        setPoseId("");
                        setPoseName("");
                        setSaved(false);
                        setMessage(
                          "Pose removed from this puppet draft. Existing keyframes keep their snapshots.",
                        );
                      }}
                    >
                      Delete Pose
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        stop();
                        clock.seek(0);
                        clock.play();
                      }}
                    >
                      Preview Pose
                    </button>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <label>
                    Preview My Puppet
                    <select
                      value={action}
                      onChange={(e) => {
                        if (e.target.value) tryAction(e.target.value as Action);
                        else stop();
                      }}
                    >
                      <option value="">Still pose</option>
                      {actionsForPuppet(rig).map(([id, title]) => (
                        <option key={id} value={id}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {rig.parts.length} connected artwork parts ·{" "}
                    {rig.poses.length} saved poses
                  </p>
                  <p>
                    Use the animation timeline after adding this character to a
                    cartoon. Every saved episode keeps its own rig and artwork.
                  </p>
                  <div className="assistant-actions">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => void save()}
                    >
                      {busy ? "Saving…" : "Save Character"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => void save(true)}
                    >
                      Add to Cartoon
                    </button>
                  </div>
                  {saved && (
                    <p>Ready to reuse from Characters in the art library.</p>
                  )}
                </>
              )}
            </section>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                stop();
                setStep(step - 1);
              }}
            >
              Back
            </button>
            {step < 3 && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  stop();
                  setStep(step + 1);
                }}
              >
                {step === 2 ? "Preview" : "Next"}
              </button>
            )}
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <button className="button secondary" disabled={busy} onClick={onClose}>
        Cancel
      </button>
    </Modal>
  );
}
