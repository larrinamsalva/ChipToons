export const MEDIA_ACTIVITY_LOCK = "chiptoons-media-activity";
export const projectLock = (id: string) => `chiptoons-edit:${id}`;

export function browserLocks() {
  return globalThis.navigator?.locks;
}

// The browser releases this lock when its owning document closes or crashes.
export async function holdLock(
  name: string,
  options: LockOptions,
  lost?: () => void,
): Promise<(() => void) | null> {
  const locks = browserLocks();
  if (!locks) return () => {};
  return new Promise((resolve, reject) => {
    let acquired = false;
    void locks.request(name, options, lock => {
      if (!lock) {
        resolve(null);
        return;
      }
      acquired = true;
      return new Promise<void>(release => resolve(release));
    }).catch(error => {
      if (acquired) lost?.();
      else reject(error);
    });
  });
}
