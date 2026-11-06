import { STORY_CARD_DEMO } from "../story-card-model";
import { PARTICIPATION_EXAMPLES } from "../participation-model";
import { EXAMPLE_NAMES } from "../transform-model";
import type { TransformExample } from "../transform-model";
import { useMemo, useState } from "react";
import { durationLabel, totalDuration } from "../model";
import type { Project } from "../model";
import { STARTERS, starterProject } from "../planner";
import { Icon } from "./Icon";
import { Stage } from "./Stage";

export function Dashboard({
  projects,
  onIdea,
  onAssistant,
  onPuppet,
  onDemo,
  onTalkingDemo,
  onGardenDemo,
  onSoundGardenDemo,
  onTransformDemo,
  onFocusDemo,
  onParticipationDemo,
  onCameraDemo,
  onStoryCardDemo,
  onFullBodyDemo,
  onScoutVoicedDemo,
  onScoutActingDemo,
  onScoutWobblyChairDemo,
  onScoutHelperJoDemo,
  onUpload,
  onDraw,
  onOpen,
  onRecovery,
  onSeries,
  onDuplicate,
  onDelete,
  onImport,
  onHelp,
  onLibrary,
  onGuidedArt,
  onPicture,
}: {
  projects: Project[];
  onIdea: (starterId?: string) => void;
  onAssistant: () => void;
  onPuppet: () => void;
  onDemo: () => void;
  onTalkingDemo: () => void;
  onGardenDemo: () => void;
  onSoundGardenDemo: () => void;
  onTransformDemo: (example: TransformExample) => void;
  onFocusDemo: (example: TransformExample) => void;
  onCameraDemo: () => void;
  onStoryCardDemo: () => void;
  onFullBodyDemo: () => void;
  onScoutVoicedDemo: () => void;
  onScoutActingDemo: () => void;
  onScoutWobblyChairDemo: () => void;
  onScoutHelperJoDemo: () => void;
  onParticipationDemo: (example: TransformExample) => void;
  onUpload: () => void;
  onDraw: () => void;
  onOpen: (p: Project) => void;
  onRecovery: () => void;
  onSeries: () => void;
  onDuplicate: (p: Project) => void;
  onDelete: (p: Project) => void;
  onImport: () => void;
  onHelp: () => void;
  onLibrary: () => void;
  onPicture: () => void;
  onGuidedArt: (source: "sketch" | "image") => void;
}) {
  const demo = useMemo(() => starterProject(), []);
  const [allStarters, setAllStarters] = useState(false);
  const [filter, setFilter] = useState("all");
  const visibleProjects = projects.filter(
    (p) => filter === "all" || p.status === filter,
  );
  return (
    <main className="dashboard page-width" id="main-content">
      <div className="welcome-line">
        <span>
          <span className="sun-dot" />A good day to make something wonderful.
        </span>
        <span className="privacy-pill">
          <Icon name="lock" size={14} />
          Your stories stay with you
        </span>
      </div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-star">✦</span> A LITTLE IMAGINATION GOES A
            LONG WAY
          </span>
          <h1 id="hero-title">
            Big ideas.
            <br />
            Little{" "}
            <span className="headline-toons">
              cartoons.
              <svg viewBox="0 0 280 15" aria-hidden="true">
                <path
                  d="M3 10Q120-4 275 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p>
            Turn your thoughts, sketches, and little sparks
            <br className="desktop-break" /> into stories worth sharing. Let’s
            make one.
          </p>
          <button className="button primary hero-cta" onClick={onAssistant}>
            <Icon name="sparkles" size={21} />
            Help Me Make My Cartoon
            <Icon name="arrow" size={18} />
          </button>
          <button className="button text assistant-quick-start" onClick={() => onIdea()}>Start with an idea</button>
          <button className="button secondary small" onClick={onPicture}>Turn My Picture Into a Cartoon</button>
          <button className="button secondary small" onClick={onPuppet}>Create a Puppet Character</button>
          <button className="button secondary small" onClick={onFullBodyDemo}>Try the full-body cartoon workshop</button>
          <button className="button secondary small" onClick={onScoutVoicedDemo}>Watch Scout walk and talk</button>
          <button className="button secondary small" onClick={onScoutActingDemo}>Watch Scout pick up a checklist (1:00)</button>
          <button className="button secondary small" onClick={onScoutWobblyChairDemo}>Watch Scout and the wobbly chair (1:30)</button>
          <button className="button secondary small" onClick={onScoutHelperJoDemo}>Watch Scout meet Helper Jo (2:00)</button>
          <button className="button secondary small" onClick={onTalkingDemo}>Try Shine Says Hello</button>
          <button className="button secondary small" onClick={onGardenDemo}>Try Helping Hands Waters a Little Garden</button>
          <span className="hero-note">
            No experience needed. Just your imagination.
          </span>
        </div>
        <div className="hero-art">
          <div className="art-caption">
            <span className="handwritten">
              A little kindness.
              <br />A whole lot of magic.
            </span>
            <svg viewBox="0 0 80 58" aria-hidden="true">
              <path
                d="M6 5q-10 40 53 35m-13-8 16 8-15 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="hero-stage">
            <Stage project={demo} scene={demo.scenes[3]} progress={0.38} />
            <div className="speech-bubble">
              There’s room for you!<span>♡</span>
            </div>
            <button
              className="hero-play"
              aria-label="Open demo cartoon"
              onClick={onDemo}
            >
              <Icon name="play" size={22} />
            </button>
            <span className="art-frame-corner corner-left" />
            <span className="art-frame-corner corner-right" />
          </div>
          <div className="art-label">
            <span className="demo-tag">
              <span />
              MADE IN CHIPTOONS
            </span>
            <span>
              A little room for a friend
              <Icon name="heart" size={15} />
            </span>
          </div>
          <span className="floating-star">✦</span>
        </div>
      </section>
      <section
        className="creation-paths"
        aria-label="Guided starting workflows"
      >
        {[
          {
            icon: "bulb",
            title: "Start with a Thought",
            text: "An idea → an editable scene outline",
            action: () => onIdea(),
          },
          {
            icon: "pencil",
            title: "Start with a Sketch",
            text: "Draw or upload → choose a role → build a story",
            action: () => onGuidedArt("sketch"),
          },
          {
            icon: "image",
            title: "Start with an Image",
            text: "Keep your original → compose and animate",
            action: () => onGuidedArt("image"),
          },
        ].map((path) => (
          <button
            className="creation-path"
            key={path.title}
            onClick={path.action}
          >
            <Icon name={path.icon} size={26} />
            <strong>{path.title}</strong>
            <span>{path.text}</span>
            <Icon name="arrow" size={18} />
          </button>
        ))}
      </section>
      <details className="transform-examples">
        <summary>Try a Fix, Build &amp; Transform example</summary>
        <div className="series-actions">
          {(Object.entries(EXAMPLE_NAMES) as [TransformExample, string][]).map(([id, name]) =>
            <button className="button secondary small" key={id} onClick={() => onTransformDemo(id)}>Try {name}</button>)}
        </div>
      </details>
      <details className="transform-examples">
        <summary>Try a Visual Teaching example</summary>
        <div className="series-actions">
          {(Object.entries(EXAMPLE_NAMES) as [TransformExample, string][]).map(([id, name]) =>
            <button className="button secondary small" key={id} onClick={() => onFocusDemo(id)}>{name} · Visual lesson</button>)}
        </div>
      </details>
      <details className="transform-examples">
        <summary>Try a Pause, Think &amp; Try example</summary>
        <div className="series-actions">
          {(Object.entries(PARTICIPATION_EXAMPLES) as [TransformExample, string][]).map(([id, name]) =>
            <button className="button secondary small" key={id} onClick={() => onParticipationDemo(id)}>{name}</button>)}
        </div>
      </details>
      <details className="transform-examples">
        <summary>Try a Sound Director example</summary>
        <div className="series-actions">
          <button className="button secondary small" onClick={onSoundGardenDemo}>Helping Hands — A Garden Full of Sounds</button>
        </div>
      </details>
      <details className="transform-examples">
        <summary>Try a Camera &amp; Shot Director example</summary>
        <div className="series-actions">
          <button className="button secondary small" onClick={onCameraDemo}>The Wobbly Wagon — A Closer Look</button>
        </div>
      </details>
      <details className="transform-examples">
        <summary>Try a complete episode with opening and credits</summary>
        <div className="series-actions"><button className="button secondary small" onClick={onStoryCardDemo}>{STORY_CARD_DEMO}</button></div>
      </details>
      <div className="creative-actions" aria-label="Ways to create">
        {[
          {
            icon: "image",
            title: "Upload a sketch or image",
            description: "Give your art a little life",
            action: onUpload,
            color: "peach",
          },
          {
            icon: "pencil",
            title: "Draw a character",
            description: "Doodles welcome here",
            action: onDraw,
            color: "lavender",
          },
          {
            icon: "folder",
            title: "Open my cartoons",
            description: "Pick up where you left off",
            action: () =>
              document
                .getElementById("my-cartoons")
                ?.scrollIntoView({ behavior: "smooth" }),
            color: "mint",
          },
          {
            icon: "play",
            title: "Try a demo cartoon",
            description: "Take a little look around",
            action: onDemo,
            color: "yellow",
          },
        ].map((a) => (
          <button className="creative-action" key={a.title} onClick={a.action}>
            <span className={`action-icon ${a.color}`}>
              <Icon name={a.icon} size={24} />
            </span>
            <span>
              <strong>{a.title}</strong>
              <small>{a.description}</small>
            </span>
            <Icon name="arrow" size={17} className="action-arrow" />
          </button>
        ))}
      </div>
      <section className="library-banner" aria-label="Reusable art studio">
        <span className="library-banner-art">
          <Icon name="pencil" size={32} />
          <span className="art-spark" aria-hidden="true">
            ✦
          </span>
        </span>
        <div>
          <span className="eyebrow">DRAW IT ONCE. DREAM UP WHAT’S NEXT.</span>
          <h2>Your art. A hundred adventures.</h2>
          <p>
            Keep characters, backgrounds, props and drawings ready for your next
            little story.
          </p>
        </div>
        <button className="button secondary" onClick={onLibrary}>
          <Icon name="folder" />
          Open art library
          <Icon name="arrow" size={18} />
        </button>
      </section>
      <section
        className="projects-section"
        id="my-cartoons"
        aria-labelledby="projects-heading"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR LITTLE CREATIVE CORNER</span>
            <h2 id="projects-heading">
              My cartoons <span className="count-badge">{projects.length}</span>
            </h2>
          </div>
          <div className="section-actions">
            <button className="button secondary small" onClick={onSeries}>My Cartoon Series</button>
            <button className="button secondary small" onClick={onRecovery}>
              Project &amp; Media Recovery
            </button>
            <button className="button text small" onClick={onImport}>
              <Icon name="upload" size={17} />
              Restore a backup
            </button>
            <button className="button secondary small" onClick={() => onIdea()}>
              <Icon name="plus" size={17} />
              New cartoon
            </button>
          </div>
        </div>
        {projects.length > 0 && (
          <div className="filter-tabs" aria-label="Filter cartoons">
            {[
              ["all", "All stories"],
              ["draft", "In the making"],
              ["ready", "Ready to share"],
            ].map(([id, label]) => (
              <button
                aria-pressed={filter === id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
                key={id}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {visibleProjects.length ? (
          <div className="project-grid">
            {visibleProjects.map((p) => (
              <article className="project-card" key={p.id}>
                <button
                  className="project-preview"
                  aria-label={`Continue ${p.title}`}
                  onClick={() => onOpen(p)}
                >
                  <Stage project={p} scene={p.scenes[0]} />
                  <span className="project-time">
                    <Icon name="film" size={13} />
                    {p.scenes.length} scenes<span>·</span>
                    {durationLabel(totalDuration(p))}
                  </span>
                </button>
                <div className="project-info">
                  <span className={`status-tag ${p.status}`}>
                    {p.status === "ready" ? "Ready to share" : "In the making"}
                  </span>
                  <h3>{p.title}</h3>
                  {p.templateId && (
                    <small className="field-hint">
                      From an original editable starter
                    </small>
                  )}
                  <p>
                    Edited{" "}
                    {new Date(p.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <div className="project-actions">
                    <button
                      className="button text small"
                      onClick={() => onOpen(p)}
                    >
                      Continue story
                      <Icon name="arrow" size={16} />
                    </button>
                    <span>
                      <button
                        className="icon-button"
                        aria-label={`Duplicate ${p.title}`}
                        onClick={() => onDuplicate(p)}
                      >
                        <Icon name="copy" size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${p.title}`}
                        onClick={() => onDelete(p)}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-projects">
            <span className="empty-illustration">
              <Icon name="film" size={34} />
              <span>✦</span>
            </span>
            <div>
              <h3>
                {projects.length
                  ? "No stories in this chapter yet."
                  : "Your first story belongs right here."}
              </h3>
              <p>
                {projects.length
                  ? "Switch filters or start something new."
                  : "Start with a tiny idea. We’ll help you give it a beginning, a middle, and a little magic."}
              </p>
            </div>
            <button className="button text" onClick={() => onIdea()}>
              Let’s make a cartoon
              <Icon name="arrow" size={18} />
            </button>
          </div>
        )}
      </section>
      <section
        className="starter-section"
        id="story-starters"
        aria-labelledby="starters-heading"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">A LITTLE INSPIRATION</span>
            <h2 id="starters-heading">Small stories. Big heart.</h2>
            <p className="section-description">
              Pick a starting point and make it wonderfully yours.
            </p>
          </div>
          <button
            className="button text small"
            onClick={() => setAllStarters((s) => !s)}
          >
            {allStarters ? "Show a few favorites" : `Browse all ${STARTERS.length} starters`}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <div className="starter-grid">
          {(allStarters ? STARTERS : STARTERS.slice(0, 3)).map((s, i) => (
            <button
              className={`starter-card ${s.color}`}
              key={s.id}
              onClick={() => onIdea(s.id)}
            >
              <span className="starter-art">
                <StarterIllustration kind={s.id} index={i} />
              </span>
              <span className="starter-content">
                <span className="starter-category">
                  <Icon name={s.icon} size={14} />
                  {s.category}
                </span>
                <strong>{s.title}</strong>
                <span>{s.description}</span>
                <span className="starter-link">
                  Make it my story
                  <Icon name="arrow" size={17} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="getting-started">
        <div className="tutorial-icon">
          <Icon name="bulb" size={29} />
        </div>
        <div>
          <h3>A thought becomes a story. A story becomes a toon.</h3>
          <p>Idea → storyboard → a little movement → your very own cartoon.</p>
        </div>
        <button className="button secondary small" onClick={onHelp}>
          Show me around
          <Icon name="arrow" size={17} />
        </button>
      </section>
    </main>
  );
}

function StarterIllustration({ kind, index }: { kind: string; index: number }) {
  return (
    <svg viewBox="0 0 180 155" fill="none" aria-hidden="true">
      <ellipse cx="90" cy="132" rx="58" ry="9" fill="#273247" opacity=".08" />
      {kind === "kindness" || kind === "feelings" ? (
        <g transform="translate(0 2)">
          <path
            d="M88 44c-27-36-70-7-49 26l49 47 49-47c21-33-22-62-49-26"
            fill="#e9856c"
            stroke="#fff7e8"
            strokeWidth="5"
          />
          <path
            d="M68 69v6m40-6v6m-32 9q12 13 24 0"
            stroke="#673f3c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="m135 27 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="#e8af4f" />
          <path d="M34 106v12m-6-6h12" stroke="#9a7765" strokeWidth="2" />
        </g>
      ) : kind === "friendship" || kind === "teamwork" ? (
        <g>
          <path
            d="M37 87h106l-14 41H51Z"
            fill="#c79662"
            stroke="#fff7e8"
            strokeWidth="5"
          />
          <path d="M60 88q2-51 30-51t30 51" stroke="#a6754f" strokeWidth="7" />
          <path d="M53 89c1-28 27-32 40-17 13-26 46-12 43 17" fill="#f6efcc" />
          <circle cx="66" cy="76" r="15" fill="#e88364" />
          <path d="m64 61 5-12" stroke="#588d6a" strokeWidth="5" />
          <path d="m87 87 10-26 22 9-8 22" fill="#96b794" />
          <path d="M52 101h76m-68 12h60" stroke="#ae784c" strokeWidth="3" />
          <path d="m137 37 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#e6b958" />
        </g>
      ) : (
        <g>
          <path
            d="m33 74 30-18 28 18v42l-28 16-30-16Z"
            fill="#e6ad64"
            stroke="#fff7e8"
            strokeWidth="4"
          />
          <path
            d="m85 74 30-18 28 18v42l-28 16-30-16Z"
            fill="#a39bce"
            stroke="#fff7e8"
            strokeWidth="4"
          />
          <path
            d="m59 41 30-18 28 18v42L89 99 59 83Z"
            fill="#a1c3b3"
            stroke="#fff7e8"
            strokeWidth="4"
          />
          <path
            d="m59 41 30 17 28-17m-28 17v41M33 74l30 17 27-17m-27 17v41m22-58 30 17 28-17m-28 17v41"
            stroke="#fff7e8"
            strokeWidth="3"
          />
          <path
            d={`m${index % 2 ? 33 : 147} 24 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z`}
            fill="#d5aa59"
          />
        </g>
      )}
    </svg>
  );
}
