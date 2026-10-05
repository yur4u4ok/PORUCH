/**
 * Main acceptance flow (spec §125 / §149):
 * register → create request → another user sees it → responds → author accepts →
 * chat → complete → thank you → helper reputation increases.
 */
import { expect, test } from "@playwright/test";

import { newUserContext, registerAndOnboard } from "./helpers";

test("help request end-to-end flow", async ({ browser }) => {
  const run = Date.now();
  const authorEmail = `author-${run}@e2e.poruch.test`;
  const helperEmail = `helper-${run}@e2e.poruch.test`;
  const title = `Пробите колесо ${run}`;

  const authorContext = await newUserContext(browser);
  const helperContext = await newUserContext(browser, 600);
  const author = await authorContext.newPage();
  const helper = await helperContext.newPage();

  // 1-2. Register both users (email verification through Mailpit)
  await registerAndOnboard(author, "Автор", authorEmail);
  await registerAndOnboard(helper, "Помічник", helperEmail);

  // 3. Author creates a request through the wizard
  await author.getByRole("link", { name: /^Потрібна допомога/ }).click();
  await author.getByRole("radio", { name: /Автомобіль/ }).click();
  await author.getByRole("button", { name: "Пробите колесо" }).click();
  await author.getByRole("button", { name: "Далі" }).click();
  await author.getByLabel("Коротко").fill(title);
  await author.getByLabel("Що сталося?").fill("Пробив колесо біля парку, потрібен домкрат.");
  await author.getByRole("button", { name: "Далі" }).click();
  await expect(author.getByText("📍 Ви знаходитесь тут")).toBeVisible();
  await author.getByRole("button", { name: "Далі" }).click();
  await author.getByRole("radio", { name: /Зараз/ }).click();
  await author.getByRole("button", { name: "Далі" }).click();
  await author.getByRole("radio", { name: /Без оплати/ }).click();
  await author.getByRole("button", { name: "Далі" }).click();
  await author.getByRole("button", { name: "Далі" }).click(); // photos are optional
  await author.getByRole("button", { name: "Попросити про допомогу" }).click();
  await expect(author.getByRole("heading", { name: title })).toBeVisible();
  await expect(author.getByText("Поки що ніхто не відгукнувся")).toBeVisible();

  // 4. Helper sees it nearby (approximate distance) and responds
  await helper.goto("/nearby");
  await helper.getByText(title).click();
  await expect(helper.getByText(/Приблизне місце/)).toBeVisible();
  await helper.getByRole("button", { name: /Можу допомогти/ }).click();
  await helper.getByLabel("Повідомлення автору (необов'язково)").fill("Маю домкрат, буду за 10 хв");
  await helper.getByRole("dialog").getByRole("button", { name: "Можу допомогти" }).click();
  await expect(
    helper.getByText("Ви запропонували допомогу. Автор отримає сповіщення.").first(),
  ).toBeVisible();
  // Exact location is now available to the helper
  await expect(helper.getByText("📍 Точне місце")).toBeVisible();

  // 5. Author sees the response and chooses the helper → chat opens
  await author.reload();
  await expect(author.getByText("«Маю домкрат, буду за 10 хв»")).toBeVisible();
  await author.getByRole("button", { name: "Обрати" }).click();
  await expect(author).toHaveURL(/\/chats\//);
  await expect(author.getByText("Помічника обрано")).toBeVisible();

  // 6. Realtime chat in both directions
  await helper.reload();
  await helper.getByRole("button", { name: /Відкрити чат/ }).click();
  await expect(helper.getByText("Помічника обрано")).toBeVisible();
  await author.getByLabel("Повідомлення…").fill("Я біля входу в парк");
  await author.getByRole("button", { name: "Надіслати" }).click();
  await expect(helper.getByText("Я біля входу в парк")).toBeVisible(); // via WebSocket
  await helper.getByLabel("Повідомлення…").fill("Бачу вас, підходжу");
  await helper.keyboard.press("Enter");
  await expect(author.getByText("Бачу вас, підходжу")).toBeVisible();

  // 7. Author completes the request
  await author.getByRole("link").filter({ hasText: "📄" }).click();
  await author.getByRole("button", { name: /Завершити/ }).click();
  await author.getByRole("dialog").getByRole("button", { name: "Завершити" }).click();
  await expect(author.getByText("Допомогу отримано ❤️")).toBeVisible();

  // 8. Thank you
  await author.getByRole("button", { name: "❤️ Подякувати" }).click();
  await author.getByRole("dialog").getByRole("button", { name: "❤️ Подякувати" }).click();
  await expect(author.getByText("Ви вже подякували")).toBeVisible();

  // 9. Helper's reputation increased
  await helper.goto("/profile");
  await expect(helper.getByText("🤝 Допоміг: 1")).toBeVisible();
  await expect(helper.getByText("❤️ Отримав подяк: 1")).toBeVisible();

  await authorContext.close();
  await helperContext.close();
});
