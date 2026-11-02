import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteProject,
  friendlyStorageError,
  listProjects,
  saveProject,
} from "./storage";
import { starterProject } from "./planner";

afterEach(() => vi.restoreAllMocks());
describe("IndexedDB persistence", () => {
  it("commits edits and original assets, reads them back, and deletes only the selected project", async () => {
    const a = starterProject();
    const b = starterProject("friendship");
    a.scenes[1].dialogue = "My saved dialogue";
    a.assets = [
      {
        id: "saved-art",
        type: "image",
        name: "original.png",
        mime: "image/png",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      },
    ];
    a.characters[0].assetId = "saved-art";
    await saveProject(a);
    await saveProject(b);
    expect((await listProjects()).find((p) => p.id === a.id)).toEqual(a);
    a.scenes[1].dialogue = "My updated dialogue";
    await saveProject(a);
    expect(
      (await listProjects()).find((p) => p.id === a.id)?.scenes[1].dialogue,
    ).toBe("My updated dialogue");
    await deleteProject(a.id);
    expect((await listProjects()).some((p) => p.id === a.id)).toBe(false);
    expect((await listProjects()).some((p) => p.id === b.id)).toBe(true);
    await deleteProject(b.id);
  });
  it("rejects malformed projects before writing and preserves previously saved data", async () => {
    const p = starterProject();
    await saveProject(p);
    p.scenes = [];
    await expect(saveProject(p)).rejects.toThrow();
    expect(
      (await listProjects()).find((s) => s.id === p.id)?.scenes,
    ).toHaveLength(6);
    await deleteProject(p.id);
  });
  it("reports quota failures without claiming an unsuccessful save was committed", async () => {
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    const p = starterProject();
    await expect(saveProject(p)).rejects.toMatchObject({
      name: "QuotaExceededError",
    });
    spy.mockRestore();
    expect((await listProjects()).some((s) => s.id === p.id)).toBe(false);
    expect(
      friendlyStorageError(new DOMException("Full", "QuotaExceededError")),
    ).toContain("Download a project backup");
  });
});
