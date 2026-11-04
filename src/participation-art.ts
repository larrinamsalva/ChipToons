import type { FocusCardProps } from "./components/FocusArt";
import { focusTextLines, type Rectangle } from "./focus-motion";
import { CHOICE_ICONS, participationAt } from "./participation-model";

type MomentFrame = NonNullable<ReturnType<typeof participationAt>>;

export function participationCards({ moment, phase }: MomentFrame, captionBand?: Rectangle): FocusCardProps[] {
  const showAnswer = phase === "reveal";
  const choice = showAnswer && moment.answer !== undefined ? moment.choices[moment.answer] : undefined;
  const title = showAnswer ? moment.kind === "feel" ? "One kind possibility" :
    moment.kind === "try" ? "Let’s try it together" : "Let’s see what happened" : phase === "think" ? "Take a moment to think" : "Join in";
  const text = showAnswer ? moment.feedback : moment.question;
  const y = captionBand && captionBand.y < 225 ? captionBand.y + captionBand.height + 9 : 12;
  const heading = { text: title, size: 15, y: 22 };
  const lines = focusTextLines(text, 41).map((text, index) => ({ text, size: 23, y: 49 + index * 26 }));
  const main = { x: 92, y, width: 616, height: lines.at(-1)!.y + 12 };
  const ink = "#172139";
  const result = [{ box: main, ink, paper: showAnswer ? "#dff2df" : "#fff3bf", lines: [heading, ...lines] }];
  if (!showAnswer && moment.choices.length) {
    const gap = 8;
    const width = (main.width - gap * (moment.choices.length - 1)) / moment.choices.length;
    const labels = moment.choices.map((choice, index) => focusTextLines(
      `${index + 1}. ${choice.icon ? CHOICE_ICONS[choice.icon] + " " : ""}${choice.text}`,
      Math.floor((width - 24) / 12),
    ));
    const height = Math.max(...labels.map(items => items.length)) * 22 + 14;
    for (const [index, items] of labels.entries()) result.push({
      box: { x: main.x + index * (width + gap), y: y + main.height + 6, width, height },
      ink, paper: ["#e7f0ff", "#ffe9e5", "#eee9ff"][index],
      lines: items.map((text, i) => ({ text, size: 18, y: 23 + i * 22 })),
    });
  }
  if (choice) {
    const lines = focusTextLines(`${(moment.answer ?? 0) + 1}. ${choice.text}${choice.explanation ? " · " + choice.explanation : ""}`, 55)
      .map((text, index) => ({ text, size: 17, y: 23 + index * 20 }));
    result.push({ box: { x: main.x, y: y + main.height + 6, width: main.width, height: lines.at(-1)!.y + 10 },
      ink, paper: "#ffffff", lines });
  }
  return result;
}
