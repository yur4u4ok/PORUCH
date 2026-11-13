import { renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useLocationStore } from "@/stores/locationStore";

import { useGeolocation } from "./useGeolocation";

type Success = (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void;

function mockWatch(fixes: { accuracy: number; latitude: number }[]) {
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((ok: Success) => {
    fixes.forEach((fix, i) =>
      setTimeout(
        () => ok({ coords: { latitude: fix.latitude, longitude: 24, accuracy: fix.accuracy } }),
        i * 100,
      ),
    );
    return 7;
  });
  Object.defineProperty(navigator, "geolocation", {
    value: { watchPosition, clearWatch },
    configurable: true,
  });
  return { watchPosition, clearWatch };
}

afterEach(() => {
  vi.useRealTimers();
  useLocationStore.setState({ position: null, updatedAt: null });
});

it("waits past a rough first fix and returns the precise one", async () => {
  vi.useFakeTimers();
  const { clearWatch } = mockWatch([
    { accuracy: 900, latitude: 49.0 }, // Wi-Fi/cell guess
    { accuracy: 12, latitude: 49.84 }, // GPS
  ]);
  const { result } = renderHook(() => useGeolocation());
  const promise = result.current.locate({ force: true });
  await vi.advanceTimersByTimeAsync(200);
  await expect(promise).resolves.toMatchObject({ latitude: 49.84, accuracy: 12 });
  expect(clearWatch).toHaveBeenCalledWith(7);
});

it("uses the best fix it has when GPS never gets precise", async () => {
  vi.useFakeTimers();
  mockWatch([
    { accuracy: 900, latitude: 49.0 },
    { accuracy: 120, latitude: 49.8 },
  ]);
  const { result } = renderHook(() => useGeolocation());
  const promise = result.current.locate({ force: true });
  await vi.advanceTimersByTimeAsync(9000);
  await expect(promise).resolves.toMatchObject({ latitude: 49.8, accuracy: 120 });
});
