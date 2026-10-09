/**
 * Creating a request when the browser refuses geolocation: the map still opens, a clear hint says
 * what to do, and a pin placed by hand gets the request published.
 */
import { expect, test } from "@playwright/test";

import { newUserContext, registerAndOnboard } from "./helpers";

test("request can be published with a hand-placed pin when location is denied", async ({ browser }) => {
  const run = Date.now();
  const context = await newUserContext(browser);
  const page = await context.newPage();
  await registerAndOnboard(page, "Без геолокації", `nogeo-${run}@e2e.poruch.test`);

  // From now on the browser denies location, like a user who blocked it.
  await context.clearPermissions();
  // (as a string: the e2e TypeScript config has no DOM types)
  await context.addInitScript({
    content: `
      const denied = { code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" };
      navigator.geolocation.getCurrentPosition = (_ok, fail) => fail && fail(denied);
      navigator.geolocation.watchPosition = (_ok, fail) => { if (fail) fail(denied); return 0; };
    `,
  });
  await page.goto("/help/create");

  await page.getByRole("radio", { name: /Дім/ }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByLabel("Коротко").fill(`Без геолокації ${run}`);
  await page.getByLabel("Що сталося?").fill("Геолокацію заборонено, місце позначено вручну.");
  await page.getByRole("button", { name: "Далі" }).click();

  await expect(page.getByText(/Доступ до геолокації вимкнено|Не вдалося визначити ваше місце/)).toBeVisible();
  const pin = page.locator(".maplibregl-marker").first();
  await expect(pin).toBeVisible();
  const box = (await pin.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("📍 Ви знаходитесь тут")).toBeVisible();

  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("radio", { name: /Зараз/ }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("radio", { name: /Без оплати/ }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("button", { name: "Далі" }).click(); // photos are optional
  await page.getByRole("button", { name: "Попросити про допомогу" }).click();
  await expect(page).toHaveURL(/\/help\/[0-9a-f-]{36}$/);
  await expect(page.getByText(`Без геолокації ${run}`)).toBeVisible();
  await context.close();
});
