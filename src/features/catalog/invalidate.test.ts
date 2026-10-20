import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
const revalidateTag = vi.fn();
const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/cache", () => ({ updateTag: (t: string) => updateTag(t), revalidateTag: (t: string, p: unknown) => revalidateTag(t, p), cacheLife: () => {}, cacheTag: () => {} }));
let afterThrows = false;
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => {
    if (afterThrows) throw new Error("`after` was called without waitUntil");
    afterCallbacks.push(cb);
  },
}));

const { invalidateCatalog, LATE_INVALIDATION_MS } = await import("./invalidate");

describe("invalidateCatalog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    updateTag.mockReset();
    revalidateTag.mockReset();
    afterCallbacks.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invalida al momento y otra vez después de responder (una regeneración vieja no queda guardada)", async () => {
    invalidateCatalog();
    expect(updateTag).toHaveBeenCalledWith("catalogo");
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);

    const late = afterCallbacks[0]();
    await vi.advanceTimersByTimeAsync(LATE_INVALIDATION_MS);
    await late;
    expect(revalidateTag).toHaveBeenCalledWith("catalogo", { expire: 0 });
  });

  it("si la plataforma no permite after(), el guardado no falla (ya se invalidó al momento)", () => {
    afterThrows = true;
    try {
      expect(() => invalidateCatalog()).not.toThrow();
      expect(updateTag).toHaveBeenCalledWith("catalogo");
    } finally {
      afterThrows = false;
    }
  });
});
