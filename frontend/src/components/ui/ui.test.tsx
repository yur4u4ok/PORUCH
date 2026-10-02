import { render, screen } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { Modal } from "./Overlay";
import { EmptyState, ErrorState, Tabs } from "./Surface";

describe("UI components", () => {
  it("Button shows loading and is disabled", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("ErrorState retries", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("EmptyState renders texts", () => {
    render(<EmptyState title="Поруч зараз немає запитів." text="Але це не означає…" />);
    expect(screen.getByText("Поруч зараз немає запитів.")).toBeInTheDocument();
  });

  it("Tabs switch value", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="list"
        onChange={onChange}
        options={[
          { value: "list", label: "Список" },
          { value: "map", label: "Карта" },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Список" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Карта" }));
    expect(onChange).toHaveBeenCalledWith("map");
  });

  it("Modal keeps focus in its input while typing (inline onClose)", async () => {
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <Modal open onClose={() => undefined} title="Сума">
          <input aria-label="amount" value={value} onChange={(e) => setValue(e.target.value)} />
        </Modal>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText("amount");
    await userEvent.click(input);
    await userEvent.type(input, "400");
    expect(input).toHaveValue("400");
    expect(input).toHaveFocus();
  });

  it("Modal closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Увага">
        text
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Увага" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
