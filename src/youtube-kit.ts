import type { Project } from "./model";
import { EXPORT_RECORDING_LEAD_SECONDS } from "./segments";
import { singleMovieSrt } from "./single-movie";
import type { MovieRange } from "./single-movie-plan";
import { episodePresentation } from "./story-card-studio";
import type { SeriesPlan } from "./series";
import { sceneStart } from "./timeline";
import { WEBM_METADATA_LIMIT, readWebmTracks } from "./webm";

export interface PublishingMovie {
  video: Blob;
  duration: number;
  width: number;
  height: number;
  plan: MovieRange[];
  ranges: MovieRange[];
  burned: boolean;
  expectAudio?: boolean;
  keepForDownload?: () => void;
}

export const YOUTUBE_HELP = {
  audience: "https://support.google.com/youtube/answer/9527654",
  chapters: "https://support.google.com/youtube/answer/9884579",
  longer: "https://support.google.com/youtube/answer/71673",
} as const;

export const publishingChecks = [
  ["audience", "This video is directed to ages 4–7? Choose “Yes, it’s Made for Kids” in YouTube Studio. Review the intended audience of each video. The setting does not guarantee placement in the YouTube Kids app."],
  ["rights", "Confirm permission to publish all artwork, music, voices and other material. Include any required credits."],
  ["privacy", "Remove private details about children, including identifying names, locations, school information and contact details."],
  ["safety", "For hazardous repair activities, show a grown-up supervising or doing the work. Check that the episode gives children an age-appropriate role."],
  ["sound", "Listen for narration and sound, and check that subtitles are accurate and timed to the finished movie."],
  ["playback", "Watch the complete downloaded movie, including its ending and any joins. Check the thumbnail and wording against what the episode actually shows."],
  ["longer", "For an upload longer than 15 minutes, verify your YouTube account first."],
] as const;

export async function publishingTracks(movie: PublishingMovie) {
  const head = new Uint8Array(await movie.video.slice(0, WEBM_METADATA_LIMIT).arrayBuffer());
  const tracks = readWebmTracks(head, movie.video.size);
  if (tracks.width !== movie.width || tracks.height !== movie.height ||
      !Number.isFinite(movie.duration) || movie.duration <= 0)
    throw new Error("The WebM tracks do not match the verified movie properties.");
  return tracks;
}

export const publishingSubtitles = (project: Project, movie: PublishingMovie) =>
  singleMovieSrt(project, movie.plan, movie.ranges);

export interface EpisodeDetails {
  title: string;
  description: string;
  topic: string;
  series: string;
  episode: string;
  hashtags: string;
  credits: string;
}

export function draftEpisodeDetails(project: Project, series: SeriesPlan[] = []): EpisodeDetails {
  const metadata = episodePresentation(project, series);
  const title = metadata.number ? [metadata.series, `Episode ${metadata.number}: ${metadata.title}`].filter(Boolean).join(" | ")
    : project.title;
  const credits = project.scenes.flatMap(scene => scene.storyCard?.credits ?? [])
    .filter(credit => credit.name.trim())
    .map(credit => [credit.role ? `${credit.role}: ${credit.name}` : credit.name, credit.license, credit.url].filter(Boolean).join(" · "));
  const tags = [metadata.series, project.lesson].map(value => value.match(/[\p{L}\p{N}]+/gu)?.slice(0, 4).join(""))
    .filter((value): value is string => !!value && value.length <= 35);
  return {
    title: title.slice(0, 100), description: project.idea, topic: project.lesson,
    series: metadata.series, episode: metadata.number ? String(metadata.number) : "",
    hashtags: [...new Set(tags)].map(tag => `#${tag}`).join(" "), credits: [...new Set(credits)].join("\n"),
  };
}

export type PublishingChapter = { seconds: number; title: string };

export function publishingChapters(project: Project, movie: PublishingMovie): PublishingChapter[] {
  const boundaries = project.scenes.map((scene, index) => {
    const time = sceneStart(project, index);
    const part = movie.plan.findIndex(range => range.start <= time && time < range.end);
    const seconds = part < 0 ? -1 : Math.floor(movie.ranges[part].start + EXPORT_RECORDING_LEAD_SECONDS + time - movie.plan[part].start);
    return { seconds: index === 0 ? 0 : seconds,
      title: scene.storyCard?.kind === "chapter" ? scene.storyCard.title : scene.title };
  });
  function usable(candidates: PublishingChapter[]) {
    const result: PublishingChapter[] = [];
    for (const chapter of candidates) {
      if (chapter.seconds < 0 || movie.duration - chapter.seconds < 10 ||
          (result.length && chapter.seconds - result.at(-1)!.seconds < 10)) continue;
      result.push(chapter);
    }
    return result.length >= 3 ? result : [];
  }
  const authored = usable(boundaries.filter((_, i) => {
    const scene = project.scenes[i];
    return i === 0 || scene.storyCard?.kind === "chapter" ||
      (scene.chapter && scene.chapter !== project.scenes[i - 1].chapter);
  }));
  return authored.length ? authored : usable(boundaries);
}

export function chapterTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const clock = `${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return minutes >= 60 ? `${Math.floor(minutes / 60)}:${clock}` : clock;
}

export function episodeDescription(details: EpisodeDetails, chapters: string) {
  return [
    details.description.trim(),
    details.topic.trim() && `Learning topic: ${details.topic.trim()}`,
    [details.series.trim(), details.episode.trim() && `Episode ${details.episode.trim()}`].filter(Boolean).join(" · "),
    chapters,
    details.credits.trim() && `Credits\n${details.credits.trim()}`,
    details.hashtags.trim(),
  ].filter(Boolean).join("\n\n");
}
