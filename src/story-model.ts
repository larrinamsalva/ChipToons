export const CHAPTERS = [
  {
    id: "opening",
    label: "Opening",
    prompt: "Invite the viewer into your world.",
  },
  {
    id: "introduction",
    label: "Introduction",
    prompt: "Meet the characters and what matters to them.",
  },
  {
    id: "challenge",
    label: "Problem or challenge",
    prompt: "Notice a small difficulty and name a feeling.",
  },
  {
    id: "exploration",
    label: "Exploration",
    prompt: "Listen, ask questions and try a safe idea.",
  },
  {
    id: "resolution",
    label: "Helpful resolution",
    prompt: "Take turns putting a kind plan into practice.",
  },
  {
    id: "closing",
    label: "Closing lesson",
    prompt: "Celebrate effort and invite a small real-world action.",
  },
] as const;
export type ChapterId = (typeof CHAPTERS)[number]["id"];
export type CreationSource = "thought" | "sketch" | "image";
