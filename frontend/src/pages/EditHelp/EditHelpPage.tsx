import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";

import { ApiError } from "@/api/client";
import { helpRequestsApi } from "@/api/helpRequests";
import { queryKeys } from "@/api/queryKeys";
import { errorMessage } from "@/app/queryClient";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button, ErrorState, Input, Loader, Textarea } from "@/components/ui";
import { OptionTiles } from "@/features/help/components";
import { useHelpRequest } from "@/features/help/hooks";
import { PhotoUploader } from "@/features/help/PhotoUploader";
import { toast } from "@/stores/toastStore";
import type { HelpRequest, Media, RewardOption, RewardType } from "@/types/api";
import { currencySymbol } from "@/utils/format";
import { REWARD_OPTION_EMOJI, REWARD_OPTIONS, REWARD_TYPE_EMOJI } from "@/utils/reward";

import styles from "../CreateHelp/CreateHelp.module.css";

/**
 * Editing your own active request: what it says, the reward and the photos. Category, place and
 * urgency stay as published (people already responded on that basis) — to change those, cancel
 * and create a new request.
 */
export default function EditHelpPage() {
  const { id = "" } = useParams();
  const request = useHelpRequest(id);
  if (request.isPending) return <Loader />;
  if (request.isError) return <ErrorState onRetry={() => void request.refetch()} />;
  if (!request.data.is_author || request.data.status !== "ACTIVE")
    return <Navigate to={`/help/${id}`} replace />;
  return <EditForm request={request.data} />;
}

function EditForm({ request }: { request: HelpRequest }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.description);
  const [rewardType, setRewardType] = useState<RewardType>(request.reward_type);
  const [amount, setAmount] = useState(request.reward_amount ?? "");
  const [options, setOptions] = useState<RewardOption[]>(request.reward_options);
  const [photos, setPhotos] = useState<Media[]>(request.photos);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("validation.required");
    if (!description.trim()) next.description = t("validation.required");
    if (Object.keys(next).length) return setErrors(next);
    setSaving(true);
    try {
      const updated = await helpRequestsApi.update(request.id, {
        title: title.trim(),
        description: description.trim(),
        reward_type: rewardType,
        reward_amount: rewardType === "WILLING" && amount.trim() ? amount.trim().replace(",", ".") : null,
        reward_options: rewardType === "WILLING" ? options : [],
        photo_ids: photos.map((p) => p.id),
      });
      qc.setQueryData(queryKeys.helpRequest(request.id), updated);
      void qc.invalidateQueries({ queryKey: ["help-requests"] });
      toast.success(t("edit.saved"));
      navigate(`/help/${request.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors();
        if (Object.keys(fields).length) setErrors(fields);
      }
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page stack">
      <PageHeader title={t("edit.title")} />
      <Input
        label={t("create.titleLabel")}
        value={title}
        maxLength={120}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
      />
      <Textarea
        label={t("create.descriptionLabel")}
        value={description}
        maxLength={1000}
        rows={5}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
      />
      <OptionTiles
        value={rewardType}
        onChange={setRewardType}
        options={[
          { value: "NONE", icon: REWARD_TYPE_EMOJI.NONE, label: t("reward.NONE") },
          { value: "WILLING", icon: REWARD_TYPE_EMOJI.WILLING, label: t("reward.WILLING") },
          { value: "UNSURE", icon: REWARD_TYPE_EMOJI.UNSURE, label: t("reward.UNSURE") },
        ]}
      />
      {rewardType === "WILLING" && (
        <fieldset className={styles.rewardBox}>
          <legend className="visually-hidden">{t("reward.WILLING")}</legend>
          <Input
            label={t("reward.amountOptional", { currency: currencySymbol(request.reward_currency) })}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errors.reward_amount}
          />
          <p className="muted">{t("reward.orSomethingElse")}</p>
          <div className={styles.checks}>
            {REWARD_OPTIONS.map((option) => (
              <label key={option} className={styles.check}>
                <input
                  type="checkbox"
                  checked={options.includes(option)}
                  onChange={(e) =>
                    setOptions(e.target.checked ? [...options, option] : options.filter((o) => o !== option))
                  }
                />
                <span aria-hidden>{REWARD_OPTION_EMOJI[option]}</span>
                {t(`reward.options.${option}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <PhotoUploader value={photos} onChange={setPhotos} />
      <p className="muted" style={{ fontSize: 13 }}>
        ℹ️ {t("edit.fixedFields")}
      </p>
      <div className="row-between">
        <Button variant="ghost" onClick={() => navigate(`/help/${request.id}`)}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void save()} loading={saving}>
          {t("edit.save")}
        </Button>
      </div>
    </main>
  );
}
