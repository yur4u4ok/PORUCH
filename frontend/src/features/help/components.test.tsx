import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/utils";
import type { HelpRequest } from "@/types/api";

import { EmergencyDisclaimer, HelpRequestCard } from "./components";

const request = {
  id: "r1",
  category: "AUTO",
  subcategory: "FLAT_TIRE",
  title: "Пробите колесо",
  description: "Потрібен домкрат",
  urgency: "NOW",
  reward_type: "NONE",
  place_name: "",
  reward_amount: null,
  reward_currency: "UAH",
  reward_options: [],
  agreed_offer_type: null,
  agreed_amount: null,
  status: "ACTIVE",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  completed_at: null,
  author: {} as HelpRequest["author"],
  photos: [],
  distance_m: 1300,
  location: { latitude: 49.84, longitude: 24.03, approximate: true },
  is_author: false,
  my_response: null,
  responses_count: 0,
  selected_helper: null,
  conversation_id: null,
  can_respond: true,
  thanked: null,
  share_url: null,
} satisfies HelpRequest;

describe("help components", () => {
  it("card shows approximate distance, urgency and links to detail", async () => {
    renderWithProviders(<HelpRequestCard request={request} />);
    expect(await screen.findByText("Пробите колесо")).toBeInTheDocument();
    expect(screen.getByText(/1,3 км від вас/)).toBeInTheDocument();
    expect(screen.getByText(/Зараз/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/help/r1");
  });

  it("emergency disclaimer must be acknowledged", async () => {
    const onAccept = vi.fn();
    renderWithProviders(<EmergencyDisclaimer open onAccept={onAccept} onClose={() => undefined} />);
    expect(await screen.findByText(/не замінює екстрені служби/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Зрозуміло" }));
    expect(onAccept).toHaveBeenCalled();
  });
});
