import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { createAssistantDraft } from "./assistant";
import { clone, uid } from "./model";
import { listLibrary } from "./library";
import { deleteProject, listProjects, readProjectSnapshot, saveProject } from "./storage";
import { createSeriesEpisode, listSeries, saveSeries } from "./series-storage";
import { continuityWarnings, episodeBrief, newCast, newEpisode, newSeries, readSeriesBackup, seriesBackup, validateSeries } from "./series";
import { kindHeartsCrew, seasonTemplate } from "./series-starter";

describe("series metadata and continuity", () => {
  it("builds 30 editable plans and six independent original puppets", async () => {
    const { plan, artwork } = kindHeartsCrew();
    expect(plan.episodes).toHaveLength(30);
    expect(plan.episodes.every(episode => !episode.projectId && episode.status === "Planned")).toBe(true);
    expect(new Set(plan.episodes.map(episode => episode.lesson)).size).toBe(30);
    expect(seasonTemplate()).toHaveLength(30);
    expect(episodeBrief(plan.episodes[1], 2).background).toBe("classroom");
    const first = await saveSeries(plan, null, artwork);
    await expect(saveSeries(plan, null, artwork)).rejects.toMatchObject({ name: "SeriesConflict" });
    expect((await listSeries()).find(entry => entry.id === plan.id)).toEqual(first);
    expect((await listLibrary()).filter(entry => artwork.some(item => item.id === entry.id))).toHaveLength(6);
  });

  it("copies a puppet into separate episodes while preserving two same-name identities", async () => {
    const { plan, artwork } = kindHeartsCrew();
    const a = { ...newCast(artwork[0]), name: "Sunny" };
    const b = { ...newCast(artwork[0]), name: "Sunny" };
    const cast = [a, b];
    const episode = { ...plan.episodes[0], main: [a.id], supporting: [b.id] };
    const series = { ...plan, id: uid(), cast, episodes: [episode] };
    const make = () => createAssistantDraft(episodeBrief(episode, 1),
      cast.map(member => ({ name: member.name, library: artwork[0], seriesCastId: member.id })),
      undefined, episode.question).project;
    const first = make(), second = make();
    expect(first.characters.map(character => character.name)).toEqual(["Sunny", "Sunny"]);
    expect(first.characters.map(character => character.seriesCastId)).toEqual([a.id, b.id]);
    expect(first.characters[0].id).not.toEqual(second.characters[0].id);
    expect(first.scenes.at(-1)?.question).toBe(episode.question);
    expect(continuityWarnings(series, episode, first, artwork)).toEqual([]);
    const laterArt = clone(artwork);
    laterArt[0].character!.shirt = "#112233";
    expect(continuityWarnings(series, episode, first, laterArt)).toEqual([
      expect.stringContaining("appearance differs"), expect.stringContaining("appearance differs"),
    ]);
    second.scenes[0].elements[0].appearance = { shirt: "#11aabb" };
    expect(continuityWarnings(series, episode, second, artwork)).toEqual([
      expect.stringContaining("appearance differs"),
    ]);
    second.characters[0].puppet!.poses[0].name = "Edited in this episode";
    expect(first.characters[0].puppet!.poses[0].name).toBe("Standing");
    expect(artwork[0].character!.puppet!.poses[0].name).toBe("Standing");
  });

  it("restores metadata as a separate plan and validates references and limits", async () => {
    const { plan } = kindHeartsCrew();
    plan.episodes[0].projectId = "linked-original";
    const restored = await readSeriesBackup(seriesBackup(plan));
    expect(restored.id).not.toBe(plan.id);
    expect(restored.episodes[0].id).not.toBe(plan.episodes[0].id);
    expect(restored.episodes[0].projectId).toBeUndefined();
    expect(restored.cast).toEqual(plan.cast);
    await expect(readSeriesBackup(new Blob(['{"version":4}']))).rejects.toThrow("supported");
    expect(() => validateSeries({ ...plan, episodes: [{ ...plan.episodes[0], main: ["missing"] }] })).toThrow();
    expect(() => validateSeries({ ...plan, target: 101 })).toThrow();
  });

  it("atomically creates one linked project and preserves it when unlinking", async () => {
    const { plan } = kindHeartsCrew();
    const episode = plan.episodes[0];
    const source = { ...plan, id: uid(), episodes: [episode] };
    const { revision } = await saveSeries(source, null);
    const make = () => createAssistantDraft(episodeBrief(episode, 1), [{ name: "Jun" }]).project;
    const first = make(), second = make();
    const ids = await Promise.all([first, second].map(draft =>
      createSeriesEpisode(source.id, episode.id, revision, draft)));
    expect(ids).toEqual([first.id, first.id]);
    expect((await readProjectSnapshot(first.id)).revision).toBeTruthy();
    expect((await readProjectSnapshot(second.id)).project).toBeUndefined();
    const current = (await listSeries()).find(entry => entry.id === source.id)!;
    expect(current.plan.episodes[0]).toMatchObject({ projectId: first.id, status: "Storyboard" });
    await expect(saveSeries(source, revision)).rejects.toMatchObject({ name: "SeriesConflict" });
    await saveSeries(source, current.revision);
    expect((await readProjectSnapshot(first.id)).project?.id).toBe(first.id);
    await deleteProject(first.id);
  });

  it("keeps a broken link visible and rolls back when a newly linked project vanishes", async () => {
    const { plan } = kindHeartsCrew();
    const episode = plan.episodes[0];
    const project = createAssistantDraft(episodeBrief(episode, 1), [{ name: "Jun" }]).project;
    await saveProject(project);
    const source = { ...plan, id: uid(), episodes: [episode] };
    const initial = await saveSeries(source, null);
    const linked = { ...source, episodes: [{ ...episode, projectId: project.id }] };
    const saved = await saveSeries(linked, initial.revision);
    await deleteProject(project.id);
    expect(continuityWarnings(saved.plan, saved.plan.episodes[0], undefined, [])).toContain(
      "The linked cartoon is unavailable. Restore its episode backup and link it again.");
    const unlinked = await saveSeries(source, saved.revision);
    await expect(saveSeries(linked, unlinked.revision)).rejects.toThrow("no longer available");
    expect((await listSeries()).find(entry => entry.id === source.id)).toEqual(unlinked);
  });

  it("retains the plan and creates no cartoon if a write fails", async () => {
    const { plan } = kindHeartsCrew();
    const episode = plan.episodes[0];
    const initial = await saveSeries({ ...plan, id: uid(), episodes: [episode] }, null);
    const project = createAssistantDraft(episodeBrief(episode, 1), [{ name: "Jun" }]).project;
    const put = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === "series") throw new DOMException("Full", "QuotaExceededError");
      return put.apply(this, args);
    });
    try {
      await expect(createSeriesEpisode(initial.id, episode.id, initial.revision, project))
        .rejects.toMatchObject({ name: "QuotaExceededError" });
    } finally { spy.mockRestore(); }
    expect((await listProjects()).some(item => item.id === project.id)).toBe(false);
    expect((await listSeries()).find(entry => entry.id === initial.id)).toEqual(initial);
  });

  it("rejects duplicate links and stale creation after another tab edits the plan", async () => {
    const initial = newSeries();
    const plans = [newEpisode(1), newEpisode(2)];
    expect(() => validateSeries({ ...initial, episodes: plans.map(episode => ({ ...episode, projectId: "one-project" })) })).toThrow();
    const saved = await saveSeries({ ...initial, episodes: plans }, null);
    const draft = createAssistantDraft(episodeBrief(kindHeartsCrew().plan.episodes[0], 1), [{ name: "Jun" }]).project;
    await saveSeries({ ...saved.plan, name: "Updated" }, saved.revision);
    await expect(createSeriesEpisode(initial.id, plans[0].id, saved.revision, draft))
      .rejects.toMatchObject({ name: "SeriesConflict" });
    expect((await readProjectSnapshot(draft.id)).project).toBeUndefined();
  });
});
