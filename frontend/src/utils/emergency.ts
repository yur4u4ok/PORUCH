import { region } from "@/utils/format";

/** Emergency numbers by country. The first one is dialled by the "Call" button. Default: 112. */
const NUMBERS: Record<string, string[]> = {
  UA: ["112", "101", "102", "103"],
  US: ["911"],
  CA: ["911"],
  MX: ["911"],
  GB: ["999", "112"],
  IE: ["112", "999"],
  AU: ["000"],
  IN: ["112"],
  JP: ["110", "119"],
  KR: ["112", "119"],
  CN: ["110", "120", "119"],
  BR: ["190", "192", "193"],
  TR: ["112"],
};

/** Interpolation values for emergency texts: {{number}} and {{numbers}}. */
export function emergencyVars(): { number: string; numbers: string } {
  const list = NUMBERS[region().country] ?? ["112"];
  return { number: list[0]!, numbers: list.join(" / ") };
}
