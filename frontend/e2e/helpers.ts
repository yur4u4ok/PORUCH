import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const MAILPIT = process.env.E2E_MAILPIT_URL || "http://localhost:8025";
export const PASSWORD = "E2e-strong-pass-1";

/** Fixed test location near the default city centre (test data, not app config). */
export const TEST_LOCATION = { latitude: 49.8429, longitude: 24.0316 };

export async function newUserContext(browser: Browser, offsetMeters = 0): Promise<BrowserContext> {
  const context = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: {
      latitude: TEST_LOCATION.latitude + offsetMeters / 111_320,
      longitude: TEST_LOCATION.longitude,
      accuracy: 15,
    },
  });
  // Test browsers are never "installed", so the install dialog would cover the page:
  // behave as if the user pressed «Пізніше».
  await context.addInitScript(() => localStorage.setItem("poruch.installDismissedAt", String(Date.now())));
  return context;
}

async function verificationLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const data = (await res.json()) as { messages: { ID: string }[] };
    const first = data.messages?.[0];
    if (first) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${first.ID}`)).json()) as {
        Text: string;
      };
      const match = message.Text.match(/https?:\/\/\S+\/auth\/verify-email\?token=\S+/);
      if (match) return new URL(match[0]).pathname + new URL(match[0]).search;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`No verification email for ${email}`);
}

export async function registerAndOnboard(page: Page, name: string, email: string) {
  await page.goto("/auth/register");
  await page.getByLabel("Як до вас звертатися").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check(); // «Мені виповнилося 16 років»
  await page.getByRole("button", { name: "Зареєструватися" }).click();
  await expect(page.getByRole("heading", { name: /Підтвердіть email/ })).toBeVisible();

  await page.goto(await verificationLink(email));
  await expect(page.getByText("Email підтверджено!")).toBeVisible();
  await page.getByRole("button", { name: "Продовжити" }).click();

  // Onboarding: location → notifications (skip) → categories
  await expect(page.getByText("Крок 1 з 3")).toBeVisible();
  // The position may already be known (the app reads it when permission was granted earlier).
  const allow = page.getByRole("button", { name: "Дозволити геолокацію" });
  if (await allow.isVisible()) await allow.click();
  await expect(page.getByText("Геолокацію отримано ✓")).toBeVisible();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("button", { name: "Далі" }).click();
  await page.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByRole("link", { name: "Попросити допомогу" })).toBeVisible();
}
