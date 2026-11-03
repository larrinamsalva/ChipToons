import { afterEach, expect, it, vi } from "vitest";
import { VoiceRecorder } from "./recording";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("a permission grant arriving after close immediately releases its microphone", async () => {
  const stop = vi.fn();
  let grant: (s: MediaStream) => void = () => {};
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        }),
    },
  });
  vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });
  const recorder = new VoiceRecorder(),
    complete = vi.fn();
  const pending = recorder.start(complete, vi.fn());
  recorder.cancel();
  grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await pending;
  expect(stop).toHaveBeenCalledOnce();
  expect(complete).not.toHaveBeenCalled();
});
it("failure to start a microphone encoder releases granted tracks", async () => {
  const stop = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      state = "inactive";
      start() {
        throw new Error("Cannot start encoder");
      }
    },
  );
  await expect(new VoiceRecorder().start(vi.fn(), vi.fn())).rejects.toThrow(
    "Cannot start encoder",
  );
  expect(stop).toHaveBeenCalledOnce();
});
