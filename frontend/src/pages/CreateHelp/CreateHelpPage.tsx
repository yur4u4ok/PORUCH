import clsx from "clsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useBlocker, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { usersApi } from "@/api/users";
import { errorMessage } from "@/app/queryClient";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button, Card, InfoTip, Input, Select, Textarea } from "@/components/ui";
import { Stepper } from "@/components/ui/Stepper";
import { LazyMap } from "@/components/ui/LazyMap";
import { useMe } from "@/features/auth/hooks";
import { ConfirmDialog, EmergencyDisclaimer, OptionTiles, UrgencyBadge } from "@/features/help/components";
import { createHelpSchema, STEP_FIELDS, type CreateHelpForm } from "@/features/help/createSchema";
import { useCreateHelpRequest } from "@/features/help/hooks";
import { PhotoUploader } from "@/features/help/PhotoUploader";
import { ScheduleInput } from "@/features/help/ScheduleInput";
import { fallbackCenter as approximateCenter, placeNameFor, usePlace } from "@/features/location/place";
import { RoughLocationHint } from "@/features/location/RoughLocationHint";
import { useGeolocation } from "@/features/location/useGeolocation";
import { usePublicConfig } from "@/features/profile/hooks";
import { useOnline } from "@/hooks/useOnline";
import { useFieldError } from "@/hooks/useFieldError";
import { toast } from "@/stores/toastStore";
import type { Category, Media, Urgency } from "@/types/api";
import { CATEGORY_EMOJI, CATEGORY_ORDER, URGENCIES, URGENCY_HEX } from "@/utils/categories";
import { currencySymbol, region } from "@/utils/format";
import { REWARD_OPTION_EMOJI, REWARD_OPTIONS, REWARD_TYPE_EMOJI, rewardSummary } from "@/utils/reward";

import styles from "./CreateHelp.module.css";

/** "YYYY-MM-DDTHH:mm" in local time (the form value of needed_at). */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Choices for how long a request stays open, and the default per urgency. */
const ACTIVE_HOURS = [1, 2, 3, 6, 12, 24, 48, 72, 168];
const DEFAULT_ACTIVE_HOURS: Record<Exclude<Urgency, "SCHEDULED">, number> = {
  NOW: 6,
  TODAY: 24,
  WHENEVER: 72,
};

const STEP_TITLES = [
  "create.stepDetails",
  "create.stepLocation",
  "create.stepUrgency",
  "create.stepReward",
  "create.stepPhotos",
  "create.stepConfirm",
];

export default function CreateHelpPage() {
  const { t, i18n } = useTranslation();
  const { currency } = region();
  const fe = useFieldError();
  // Allowed range for "at a specific time" (the server checks the same: 15 min … 30 days ahead).
  const [scheduleBounds] = useState(() => ({
    min: toLocalInput(new Date(Date.now() + 15 * 60_000)),
    max: toLocalInput(new Date(Date.now() + 30 * 24 * 3600_000)),
  }));
  const navigate = useNavigate();
  // ?category=AUTO from the home screen's tear-off tabs preselects the category.
  const [searchParams] = useSearchParams();
  const presetCategory = CATEGORY_ORDER.find((c) => c === searchParams.get("category") && c !== "URGENT");
  const online = useOnline();
  const { data: me } = useMe();
  const { data: config } = usePublicConfig();
  const { position, status: geoStatus, locate } = useGeolocation();
  const create = useCreateHelpRequest();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const { control, register, handleSubmit, setValue, trigger, formState, setError } = useForm<CreateHelpForm>(
    {
      resolver: zodResolver(createHelpSchema),
      defaultValues: {
        category: presetCategory,
        subcategory: null,
        title: "",
        description: "",
        location: null,
        urgency: "NOW",
        needed_at: "",
        helpers_needed: 1,
        active_hours: DEFAULT_ACTIVE_HOURS.NOW,
        reward_type: "NONE",
        reward_amount: "",
        reward_options: [],
        emergency_acknowledged: false,
      },
      mode: "onTouched",
    },
  );

  // Leaving with something filled in asks first, so a stray tap doesn't throw the draft away.
  const hasDraft = formState.isDirty || photos.length > 0;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasDraft &&
      // going to the request just published is not leaving
      !(nextLocation.state as { published?: boolean } | null)?.published &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!hasDraft || create.isSuccess) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDraft, create.isSuccess]);

  // All fields have defaults, so the watched form is complete at runtime.
  const values = useWatch({ control }) as CreateHelpForm;
  const subcategories = values.category ? (config?.subcategories[values.category] ?? []) : [];

  // Location: ask once when reaching the location step; user may drag the marker.
  useEffect(() => {
    if (step !== 1 || values.location) return;
    void locate({ force: true }).then((pos) => {
      if (pos) setValue("location", pos, { shouldValidate: true });
    });
  }, [step, values.location, locate, setValue]);

  const place = usePlace();
  const fallbackCenter = position ?? approximateCenter(place, me?.city?.center);
  // No GPS and no known city (location denied, Google sign-up without a city): the map still opens
  // on a rough guess — the IP-based city, else the default city from the server — and the pin stays
  // unset until the person drags it, so a guess is never published as the place.
  const cities = useQuery({
    queryKey: queryKeys.cities,
    queryFn: usersApi.cities,
    staleTime: Infinity,
    enabled: step === 1 && !fallbackCenter,
  });
  const roughCenter =
    place?.center ?? (cities.data?.find((c) => c.is_default) ?? cities.data?.[0])?.center ?? null;
  const mapCenter = fallbackCenter ?? roughCenter;
  const manual = !position && geoStatus !== "locating" && geoStatus !== "idle";

  // Explicit action with visible feedback: moves the pin (and the map) to a fresh GPS fix.
  const useMyLocation = async () => {
    const pos = await locate({ force: true });
    if (pos) {
      setValue("location", { ...pos }, { shouldValidate: true });
      toast.success(t("create.locationUpdated"));
    } else {
      toast.error(t("create.locationDenied"));
    }
  };

  const selectCategory = (category: Category) => {
    setValue("category", category, { shouldValidate: true });
    setValue("subcategory", null);
    if (category === "URGENT") {
      setValue("urgency", "NOW");
      if (!values.emergency_acknowledged) setDisclaimerOpen(true);
    }
  };

  const selectSubcategory = (code: string) => {
    const next = code || null;
    setValue("subcategory", next);
    if (next && !values.title) setValue("title", t(`subcategories.${next}`));
  };

  const next = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    if (fields.length && !(await trigger(fields))) return;
    if (step === 0 && values.category === "URGENT" && !values.emergency_acknowledged) {
      setDisclaimerOpen(true);
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_TITLES.length - 1));
  };

  const onSubmit = handleSubmit(async (form) => {
    if (!online) {
      toast.error(t("create.offline"));
      return;
    }
    const placeName = (await placeNameFor(i18n.language, form.location!)) || place?.name || "";
    create.mutate(
      {
        category: form.category,
        subcategory: form.subcategory,
        title: form.title || undefined,
        description: form.description,
        location: form.location!,
        urgency: form.urgency,
        // datetime-local is the user's local time; send an absolute instant.
        needed_at:
          form.urgency === "SCHEDULED" && form.needed_at ? new Date(form.needed_at).toISOString() : null,
        helpers_needed: form.helpers_needed,
        active_hours: form.urgency === "SCHEDULED" ? null : form.active_hours,
        reward_type: form.reward_type,
        reward_amount:
          form.reward_type === "WILLING" && form.reward_amount ? form.reward_amount.replace(",", ".") : null,
        reward_options: form.reward_type === "WILLING" ? form.reward_options : [],
        reward_currency: currency,
        place_name: placeName,
        photo_ids: photos.map((p) => p.id),
        emergency_acknowledged: form.emergency_acknowledged,
      },
      {
        onSuccess: (created) => {
          toast.success(t("create.success"));
          navigate(`/help/${created.id}`, { replace: true, state: { published: true } });
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            const fieldErrors = error.fieldErrors();
            const map: Record<string, number> = {
              category: 0,
              description: 0,
              title: 0,
              location: 1,
              latitude: 1,
              reward_amount: 3,
              needed_at: 2,
            };
            const first = Object.keys(fieldErrors).find((k) => k in map);
            Object.entries(fieldErrors).forEach(([k, msg]) => {
              if (k in map) setError(k as keyof CreateHelpForm, { message: msg });
            });
            if (first) setStep(map[first]!);
            else toast.error(errorMessage(error));
          } else toast.error(errorMessage(error));
        },
      },
    );
  });

  const isLast = step === STEP_TITLES.length - 1;

  return (
    <main className="page stack">
      <PageHeader title={t("create.title")} />
      {/* One segment per step: done ones filled, the current one highlighted. */}
      <ol
        className={styles.progress}
        aria-label={t("onboarding.step", { current: step + 1, total: STEP_TITLES.length })}
      >
        {STEP_TITLES.map((key, i) => (
          <li
            key={key}
            className={clsx(styles.segment, i < step && styles.segmentDone, i === step && styles.segmentNow)}
            aria-current={i === step ? "step" : undefined}
          />
        ))}
      </ol>
      <h2 className={styles.stepTitle}>{t(STEP_TITLES[step]!)}</h2>

      {!online && <div className={styles.warning}>📡 {t("create.offline")}</div>}

      {step === 0 && (
        <div className="stack">
          <Select
            label={t("create.categoryLabel")}
            value={values.category ?? ""}
            onChange={(e) => selectCategory(e.target.value as Category)}
            error={fe(formState.errors.category?.message)}
          >
            <option value="" disabled>
              {t("create.categoryPlaceholder")}
            </option>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_EMOJI[c]} {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
          {subcategories.length > 0 && (
            <Select
              label={t("create.subcategoryLabel")}
              value={values.subcategory ?? ""}
              onChange={(e) => selectSubcategory(e.target.value)}
            >
              <option value="">—</option>
              {subcategories.map((code) => (
                <option key={code} value={code}>
                  {t(`subcategories.${code}`)}
                </option>
              ))}
            </Select>
          )}
          <Input
            label={t("create.titleLabel")}
            placeholder={
              values.category
                ? t(`create.titlePlaceholders.${values.category}`, {
                    defaultValue: t("create.titlePlaceholder"),
                  })
                : t("create.titlePlaceholder")
            }
            maxLength={120}
            {...register("title")}
            error={fe(formState.errors.title?.message)}
          />
          <Textarea
            label={t("create.descriptionLabel")}
            placeholder={t("create.descriptionPlaceholder")}
            maxLength={1000}
            rows={6}
            showCounter
            valueLength={values.description.length}
            {...register("description")}
            error={fe(formState.errors.description?.message)}
          />
          <Controller
            control={control}
            name="helpers_needed"
            render={({ field }) => (
              <Stepper
                label={t("create.helpersNeeded")}
                hint={t("create.helpersNeededHint")}
                value={field.value}
                min={1}
                max={10}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          {manual && (
            <p role="status" className={styles.manualHint}>
              📍 {t(geoStatus === "denied" ? "create.locationManualDenied" : "create.locationManual")}
            </p>
          )}
          {mapCenter ? (
            <LazyMap
              center={values.location ?? mapCenter}
              me={position}
              meAccuracy={position?.accuracy}
              zoom={fallbackCenter ? 15 : 12}
              height={340}
              picker={values.location ?? mapCenter}
              onPickerChange={(pos) =>
                setValue("location", { ...pos, accuracy: null }, { shouldValidate: true })
              }
              ariaLabel={t("create.youAreHere")}
            />
          ) : (
            <Card>{t("create.locating")}</Card>
          )}
          {/* once the person placed the pin themselves, the device's rough fix no longer matters */}
          <RoughLocationHint
            position={
              values.location &&
              (values.location.latitude !== position?.latitude ||
                values.location.longitude !== position?.longitude)
                ? null
                : position
            }
            canDrag
          />
          {(geoStatus === "locating" || !values.location) && (
            <p className="muted">
              {geoStatus === "locating" ? t("create.locating") : t("create.locationPickPrompt")}
            </p>
          )}
          <p className="muted" style={{ fontSize: 13 }}>
            🔒 {t("create.locationPrivacy")}
          </p>
          <Button variant="secondary" loading={geoStatus === "locating"} onClick={useMyLocation}>
            🎯 {t("create.useMyLocation")}
          </Button>
          {!values.location && fallbackCenter && (
            <Button
              variant="ghost"
              onClick={() =>
                setValue("location", { ...fallbackCenter, accuracy: null }, { shouldValidate: true })
              }
            >
              {t("common.confirm")}
            </Button>
          )}
          {formState.errors.location && (
            <p role="alert" style={{ color: "var(--color-danger)" }}>
              {fe(formState.errors.location.message)}
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <Controller
            control={control}
            name="urgency"
            render={({ field }) => (
              <OptionTiles
                value={field.value}
                onChange={(u) => {
                  field.onChange(u);
                  if (u !== "SCHEDULED") setValue("active_hours", DEFAULT_ACTIVE_HOURS[u]);
                }}
                options={URGENCIES.filter((u) => values.category !== "URGENT" || u === "NOW").map((u) => ({
                  value: u,
                  accent: URGENCY_HEX[u],
                  label: t(`urgency.${u}`),
                }))}
              />
            )}
          />
          {values.urgency !== "SCHEDULED" && (
            <Controller
              control={control}
              name="active_hours"
              render={({ field }) => (
                <Select
                  label={
                    <span className="row" style={{ gap: 6, display: "inline-flex" }}>
                      {t("create.activeHours")}
                      <InfoTip text={t("create.activeHoursHint")} />
                    </span>
                  }
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  {ACTIVE_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h < 24 || h % 24 ? t("time.hours", { count: h }) : t("time.days", { count: h / 24 })}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
          {values.urgency === "SCHEDULED" && (
            <Controller
              control={control}
              name="needed_at"
              render={({ field }) => (
                <ScheduleInput
                  value={field.value}
                  onChange={field.onChange}
                  minDate={scheduleBounds.min.slice(0, 10)}
                  maxDate={scheduleBounds.max.slice(0, 10)}
                  label={t("create.neededAtLabel")}
                  hint={t("create.neededAtHint")}
                  error={fe(formState.errors.needed_at?.message)}
                />
              )}
            />
          )}
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <Controller
            control={control}
            name="reward_type"
            render={({ field }) => (
              <OptionTiles
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "NONE", icon: REWARD_TYPE_EMOJI.NONE, label: t("reward.NONE") },
                  { value: "WILLING", icon: REWARD_TYPE_EMOJI.WILLING, label: t("reward.WILLING") },
                  { value: "UNSURE", icon: REWARD_TYPE_EMOJI.UNSURE, label: t("reward.UNSURE") },
                ]}
              />
            )}
          />
          {values.reward_type === "WILLING" && (
            <fieldset className={styles.rewardBox}>
              <legend className="visually-hidden">{t("reward.WILLING")}</legend>
              <Input
                label={t("reward.amountOptional", { currency: currencySymbol(currency) })}
                inputMode="decimal"
                {...register("reward_amount")}
              />
              <p className="muted">{t("reward.orSomethingElse")}</p>
              <Controller
                control={control}
                name="reward_options"
                render={({ field }) => (
                  <div className={styles.checks}>
                    {REWARD_OPTIONS.map((option) => (
                      <label key={option} className={styles.check}>
                        <input
                          type="checkbox"
                          checked={field.value.includes(option)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, option]
                                : field.value.filter((o: string) => o !== option),
                            )
                          }
                        />
                        <span aria-hidden>{REWARD_OPTION_EMOJI[option]}</span>
                        {t(`reward.options.${option}`)}
                      </label>
                    ))}
                  </div>
                )}
              />
              {formState.errors.reward_amount && (
                <p role="alert" className={styles.error}>
                  {fe(formState.errors.reward_amount.message)}
                </p>
              )}
            </fieldset>
          )}
          <p className="muted">{t("reward.note")}</p>
        </div>
      )}

      {step === 4 && <PhotoUploader value={photos} onChange={setPhotos} />}

      {step === 5 && values.category && (
        <Card>
          <dl className={styles.summary}>
            <dt>{t("nearby.category")}</dt>
            <dd>
              {CATEGORY_EMOJI[values.category]} {t(`categories.${values.category}`)}
              {values.subcategory && ` · ${t(`subcategories.${values.subcategory}`)}`}
            </dd>
            {values.title && (
              <>
                <dt>{t("create.titleLabel")}</dt>
                <dd>{values.title}</dd>
              </>
            )}
            <dt>{t("create.descriptionLabel")}</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{values.description}</dd>
            <dt>{t("nearby.urgency")}</dt>
            <dd>
              <UrgencyBadge
                urgency={values.urgency}
                neededAt={values.needed_at ? new Date(values.needed_at).toISOString() : null}
              />
            </dd>
            <dt>{t("request.rewardInfo")}</dt>
            <dd>
              {values.reward_type === "WILLING"
                ? `${t("reward.WILLING")}: ${rewardSummary(
                    {
                      reward_type: "WILLING",
                      reward_amount: values.reward_amount.replace(",", ".") || null,
                      reward_currency: currency,
                      reward_options: values.reward_options,
                    },
                    t,
                  )}`
                : t(`reward.${values.reward_type}`)}
            </dd>
            {photos.length > 0 && (
              <>
                <dt>{t("request.photos")}</dt>
                <dd>{photos.length}</dd>
              </>
            )}
          </dl>
        </Card>
      )}

      <div className={styles.footer}>
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            {t("common.back")}
          </Button>
        )}
        {isLast ? (
          <Button size="lg" onClick={onSubmit} loading={create.isPending} disabled={!online}>
            {create.isPending ? t("create.submitting") : t("create.submit")}
          </Button>
        ) : (
          <Button size="lg" onClick={next}>
            {t("common.next")}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title={t("create.leaveTitle")}
        text={t("create.leaveText")}
        confirmLabel={t("create.leaveConfirm")}
        danger
      />
      <EmergencyDisclaimer
        open={disclaimerOpen}
        onClose={() => setDisclaimerOpen(false)}
        onAccept={() => {
          setValue("emergency_acknowledged", true);
          setDisclaimerOpen(false);
        }}
      />
    </main>
  );
}
