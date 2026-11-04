import { freshCharacter, newLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { sunnyRig } from "./puppet-model";
import { newCast, newEpisode, newSeries } from "./series";
import type { CastMember } from "./series";

export const CREW_ID = "chiptoons-kind-hearts-crew";
const heroes = [
  ["Compassion & Love", "Kindness and empathy", "#a83668", "#9f5b43", "#392b35", "warm"],
  ["Funny Bone", "Positive humor", "#92551a", "#efbb93", "#6b3824", "together"],
  ["Shine", "Helping others", "#b95b17", "#c88760", "#4f3447", "helping"],
  ["Calm", "Peaceful conflict resolution", "#3e638b", "#e2aa87", "#302727", "calm"],
  ["Better Thinking", "Learning and problem-solving", "#68529b", "#86543c", "#241e29", "warm"],
  ["Helping Hands", "Chores and responsibility", "#346b57", "#d8a476", "#75452d", "helping"],
] as const;

const lessons = [
  ["A Hello Heart", "Name a happy feeling", "greet a new neighbor", "How does a friendly hello feel?"],
  ["The Quiet Corner", "Notice when someone feels sad", "make a quiet place for a friend", "What can you say to a sad friend?"],
  ["Please Pass the Crayons", "Use please and thank you", "share the crayons for a mural", "When can you say thank you?"],
  ["Two Ears, One Story", "Listen until a friend finishes", "hear a friend tell a short story", "How can we show we are listening?"],
  ["A Basket for Everyone", "Offer help and wait for an answer", "offer to carry a basket together", "How can you ask before helping?"],
  ["The Silly Sock", "Laugh with friends kindly", "invent a silly sock dance", "How can everyone be part of a joke?"],
  ["Try a Slow Breath", "Name a way to feel calmer", "take a quiet pause before a game", "When could you take a slow breath?"],
  ["Different Favorite Colors", "Respect different preferences", "paint a sign in two favorite colors", "How can two different ideas fit together?"],
  ["Your Turn, My Turn", "Take fair turns", "share the playground swing", "What helps you wait for a turn?"],
  ["The Book Shelf Team", "Put shared things away", "sort the storybooks after reading", "What is one chore you can do today?"],
  ["A Seat on the Blanket", "Invite someone to join", "make space at a picnic", "What could you say to invite someone?"],
  ["The Wobbly Tower", "Try again after a small mistake", "rebuild a block tower with a wide base", "What could you change when you try again?"],
  ["The Mixed-Up Map", "Ask a trusted adult when unsure", "ask the librarian to point out a reading room", "Who is a trusted adult you can ask?"],
  ["A Promise to Water", "Follow through on a small promise", "make a watering plan for a seedling", "What can help you remember a promise?"],
  ["A Better Way to Say It", "Use kind words to disagree", "choose a game when two friends want different games", "How can you disagree kindly?"],
  ["The Paper Bridge", "Test ideas and notice what works", "build a paper bridge for a toy", "What changed when you folded the paper?"],
  ["The Playground Helpers", "Share jobs in a team", "prepare a playground activity together", "Which jobs could different friends try?"],
  ["Can I Help?", "Respect when someone says no", "offer help with a kite and listen to the answer", "What can you do if someone says no?"],
  ["The Picnic Plan", "Make a plan that includes different needs", "choose a picnic spot with shade and room to move", "How could you make the picnic work for everyone?"],
  ["Pause Before You Share", "Ask a trusted adult before sharing personal information", "check an unfamiliar form asking for a home address with a trusted adult", "Who can help you decide what is private?"],
  ["The Two-Choice Puzzle", "Compare choices and explain a reason", "choose materials for a toy shelter", "Why did one choice work better?"],
  ["A Second Look", "Ask before guessing what someone feels", "check in with a quiet teammate", "What could you ask instead of guessing?"],
  ["Tiny Garden Neighbors", "Care for living things", "watch garden insects without disturbing them", "How can we look closely and be gentle?"],
  ["The Reuse Parade", "Reuse safe materials with adult guidance", "turn clean cardboard into parade signs", "What could you reuse at home?"],
  ["A Note for Tomorrow", "Take responsibility and make a repair", "replace a sign that was accidentally torn", "How can you help put a mistake right?"],
  ["A Message to Check", "Pause and check an unfamiliar request", "show a trusted adult a game message asking for a school name", "What do you do when a message asks for private details?"],
  ["The Rainy-Day Plan", "Adjust a plan together", "move a nature activity indoors when it rains", "What can stay the same when a plan changes?"],
  ["The Quiet Team Signal", "Communicate in ways everyone can use", "agree on spoken and hand signals for a game", "How can a team make sure everyone understands?"],
  ["A Little Less Waste", "Make a responsible choice and observe its result", "compare two ways to pack a picnic", "What choice makes less rubbish?"],
  ["Our Neighborhood Heart", "Combine listening, care and teamwork", "organize a small welcome celebration with a trusted adult", "What will you do when someone new arrives?"],
] as const;

export function seasonTemplate(cast: CastMember[] = []) {
  return lessons.map(([title, lesson, goal, question], index) => {
    const lead = cast.length ? cast[index % cast.length] : undefined;
    const partner = cast.length ? cast[(index + 1) % cast.length] : undefined;
    const setting = ["a neighborhood park", "a community classroom", "a small garden"][index % 3];
    return {
      ...newEpisode(index + 1), title, lesson, setting, question, status: "Planned" as const,
      description: `${lead?.name ?? "A young helper"} wants to ${goal}. A friend listens and they try a gentle choice together.`,
      main: lead ? [lead.id] : [], supporting: partner && partner !== lead ? [partner.id] : [],
    };
  });
}

export function kindHeartsCrew() {
  const artwork: LibraryItem[] = heroes.map(([name, role, shirt, skin, hair], index) => {
    const rig = sunnyRig();
    rig.description = `${name} practices ${role.toLowerCase()} with the crew.`;
    rig.parts = rig.parts.map(part => part.role === "head"
      ? { ...part, width: part.width + index * 3, height: part.height + (index % 3) * 4 }
      : part.role === "torso" ? { ...part, width: part.width + (index % 3) * 5 } : part);
    return {
      ...newLibraryItem(name, "character"),
      character: { ...freshCharacter(name), shirt, skin, hair, puppet: rig },
    };
  });
  const cast = artwork.map((item, index): CastMember => ({
    ...newCast(item), role: heroes[index][1], heart: heroes[index][5],
    strengths: heroes[index][1], expressions: "A friendly smile and a thoughtful pause",
    relationships: "A trusted teammate in the Kind Hearts Crew",
    appearance: "An original shape puppet with a heart effect",
  }));
  const series = newSeries();
  return { artwork, plan: {
    ...series, id: CREW_ID, name: "The Kind Hearts Crew", target: 30, cast,
    description: "Six neighborhood helpers practice small, everyday acts of kindness.",
    themes: "Empathy, inclusion, problem-solving, responsibility and care",
    bible: {
      ...series.bible, concept: "Everyday choices can make someone feel welcome.",
      primary: heroes.map(([name]) => name).join(", "), relationships: "Friends take turns leading and helping.",
      locations: "Neighborhood park, community classroom and garden",
      style: "Soft original shapes and gentle heart effects",
      goals: "Start with naming feelings. Build toward teamwork, safe choices and care for nature.",
      rules: "Keep conflict gentle. Ask before helping. End with a question children can answer.",
    },
    episodes: seasonTemplate(cast),
  } };
}
