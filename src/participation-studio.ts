import { uid } from "./model";
import type { Project, Scene } from "./model";
import { participationWindow } from "./participation-model";
import type { Activity, Participation } from "./participation-model";
import { scriptFor, selectedTake, blankLine, lineStatus } from "./script";
import { stepTime } from "./transform-model";

export const PROMPTS: Record<Activity, { question: string; feedback: string; young: string; older: string }> = {
  notice: { question: "What do you notice?", feedback: "Look closely. A little detail can help us understand what happened.",
    young: "Ask children to spot one familiar object.", older: "Compare two details and ask which changed." },
  predict: { question: "What do you think will happen next?", feedback: "Let’s watch and see what happens.",
    young: "Ask about one thing they can see right now.", older: "Offer two possible outcomes and invite a simple reason." },
  choose: { question: "Which idea would help?", feedback: "A trusted grown-up can help us check what is safe.",
    young: "Offer two short choices and use familiar words.", older: "Compare two plans and explain why one helps." },
  try: { question: "Can you take one slow breath with me?", feedback: "Breathe out slowly. Take your time.",
    young: "Invite one simple action like a breath or a count.", older: "Practice two safe steps in order and name what changed." },
  feel: { question: "How might our friend feel?", feedback: "People can feel different things. We can listen and ask kindly.",
    young: "Name one feeling and show a face that fits it.", older: "Invite several feelings and ask what kindness could look like." },
};

export function newParticipation(scene: Scene, at: number, stepId?: string): Participation {
  const step = scene.learningSteps?.find(item => item.id === stepId);
  return {
    id: uid(), kind: "notice", question: PROMPTS.notice.question, feedback: PROMPTS.notice.feedback,
    at: Math.max(0, Math.min(scene.duration - 7, Math.round(at * 100) / 100)),
    askFor: 1, thinkFor: 4, revealFor: 2, choices: [], stepId: step?.id,
  };
}

export function participationVoice(project: Project, scene: Scene, lineId?: string) {
  const line = scene.script?.lines.find(item => item.id === lineId);
  const clip = line && selectedTake(project, line).clip;
  return { line, clip: clip && !clip.muted && clip.volume > 0 && project.audioAssets.some(item => item.id === clip.assetId) ? clip : undefined };
}

export function participationWarnings(project: Project, scene: Scene, moment: Participation) {
  const window = participationWindow(moment);
  const messages: string[] = [];
  for (const [role, id, start, end] of [
    ["Question", moment.questionLineId, window.start, window.think],
    ["Explanation", moment.answerLineId, window.reveal, window.end],
  ] as const) {
    if (!id) continue;
    const { line, clip } = participationVoice(project, scene, id);
    if (!clip) messages.push(`${role} has no audible recording assigned. Record or choose a take in Script & Voice Director.`);
    else if (line && lineStatus(project, line) === "Needs review")
      messages.push(`${role} recording needs review in Script & Voice Director.`);
    else if (clip.start < start - 0.05 || clip.start > start + 0.35 || clip.start + clip.duration > end + 0.05)
      messages.push(`${role} recording runs from ${clip.start.toFixed(2)} to ${(clip.start + clip.duration).toFixed(2)} seconds. Check its timing against this moment.`);
  }
  const own = new Set([participationVoice(project, scene, moment.questionLineId).clip?.id,
    participationVoice(project, scene, moment.answerLineId).clip?.id]);
  if (project.audioClips.some(clip => !own.has(clip.id) && clip.sceneId === scene.id && !clip.muted && clip.volume > 0 &&
    (clip.category === "dialogue" || clip.category === "narration") && clip.start < window.reveal - 0.05 &&
    clip.start + clip.duration > window.think + 0.05))
    messages.push("Other speech plays during thinking time. Check the audio timeline before exporting.");
  const step = scene.learningSteps?.find(item => item.id === moment.stepId);
  if (step && Math.abs(stepTime(scene, step) - window.reveal) > 0.4)
    messages.push(`The linked learning step happens at ${stepTime(scene, step).toFixed(2)} seconds. Review where it fits around the reveal.`);
  return messages;
}

export function createParticipationLines(scene: Scene, moment: Participation) {
  const script = scriptFor(scene);
  const question = !moment.questionLineId && { ...blankLine(moment.speakerId ? "dialogue" : "narration", moment.question), speakerId: moment.speakerId };
  const answer = !moment.answerLineId && blankLine("narration", moment.feedback);
  return {
    script: { ...script, lines: [...script.lines, ...(question ? [question] : []), ...(answer ? [answer] : [])] },
    moment: { ...moment, questionLineId: question ? question.id : moment.questionLineId, answerLineId: answer ? answer.id : moment.answerLineId },
  };
}
