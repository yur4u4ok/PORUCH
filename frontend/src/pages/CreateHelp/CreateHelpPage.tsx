import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ApiError } from "@/api/client";
import { errorMessage } from "@/app/queryClient";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button, Card, Chip, Input, Textarea } from "@/components/ui";
import { LazyMap } from "@/components/ui/LazyMap";
import { useMe } from "@/features/auth/hooks";
import { CategoryGrid, EmergencyDisclaimer, OptionTiles, UrgencyBadge } from "@/features/help/components";
import { createHelpSchema, STEP_FIELDS, type CreateHelpForm } from "@/features/help/createSchema";
import { useCreateHelpRequest } from "@/features/help/hooks";
import { PhotoUploader } from "@/features/help/PhotoUploader";
import { useGeolocation } from "@/features/location/useGeolocation";
import { usePublicConfig } from "@/features/profile/hooks";
import { useOnline } from "@/hooks/useOnline";
import { useFieldError } from "@/hooks/useFieldError";
import { toast } from "@/stores/toastStore";
import type { Category, Media } from "@/types/api";
import { CATEGORY_EMOJI, URGENCY_EMOJI } from "@/utils/categories";

import styles from "./CreateHelp.module.css";

const STEP_TITLES = [
  "create.stepCategory",
  "create.stepDetails",
  "create.stepLocation",
  "create.stepUrgency",
  "create.stepReward",
  "create.stepPhotos",
  "create.stepConfirm",
];

export default function CreateHelpPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const navigate = useNavigate();
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
        category: undefined,
        subcategory: null,
        title: "",
        description: "",
        location: null,
        urgency: "NOW",
        reward_type: "NONE",
        reward_amount: "",
        emergency_acknowledged: false,
      },
      mode: "onTouched",
    },
  );

  // All fields have defaults, so the watched form is complete at runtime.
  const values = useWatch({ control }) as CreateHelpForm;
  const subcategories = values.category ? (config?.subcategories[values.category] ?? []) : [];

  // Location: ask once when reaching the location step; user may drag the marker.
  useEffect(() => {
    if (step !== 2 || values.location) return;
    void locate({ force: true }).then((pos) => {
      if (pos) setValue("location", pos, { shouldValidate: true });
    });
  }, [step, values.location, locate, setValue]);

  const fallbackCenter = position ?? me?.city?.center ?? null;

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
    const next = values.subcategory === code ? null : code;
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

  const onSubmit = handleSubmit((form) => {
    if (!online) {
      toast.error(t("create.offline"));
      return;
    }
    create.mutate(
      {
        category: form.category,
        subcategory: form.subcategory,
        title: form.title || undefined,
        description: form.description,
        location: form.location!,
        urgency: form.urgency,
        reward_type: form.reward_type,
        reward_amount:
          form.reward_type === "WILLING" && form.reward_amount ? form.reward_amount.replace(",", ".") : null,
        photo_ids: photos.map((p) => p.id),
        emergency_acknowledged: form.emergency_acknowledged,
      },
      {
        onSuccess: (created) => {
          toast.success(t("create.success"));
          navigate(`/help/${created.id}`, { replace: true });
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            const fieldErrors = error.fieldErrors();
            const map: Record<string, number> = {
              category: 0,
              description: 1,
              title: 1,
              location: 2,
              latitude: 2,
              reward_amount: 4,
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
      <div className={styles.progress} aria-hidden>
        <div
          className={styles.progressBar}
          style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
        />
      </div>
      <h2>{t(STEP_TITLES[step]!)}</h2>

      {!online && <div className={styles.warning}>📡 {t("create.offline")}</div>}

      {step === 0 && (
        <div className="stack">
          <CategoryGrid value={values.category ?? null} onChange={selectCategory} />
          {formState.errors.category && (
            <p role="alert" style={{ color: "var(--color-danger)" }}>
              {fe(formState.errors.category.message)}
            </p>
          )}
          {subcategories.length > 0 && (
            <div className="stack-sm">
              <p className="muted">{t("create.chooseSubcategory")}</p>
              <div className="row wrap">
                {subcategories.map((code) => (
                  <Chip
                    key={code}
                    active={values.subcategory === code}
                    onClick={() => selectSubcategory(code)}
                  >
                    {t(`subcategories.${code}`)}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {values.category === "URGENT" && <div className={styles.warning}>🚨 {t("emergency.short")}</div>}
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          <Input
            label={t("create.titleLabel")}
            placeholder={t("create.titlePlaceholder")}
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
            autoFocus
          />
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          {fallbackCenter ? (
            <LazyMap
              center={values.location ?? fallbackCenter}
              me={position}
              zoom={15}
              height={340}
              picker={values.location ?? fallbackCenter}
              onPickerChange={(pos) =>
                setValue("location", { ...pos, accuracy: null }, { shouldValidate: true })
              }
              ariaLabel={t("create.youAreHere")}
            />
          ) : (
            <Card>{t("create.locating")}</Card>
          )}
          <p className="muted">
            {geoStatus === "locating"
              ? t("create.locating")
              : values.location
                ? t("create.youAreHere")
                : t("create.locationError")}
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            🔒 {t("create.locationPrivacy")} · {t("create.locationHint")}
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

      {step === 3 && (
        <Controller
          control={control}
          name="urgency"
          render={({ field }) => (
            <OptionTiles
              value={field.value}
              onChange={field.onChange}
              options={(["NOW", "TODAY", "WHENEVER"] as const)
                .filter((u) => values.category !== "URGENT" || u === "NOW")
                .map((u) => ({ value: u, icon: URGENCY_EMOJI[u], label: t(`urgency.${u}`) }))}
            />
          )}
        />
      )}

      {step === 4 && (
        <div className="stack">
          <Controller
            control={control}
            name="reward_type"
            render={({ field }) => (
              <OptionTiles
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "NONE", icon: "❤️", label: t("reward.NONE") },
                  { value: "WILLING", icon: "💰", label: t("reward.WILLING") },
                  { value: "UNSURE", icon: "☕", label: t("reward.UNSURE") },
                ]}
              />
            )}
          />
          {values.reward_type === "WILLING" && (
            <Input
              label={`${t("reward.amount")} *`}
              required
              inputMode="decimal"
              {...register("reward_amount")}
              error={fe(formState.errors.reward_amount?.message)}
            />
          )}
          <p className="muted">{t("reward.note")}</p>
        </div>
      )}

      {step === 5 && <PhotoUploader value={photos} onChange={setPhotos} />}

      {step === 6 && values.category && (
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
              <UrgencyBadge urgency={values.urgency} />
            </dd>
            <dt>{t("request.rewardInfo")}</dt>
            <dd>
              {values.reward_type === "WILLING" && values.reward_amount
                ? t("reward.willingWithAmount", { amount: values.reward_amount })
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
