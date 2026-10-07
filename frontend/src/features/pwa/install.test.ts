import { describe, expect, it } from "vitest";

import { detectPlatform } from "./install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("detectPlatform", () => {
  it("tells iPhone Safari, other iPhone browsers and in-app browsers apart", () => {
    expect(detectPlatform(IPHONE_SAFARI)).toBe("ios");
    expect(detectPlatform(IPHONE_SAFARI.replace("Version/18.0", "CriOS/130.0"))).toBe("ios-other-browser");
    expect(detectPlatform(`${IPHONE_SAFARI} Instagram 350.0`)).toBe("in-app");
    expect(detectPlatform(`${IPHONE_SAFARI} [FBAN/FBIOS;FBAV/480.0]`)).toBe("in-app");
  });

  it("recognises Android and desktop", () => {
    expect(
      detectPlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0 Mobile"),
    ).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0")).toBe("desktop");
  });
});
