import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, renderWithProviders } from "@/test/utils";

import { LoginPage, RegisterPage } from "./AuthPages";

describe("auth pages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("login shows inline validation errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ google_client_id: "" })));
    renderWithProviders(<LoginPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Увійти" }));
    expect(await screen.findAllByText("Обов'язкове поле")).toHaveLength(2);
  });

  it("login maps invalid credentials to the password field", async () => {
    document.cookie = "csrftoken=t";
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("/auth/login/")
          ? jsonResponse({ code: "INVALID_CREDENTIALS", message: "bad", details: {} }, 400)
          : jsonResponse({ google_client_id: "" }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Увійти" }));
    expect(await screen.findByText("Невірний email або пароль")).toBeInTheDocument();
  });

  it("register validates password length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ google_client_id: "" })));
    renderWithProviders(<RegisterPage />);
    await userEvent.type(await screen.findByLabelText("Як до вас звертатися"), "Остап");
    await userEvent.type(screen.getByLabelText("Email"), "o@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Зареєструватися" }));
    expect(await screen.findByText("Мінімум 8 символів")).toBeInTheDocument();
  });
});
