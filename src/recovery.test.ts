import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { audioBlob, enableEpisodeAudio, storeAudio } from "./audio-vault";
import { episodePackage, restoreProjectFile, verifyBackupFile } from "./episode-package";
import { emptyProduction } from "./media-model";
import { duplicateProject } from "./model";
import { starterProject } from "./planner";
import { cleanOriginals, recoverOriginal, recoveryInventory, verifiedRecording } from "./recovery";
import { builtInSound } from "./sounds";
import { db, deleteProject, listProjects, ProjectConflict, projectStores, readProjectSnapshot, saveProject } from "./storage";

beforeEach(() => vi.stubGlobal("navigator", {
  locks: {
    request: async (name: string, _options: LockOptions, callback: LockGrantedCallback) =>
      callback({ name, mode: "exclusive" } as Lock),
  },
  storage: { estimate: async () => ({ quota: 2 ** 32, usage: 0 }) },
}));
afterEach(async () => {
  vi.unstubAllGlobals();
  await write(projectStores, tx => projectStores.forEach(store => tx.objectStore(store).clear()));
});

async function write(stores: string[], work: (tx: IDBTransaction) => void) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(stores, "readwrite");
    work(tx);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}
async function audioProject() {
  const project = { ...starterProject(), ...emptyProduction(), audioAssets: [builtInSound("notice")] };
  return enableEpisodeAudio(project);
}
const backupFile = (blob: Blob) => new File([blob], "episode.ctepisode");
const audioFile = (blob: Blob) => new File([blob], "voice.wav", { type: "audio/wav" });

it("shows shared originals, retains them after project deletion, and makes cleanup explicitly transactional", async () => {
  const project = await audioProject();
  const copy = duplicateProject(project);
  await saveProject(copy, { revision: null, create: true });
  const before = await recoveryInventory();
  expect(before.projects.map(item => item.lastSave)).toEqual([expect.any(String), expect.any(String)]);
  expect(before.recordings).toHaveLength(1);
  expect(before.recordings[0].references).toHaveLength(2);
  expect(before.recordings[0].candidate).toBe(false);
  await deleteProject(project.id);
  expect((await recoveryInventory()).recordings[0].references).toHaveLength(1);
  const backup = backupFile(await episodePackage(copy));
  await deleteProject(copy.id);
  const review = await recoveryInventory();
  expect(review.recordings[0].candidate).toBe(true);
  const bytes = await verifiedRecording(review.recordings[0]);
  expect(bytes.size).toBe(review.recordings[0].bytes);
  expect((await recoveryInventory()).recordings).toHaveLength(1);
  expect(await cleanOriginals(review, review.recordings)).toEqual({ count: 1, bytes: bytes.size });
  expect((await recoveryInventory()).recordings).toHaveLength(0);
  expect((await verifyBackupFile(backup)).originals).toBe(1);
  expect(await listProjects()).toHaveLength(0);
  const restored = await restoreProjectFile(backup);
  expect(restored.id).not.toBe(copy.id);
  expect(await (await audioBlob(restored.audioAssets[0])).arrayBuffer()).toEqual(await bytes.arrayBuffer());
});

it("protects staged and unknown originals and aborts cleanup after saved references change", async () => {
  const project = await audioProject();
  await deleteProject(project.id);
  const staged = await storeAudio(builtInSound("birds"));
  const review = await recoveryInventory();
  const candidate = review.recordings.find(item => item.candidate)!;
  expect(review.recordings.find(item => item.id === staged.file!.key)?.candidate).toBe(false);
  const revived = duplicateProject(project);
  await saveProject(revived, { revision: null, create: true });
  await expect(cleanOriginals(review, [candidate])).rejects.toThrow(/references changed/);
  expect((await recoveryInventory()).recordings).toHaveLength(2);
  await deleteProject(revived.id);
  await write(["media-info"], tx => tx.objectStore("media-info").clear());
  expect((await recoveryInventory()).recordings.every(item => !item.candidate)).toBe(true);
});

it("reports a damaged original and repairs only with matching source bytes", async () => {
  const project = await audioProject();
  const original = project.audioAssets[0];
  const blob = await audioBlob(original);
  await write(["media"], tx => {
    const store = tx.objectStore("media");
    const request = store.get(original.file!.key);
    request.onsuccess = () => store.put({ ...request.result, bytes: new ArrayBuffer(blob.size) });
  });
  const record = (await recoveryInventory()).recordings[0];
  await expect(verifiedRecording(record)).rejects.toThrow(/integrity/);
  const wrong = audioFile(await audioBlob(builtInSound("birds")));
  await expect(recoverOriginal(project.id, wrong, original)).rejects.toThrow(/different/);
  expect((await listProjects())[0]).toEqual(project);
  await recoverOriginal(project.id, audioFile(blob), original);
  const [repaired] = await listProjects();
  expect(repaired.audioAssets[0].id).toBe(original.id);
  expect(repaired.audioAssets[0].file?.key).not.toBe(original.file?.key);
  expect(await (await audioBlob(repaired.audioAssets[0])).arrayBuffer()).toEqual(await blob.arrayBuffer());
  expect((await recoveryInventory()).recordings).toHaveLength(2);
});

it("lists missing references and preserves the project if repair cannot fit in storage", async () => {
  const project = await audioProject();
  const original = project.audioAssets[0];
  const blob = await audioBlob(original);
  await write(["media"], tx => tx.objectStore("media").delete(original.file!.key));
  const inventory = await recoveryInventory();
  expect(inventory.missing.map(ref => ref.asset.id)).toEqual([original.id]);
  const estimate = vi.spyOn(navigator.storage, "estimate").mockResolvedValue({ quota: 10, usage: 10 });
  await expect(recoverOriginal(project.id, audioFile(blob), original)).rejects.toMatchObject({ name: "QuotaExceededError" });
  expect((await listProjects())[0]).toEqual(project);
  expect((await recoveryInventory()).recordings).toHaveLength(0);
  estimate.mockRestore();
  await recoverOriginal(project.id, audioFile(blob), original);
  expect((await recoveryInventory()).missing).toHaveLength(0);
});

it("rejects stale revision writes, including after a takeover fence or deletion", async () => {
  const project = await audioProject();
  const old = await readProjectSnapshot(project.id);
  const owner = await readProjectSnapshot(project.id, true);
  expect(owner.revision).not.toBe(old.revision);
  await expect(saveProject({ ...project, title: "Old draft" }, { revision: old.revision })).rejects.toBeInstanceOf(ProjectConflict);
  const revision = await saveProject({ ...project, title: "Newer work" }, { revision: owner.revision });
  await expect(deleteProject(project.id, { revision: old.revision })).rejects.toBeInstanceOf(ProjectConflict);
  expect((await readProjectSnapshot(project.id)).project?.title).toBe("Newer work");
  await deleteProject(project.id, { revision });
  await expect(saveProject(project, { revision })).rejects.toBeInstanceOf(ProjectConflict);
  expect(await listProjects()).toHaveLength(0);
});

it("checks backup contents without writing or requiring free quota", async () => {
  const project = await audioProject();
  const blob = await episodePackage(project);
  const before = await recoveryInventory();
  vi.spyOn(navigator.storage, "estimate").mockResolvedValue({ quota: 10, usage: 10 });
  expect(await verifyBackupFile(backupFile(blob))).toEqual({
    title: project.title, scenes: project.scenes.length, originals: 1,
  });
  await expect(verifyBackupFile(backupFile(blob.slice(0, blob.size - 1)))).rejects.toThrow();
  await expect(restoreProjectFile(backupFile(blob))).rejects.toMatchObject({ name: "QuotaExceededError" });
  expect(await recoveryInventory()).toEqual(before);
});
