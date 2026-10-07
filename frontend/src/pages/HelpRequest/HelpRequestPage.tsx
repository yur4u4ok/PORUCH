import clsx from "clsx";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError } from "@/api/client";
import { PageHeader } from "@/components/layout/AppLayout";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loader,
  Modal,
  SkeletonList,
  Textarea,
  Input,
} from "@/components/ui";
import { LazyMap } from "@/components/ui/LazyMap";
import { ConfirmDialog, ReportDialog, StatusBadge, UrgencyBadge } from "@/features/help/components";
import {
  useCancelHelpRequest,
  useCompleteHelpRequest,
  useHelpRequest,
  useHelpResponses,
  useRejectResponse,
  useRespondToHelp,
  useSelectHelper,
  useThankHelper,
  useAnswerCounter,
  useCounterOffer,
  useWithdrawResponse,
} from "@/features/help/hooks";
import { ShareButton } from "@/features/help/ShareButton";
import { PersonRow } from "@/features/profile/PersonRow";
import { useBlockUser } from "@/features/profile/hooks";
import { useLocationStore } from "@/stores/locationStore";
import { toast } from "@/stores/toastStore";
import type { HelpRequest, HelpResponse, OfferType } from "@/types/api";
import { URGENCY_EMOJI, URGENCY_HEX, requestEmoji } from "@/utils/categories";
import {
  currencySymbol,
  formatDateTime,
  formatDistance,
  formatMoney,
  timeAgo,
  timeLeft,
} from "@/utils/format";
import { agreedSummary, offerSummary, rewardSummary } from "@/utils/reward";

import styles from "./HelpRequest.module.css";

function ResponsesSection({ request }: { request: HelpRequest }) {
  const { t } = useTranslation();
  const responses = useHelpResponses(request.id, request.is_author && request.status === "ACTIVE");
  const select = useSelectHelper(request.id);
  const reject = useRejectResponse(request.id);
  const navigate = useNavigate();
  if (request.status !== "ACTIVE") return null;
  const pending = responses.data?.filter((r) => r.status === "PENDING") ?? [];
  return (
    <section className="stack-sm">
      <h3>{t("request.responses")}</h3>
      {request.helpers_needed > 1 && (
        <p className="muted">
          👥 {t("request.helpersProgress", { count: request.helpers_count, needed: request.helpers_needed })}
        </p>
      )}
      {responses.isPending ? (
        <SkeletonList count={2} height={72} />
      ) : responses.isError ? (
        <ErrorState onRetry={() => void responses.refetch()} />
      ) : pending.length === 0 ? (
        <Card className="muted">{t("request.noResponses")}</Card>
      ) : (
        pending.map((response) => (
          <Card key={response.id} className={clsx("stack-sm", styles.reply)}>
            <PersonRow user={response.helper} />
            {request.reward_type === "WILLING" && (
              <div
                className={clsx(styles.offerTag, response.offer_type === "COUNTER" && styles.offerCounter)}
              >
                💰 {offerSummary(response, request.reward_currency, t)}
              </div>
            )}
            {response.message && <p>«{response.message}»</p>}
            {response.offer_type === "COUNTER" && <CounterOffer request={request} response={response} />}
            <div className="row">
              <Button
                variant="help"
                onClick={() =>
                  select.mutate(response.id, {
                    onSuccess: (data) => {
                      const updated = data as HelpRequest;
                      if (updated.conversation_id) navigate(`/chats/${updated.conversation_id}`);
                    },
                  })
                }
                loading={select.isPending && select.variables === response.id}
              >
                {t("request.choose")}
              </Button>
              <Button variant="ghost" onClick={() => reject.mutate(response.id)} disabled={reject.isPending}>
                {t("request.reject")}
              </Button>
            </div>
          </Card>
        ))
      )}
    </section>
  );
}

/** Author: answer a helper's different amount with one amount of their own (only once). */
function CounterOffer({ request, response }: { request: HelpRequest; response: HelpResponse }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const counter = useCounterOffer(request.id);
  if (response.author_counter_amount) {
    return (
      <span className="muted">
        ⏳{" "}
        {t("offer.counterSent", {
          amount: formatMoney(response.author_counter_amount, request.reward_currency),
        })}
      </span>
    );
  }
  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        💬 {t("offer.counterButton")}
      </Button>
    );
  }
  const value = amount.trim().replace(",", ".");
  return (
    <div className="stack-sm">
      <Input
        label={t("offer.counterLabel", { currency: currencySymbol(request.reward_currency) })}
        hint={t("offer.counterHint")}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus
      />
      <Button
        size="sm"
        disabled={!(Number(value) > 0)}
        loading={counter.isPending}
        onClick={() => counter.mutate({ responseId: response.id, amount: value })}
      >
        {t("offer.counterSend")}
      </Button>
    </div>
  );
}

/** Helper: the author proposed their amount — accept (and be chosen) or decline. No more bargaining. */
function CounterAnswer({
  request,
  responseId,
  amount,
}: {
  request: HelpRequest;
  responseId: string;
  amount: string;
}) {
  const { t } = useTranslation();
  const answer = useAnswerCounter(request.id);
  const navigate = useNavigate();
  return (
    <Card className="stack-sm">
      <strong>💬 {t("offer.authorCounter", { amount: formatMoney(amount, request.reward_currency) })}</strong>
      <p className="muted" style={{ fontSize: 14 }}>
        {t("offer.lastStep")}
      </p>
      <div className="row">
        <Button
          variant="help"
          loading={answer.isPending && answer.variables?.accept === true}
          onClick={() =>
            answer.mutate(
              { responseId, accept: true },
              { onSuccess: () => toast.success(t("offer.agreedToast")) },
            )
          }
        >
          {t("offer.acceptCounter")}
        </Button>
        <Button
          variant="ghost"
          loading={answer.isPending && answer.variables?.accept === false}
          onClick={() =>
            answer.mutate({ responseId, accept: false }, { onSuccess: () => navigate("/nearby") })
          }
        >
          {t("offer.declineCounter")}
        </Button>
      </div>
    </Card>
  );
}

function ThankYouCard({ request }: { request: HelpRequest }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(t("thanks.placeholder"));
  const thank = useThankHelper(request.id);
  if (!request.selected_helper) return null;
  const names = request.helpers.map((h) => h.user.display_name ?? t("common.anonymous"));
  const name = names.length
    ? names.join(", ")
    : (request.selected_helper.display_name ?? t("common.anonymous"));
  if (request.thanked) return <div className={styles.notice}>❤️ {t("thanks.already")}</div>;
  return (
    <Card className="stack-sm">
      <h3>{t("thanks.received")}</h3>
      <p>{t("thanks.ask", { name })}</p>
      <Button onClick={() => setOpen(true)}>{t("thanks.button")}</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("thanks.button")}
        actions={
          <Button
            loading={thank.isPending}
            onClick={() =>
              thank.mutate(message, {
                onSuccess: () => {
                  toast.success(t("thanks.sent"));
                  setOpen(false);
                },
              })
            }
          >
            {t("thanks.button")}
          </Button>
        }
      >
        <Textarea value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} />
      </Modal>
    </Card>
  );
}

function AuthorActions({ request }: { request: HelpRequest }) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState<"cancel" | "complete" | null>(null);
  const cancel = useCancelHelpRequest(request.id);
  const complete = useCompleteHelpRequest(request.id);
  const open = request.status === "ACTIVE" || request.status === "IN_PROGRESS";
  return (
    <>
      {request.helpers.length > 0 && (
        <Card className="stack-sm">
          <strong>
            {request.helpers.length > 1 ? t("request.selectedHelpers") : t("request.selectedHelper")}
          </strong>
          {request.helpers.map((helper) => (
            <div key={helper.response_id} className="stack-sm">
              <PersonRow user={helper.user} />
              {agreedSummary(request, t, helper) && (
                <span className="muted">
                  🤝 {t("offer.agreed", { terms: agreedSummary(request, t, helper) })}
                </span>
              )}
              {helper.conversation_id && (
                <Link to={`/chats/${helper.conversation_id}`}>
                  <Button variant="help" block>
                    💬 {t("request.openChat")}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </Card>
      )}
      <ResponsesSection request={request} />
      {request.status === "COMPLETED" && <ThankYouCard request={request} />}
      {open && (
        <div className={styles.actions}>
          {request.status === "IN_PROGRESS" && (
            <Button size="lg" variant="help" onClick={() => setConfirm("complete")}>
              ✓ {t("request.complete")}
            </Button>
          )}
          <Button variant="danger" onClick={() => setConfirm("cancel")}>
            {t("request.cancel")}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        title={t("request.cancel")}
        text={t("request.cancelConfirm")}
        confirmLabel={t("request.cancel")}
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === "complete"}
        onClose={() => setConfirm(null)}
        title={t("request.complete")}
        text={t("request.completeConfirm")}
        confirmLabel={t("request.complete")}
        loading={complete.isPending}
        onConfirm={() => complete.mutate(undefined, { onSuccess: () => setConfirm(null) })}
      />
    </>
  );
}

function HelperActions({ request }: { request: HelpRequest }) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState(false);
  const [message, setMessage] = useState("");
  const [offerType, setOfferType] = useState<OfferType>("ACCEPT");
  const [offeredAmount, setOfferedAmount] = useState("");
  const [amountError, setAmountError] = useState<string | undefined>();
  const respond = useRespondToHelp(request.id);
  const withReward = request.reward_type === "WILLING";

  const submitResponse = () => {
    const amount = offeredAmount.trim().replace(",", ".");
    if (withReward && offerType === "COUNTER" && !(Number(amount) > 0)) {
      setAmountError(t("reward.amountRequired"));
      return;
    }
    respond.mutate(
      {
        message,
        offer_type: withReward ? offerType : "ACCEPT",
        offered_amount: withReward && offerType === "COUNTER" ? amount : null,
      },
      {
        onSuccess: () => {
          setSheet(false);
          toast.success(t("request.responseSent"));
        },
      },
    );
  };
  const withdraw = useWithdrawResponse(request.id);
  const mine = request.my_response;

  if (request.status === "COMPLETED" && mine?.status === "ACCEPTED") {
    return <div className={styles.notice}>🎉 {t("thanks.helperCompleted")}</div>;
  }
  if (mine?.status === "REJECTED") return <div className={styles.notice}>{t("request.rejectedNotice")}</div>;
  if (mine?.status === "ACCEPTED" && (request.status === "IN_PROGRESS" || request.status === "ACTIVE")) {
    return (
      <div className={styles.actions}>
        {request.conversation_id && (
          <Link to={`/chats/${request.conversation_id}`}>
            <Button size="lg" variant="help" block>
              💬 {t("request.openChat")}
            </Button>
          </Link>
        )}
        <Button variant="ghost" onClick={() => withdraw.mutate(mine.id)} loading={withdraw.isPending}>
          {t("request.withdraw")}
        </Button>
      </div>
    );
  }
  if (mine?.status === "PENDING" && mine.author_counter_amount) {
    return <CounterAnswer request={request} responseId={mine.id} amount={mine.author_counter_amount} />;
  }
  if (mine?.status === "PENDING") {
    return (
      <div className={styles.actions}>
        <div className={styles.notice}>✓ {t("request.responseSent")}</div>
        <Button variant="ghost" onClick={() => withdraw.mutate(mine.id)} loading={withdraw.isPending}>
          {t("request.withdraw")}
        </Button>
      </div>
    );
  }
  if (request.status === "IN_PROGRESS")
    return <div className={styles.warning}>{t("request.inProgressNotice")}</div>;
  if (request.status !== "ACTIVE") return <div className={styles.warning}>{t("request.closedNotice")}</div>;
  if (!request.can_respond) return null;

  return (
    <>
      <Button size="lg" variant="help" block onClick={() => setSheet(true)}>
        🤝 {t("request.canHelp")}
      </Button>
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title={t("request.canHelp")}
        actions={
          <Button variant="help" block loading={respond.isPending} onClick={submitResponse}>
            {t("request.canHelp")}
          </Button>
        }
      >
        {withReward && (
          <fieldset className={styles.offer}>
            <legend>{t("offer.authorOffers", { terms: rewardSummary(request, t) })}</legend>
            {(["ACCEPT", "COUNTER", "FREE"] as OfferType[]).map((type) => (
              <label key={type} className={styles.offerOption}>
                <input
                  type="radio"
                  name="offer"
                  checked={offerType === type}
                  onChange={() => {
                    setOfferType(type);
                    setAmountError(undefined);
                  }}
                />
                {t(`offer.${type}`)}
              </label>
            ))}
            {offerType === "COUNTER" && (
              <Input
                label={t("offer.amount", { currency: currencySymbol(request.reward_currency) })}
                inputMode="decimal"
                value={offeredAmount}
                onChange={(e) => setOfferedAmount(e.target.value)}
                error={amountError}
                autoFocus
              />
            )}
            <p className="muted" style={{ fontSize: 13 }}>
              {t("offer.note")}
            </p>
          </fieldset>
        )}
        <Textarea
          label={t("request.responseMessage")}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </BottomSheet>
    </>
  );
}

/** Message sent with the link: a few short lines that read well in Telegram/Viber/WhatsApp. */
function shareMessage(request: HelpRequest, t: TFunction): string {
  const when =
    request.urgency === "SCHEDULED" && request.needed_at
      ? formatDateTime(request.needed_at)
      : t(`urgency.${request.urgency}`);
  const details = [
    request.place_name ? `📍 ${request.place_name}` : null,
    `${URGENCY_EMOJI[request.urgency]} ${when}`,
    `🎁 ${rewardSummary(request, t)}`,
  ].filter(Boolean);
  return [
    `🆘 ${t("share.headline")}`,
    `${requestEmoji(request.category, request.subcategory)} ${request.title}`,
    details.join(" · "),
    `🤝 ${t("share.cta")}`,
  ].join("\n");
}

export default function HelpRequestPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const position = useLocationStore((s) => s.position);
  const query = useHelpRequest(id, position);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  // Bumped to rebuild the map on the request's spot after the user has panned away.
  const [mapKey, setMapKey] = useState(0);
  const block = useBlockUser();
  const navigate = useNavigate();

  if (query.isPending) return <Loader />;
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main className="page">
        <PageHeader title="" />
        {notFound ? (
          <EmptyState
            icon="🔍"
            title={t("request.notFound")}
            action={<Link to="/nearby">{t("nearby.title")}</Link>}
          />
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )}
      </main>
    );
  }
  const request = query.data;

  return (
    <main className="page stack">
      <PageHeader title={t(`categories.${request.category}`)} />
      <section className={clsx(styles.details, request.is_author && styles.detailsMine)}>
        <span className={styles.tape} aria-hidden />
        <div className={styles.hero}>
          <span className={styles.emoji} aria-hidden>
            {requestEmoji(request.category, request.subcategory)}
          </span>
          <div className="stack-sm">
            <h1 style={{ fontSize: "var(--text-xl)" }}>{request.title}</h1>
            <div className={styles.meta}>
              <StatusBadge status={request.status} />
              <UrgencyBadge urgency={request.urgency} neededAt={request.needed_at} />
              {request.distance_m != null && (
                <span>📍 {t("common.fromYou", { distance: formatDistance(request.distance_m) })}</span>
              )}
              <span>{t("request.createdAt", { time: timeAgo(request.created_at) })}</span>
              {request.status === "ACTIVE" && (
                <span>⏳ {t("time.expiresIn", { value: timeLeft(request.expires_at) })}</span>
              )}
              {request.is_author && request.responses_count > 0 && (
                <Badge tone="count">{t("request.helpers", { count: request.responses_count })}</Badge>
              )}
            </div>
          </div>
        </div>

        <p className={styles.description}>{request.description}</p>

        {request.reward_type !== "NONE" && (
          <p>
            <strong>{t("request.rewardInfo")}:</strong>{" "}
            {request.reward_type === "WILLING"
              ? rewardSummary(request, t)
              : t(`reward.${request.reward_type}`)}
          </p>
        )}
        {!request.is_author &&
          request.my_response?.status === "ACCEPTED" &&
          agreedSummary(request, t, request.my_response) && (
            <div className={styles.notice}>
              🤝 {t("offer.agreed", { terms: agreedSummary(request, t, request.my_response) })}
            </div>
          )}

        {request.photos.length > 0 && (
          <div className={styles.photos}>
            {request.photos.map((photo) => (
              <a key={photo.id} href={photo.url ?? "#"} target="_blank" rel="noreferrer">
                <img src={photo.thumbnail_url ?? ""} alt={t("request.photos")} loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="stack-sm">
        <LazyMap
          key={mapKey}
          center={request.location}
          zoom={request.location.approximate ? 14 : 16}
          height={200}
          markers={[
            {
              id: request.id,
              position: request.location,
              color: URGENCY_HEX[request.urgency],
              label: requestEmoji(request.category, request.subcategory),
              approximate: request.location.approximate,
              title: request.title,
            },
          ]}
          me={position}
          ariaLabel={request.location.approximate ? t("request.approxLocation") : t("request.exactLocation")}
        />
        <div className={styles.mapFooter}>
          <button
            type="button"
            className={styles.recenter}
            title={t("request.showOnMap")}
            onClick={() => setMapKey((k) => k + 1)}
          >
            {request.location.approximate
              ? `◌ ${t("request.approxLocation")}`
              : `📍 ${t("request.exactLocation")}`}
          </button>
          {!request.location.approximate && (
            // Universal Maps URL: opens the Maps app on Android/iPhone, the website elsewhere
            // (geo: links only worked on some Android phones).
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${request.location.latitude},${request.location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("request.openInMaps")}
            </a>
          )}
        </div>
      </section>

      {!request.is_author && (
        <Card className="stack-sm">
          <strong>{t("request.author")}</strong>
          <PersonRow user={request.author} />
        </Card>
      )}

      {request.is_author ? <AuthorActions request={request} /> : <HelperActions request={request} />}

      {request.share_url && <ShareButton url={request.share_url} text={shareMessage(request, t)} />}

      {!request.is_author && (
        <div className={styles.secondaryActions}>
          <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
            🚩 {t("request.report")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setBlockOpen(true)}>
            ⛔ {t("request.block")}
          </Button>
        </div>
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{ help_request_id: request.id }}
      />
      <ConfirmDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title={t("request.block")}
        text={t("request.blockConfirm")}
        confirmLabel={t("request.block")}
        danger
        loading={block.isPending}
        onConfirm={() =>
          block.mutate(request.author.id, {
            onSuccess: () => {
              toast.success(t("request.blocked"));
              navigate("/nearby", { replace: true });
            },
          })
        }
      />
    </main>
  );
}
