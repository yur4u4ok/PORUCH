import { useTranslation } from "react-i18next";

import { Select } from "@/components/ui";
import { currentLocale } from "@/i18n";
import { COUNTRIES, CURRENCIES, resolveRegion, useRegionStore, type Units } from "@/i18n/region";
import { formatDate, formatDistance, formatMoney, formatTime } from "@/utils/format";

const AUTO = "";

function displayNames(type: "region" | "currency"): (code: string) => string {
  try {
    const names = new Intl.DisplayNames([currentLocale()], { type });
    return (code) => names.of(code) ?? code;
  } catch {
    return (code) => code;
  }
}

/** Country, currency and distance units. Each defaults to "automatic" (from the detected location). */
export function RegionSettings() {
  const { t } = useTranslation();
  const state = useRegionStore();
  // What "automatic" would pick for each field, given the other choices.
  const autoCountry = resolveRegion(currentLocale(), { ...state, country: null }).country;
  const auto = resolveRegion(currentLocale(), { ...state, currency: null, units: null });
  const effective = resolveRegion(currentLocale(), state);
  const country = displayNames("region");
  const currency = displayNames("currency");
  const sortedCountries = [...COUNTRIES].sort((a, b) => country(a).localeCompare(country(b)));
  const sample = new Date();
  sample.setHours(13, 30, 0, 0);

  return (
    <div className="stack-sm">
      <p className="muted" style={{ fontSize: 14 }}>
        {t("settings.regionHint")}
      </p>
      <Select
        label={t("settings.country")}
        value={state.country ?? AUTO}
        onChange={(e) => state.setCountry(e.target.value || null)}
      >
        <option value={AUTO}>{t("settings.auto", { value: country(autoCountry) })}</option>
        {sortedCountries.map((code) => (
          <option key={code} value={code}>
            {country(code)}
          </option>
        ))}
      </Select>
      <Select
        label={t("settings.currency")}
        value={state.currency ?? AUTO}
        onChange={(e) => state.setCurrency(e.target.value || null)}
      >
        <option value={AUTO}>{t("settings.auto", { value: currency(auto.currency) })}</option>
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code} — {currency(code)}
          </option>
        ))}
      </Select>
      <Select
        label={t("settings.units")}
        value={state.units ?? AUTO}
        onChange={(e) => state.setUnits((e.target.value || null) as Units | null)}
      >
        <option value={AUTO}>
          {t("settings.auto", {
            value: t(auto.units === "imperial" ? "settings.unitsImperial" : "settings.unitsMetric"),
          })}
        </option>
        <option value="metric">{t("settings.unitsMetric")}</option>
        <option value="imperial">{t("settings.unitsImperial")}</option>
      </Select>
      <p style={{ fontSize: 14 }}>
        <span className="muted">{t("settings.example")}:</span>{" "}
        <strong>
          {[
            formatMoney(500, effective.currency),
            formatDistance(1200),
            formatDate(sample),
            formatTime(sample),
          ].join("  ·  ")}
        </strong>
      </p>
    </div>
  );
}
