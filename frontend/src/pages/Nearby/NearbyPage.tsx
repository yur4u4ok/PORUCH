import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";

import { PageHeader } from "@/components/layout/AppLayout";
import { BottomSheet, Button, EmptyState, ErrorState, SkeletonList, Tabs } from "@/components/ui";
import { LazyMap } from "@/components/ui/LazyMap";
import type { MapMarker } from "@/components/ui/Map";
import { useMe } from "@/features/auth/hooks";
import { CategoryChips, HelpRequestCard, RadiusChips } from "@/features/help/components";
import { useHelpRequests } from "@/features/help/hooks";
import { useGeolocation } from "@/features/location/useGeolocation";
import { useSyncNotificationLocation } from "@/features/location/useSyncNotificationLocation";
import { PushToggle } from "@/features/notifications/PushToggle";
import { usePublicConfig } from "@/features/profile/hooks";
import { useNearbyFilters } from "@/stores/nearbyFiltersStore";
import type { LatLng, Urgency } from "@/types/api";
import { cityName } from "@/utils/city";
import { CATEGORY_ORDER, URGENCY_EMOJI, URGENCY_HEX, requestEmoji } from "@/utils/categories";
import { DEFAULT_RADII } from "@/utils/radius";

const ZOOM_BY_RADIUS: Record<number, number> = {
  500: 15,
  1000: 14,
  3000: 13,
  5000: 12,
  10000: 11,
  20000: 10,
};

export default function NearbyPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filters = useNearbyFilters();
  const { data: config } = usePublicConfig();
  const { position: geoPosition, status, locate } = useGeolocation();
  const { data: me } = useMe();
  // Fallback when geolocation is denied: browse around the city centre (approximate, not shared).
  const [manualCenter, setManualCenter] = useState<LatLng | null>(null);
  const position = geoPosition ?? manualCenter;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const view = (params.get("view") as "list" | "map" | null) ?? filters.view;

  useEffect(() => {
    void locate();
  }, [locate]);
  useSyncNotificationLocation(geoPosition);

  const query = useMemo(
    () =>
      position
        ? {
            lat: position.latitude,
            lng: position.longitude,
            radius: filters.radius,
            category: filters.categories,
            urgency: filters.urgencies,
          }
        : null,
    [position, filters.radius, filters.categories, filters.urgencies],
  );
  const nearby = useHelpRequests(query);
  const requests = useMemo(() => nearby.data?.pages.flatMap((p) => p.results) ?? [], [nearby.data]);

  const markers: MapMarker[] = useMemo(
    () =>
      requests.map((r) => ({
        id: r.id,
        position: r.location,
        color: URGENCY_HEX[r.urgency],
        label: requestEmoji(r.category, r.subcategory),
        approximate: r.location.approximate,
        title: r.title,
      })),
    [requests],
  );
  const onMarkerClick = useCallback((id: string) => navigate(`/help/${id}`), [navigate]);

  const setView = (next: "list" | "map") => {
    filters.setView(next);
    const nextParams = new URLSearchParams(params);
    nextParams.set("view", next);
    setParams(nextParams, { replace: true });
  };

  const activeFilters = filters.categories.length + filters.urgencies.length;

  return (
    <main className="page stack">
      <PageHeader
        title={`🔍 ${t("nearby.title")}`}
        back={false}
        actions={
          <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(true)}>
            ⚙️ {t("nearby.filters")}
            {activeFilters > 0 && ` (${activeFilters})`}
          </Button>
        }
      />
      <Tabs
        value={view}
        onChange={setView}
        ariaLabel={t("nearby.title")}
        options={[
          { value: "list", label: `☷ ${t("nearby.list")}` },
          { value: "map", label: `🗺 ${t("nearby.map")}` },
        ]}
      />
      <RadiusChips
        radii={config?.radii ?? DEFAULT_RADII}
        value={filters.radius}
        onChange={filters.setRadius}
      />

      {!position ? (
        status === "locating" || status === "idle" ? (
          <SkeletonList />
        ) : (
          <EmptyState
            icon="📍"
            title={t("nearby.needLocation")}
            action={
              <div className="stack-sm">
                <Button onClick={() => void locate({ force: true })}>{t("nearby.allowLocation")}</Button>
                {me?.city && (
                  <Button variant="secondary" onClick={() => setManualCenter(me.city!.center)}>
                    {t("nearby.useCityCenter", { city: cityName(me.city, i18n.language) })}
                  </Button>
                )}
              </div>
            }
          />
        )
      ) : view === "map" ? (
        <>
          <LazyMap
            center={position}
            zoom={ZOOM_BY_RADIUS[filters.radius] ?? 13}
            height="calc(100vh - 300px)"
            markers={markers}
            me={geoPosition}
            onMarkerClick={onMarkerClick}
            fitMarkers
            ariaLabel={t("nearby.map")}
          />
          {markers.some((m) => m.approximate) && <p className="muted">◌ {t("nearby.approximate")}</p>}
        </>
      ) : nearby.isPending ? (
        <SkeletonList />
      ) : nearby.isError ? (
        <ErrorState onRetry={() => void nearby.refetch()} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon="🌤"
          title={t("nearby.emptyTitle")}
          text={t("nearby.emptyText")}
          action={<PushToggle compact />}
        />
      ) : (
        <div className="stack">
          {requests.map((request) => (
            <HelpRequestCard key={request.id} request={request} />
          ))}
          {nearby.hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => void nearby.fetchNextPage()}
              loading={nearby.isFetchingNextPage}
            >
              {t("nearby.loadMore")}
            </Button>
          )}
        </div>
      )}

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("nearby.filters")}
        actions={
          <>
            <Button variant="ghost" onClick={filters.reset}>
              {t("nearby.all")}
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>{t("common.done")}</Button>
          </>
        }
      >
        <div className="stack-sm">
          <strong>{t("nearby.category")}</strong>
          <CategoryChips
            options={CATEGORY_ORDER}
            selected={filters.categories}
            onToggle={filters.toggleCategory}
          />
        </div>
        <div className="stack-sm">
          <strong>{t("nearby.urgency")}</strong>
          <div className="row wrap">
            {(["NOW", "TODAY", "WHENEVER"] as Urgency[]).map((u) => (
              <Button
                key={u}
                size="sm"
                variant={filters.urgencies.includes(u) ? "primary" : "secondary"}
                onClick={() => filters.toggleUrgency(u)}
                aria-pressed={filters.urgencies.includes(u)}
              >
                {URGENCY_EMOJI[u]} {t(`urgency.${u}`)}
              </Button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </main>
  );
}
