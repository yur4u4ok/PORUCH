import { lazy, Suspense, type ComponentProps } from "react";

import { Skeleton } from "./Surface";

// MapLibre is heavy: load it only on screens that show a map (keeps initial load fast).
const MapViewLazy = lazy(() => import("./Map").then((m) => ({ default: m.MapView })));

export function LazyMap(props: ComponentProps<typeof MapViewLazy>) {
  return (
    <Suspense fallback={<Skeleton height={typeof props.height === "number" ? props.height : 320} />}>
      <MapViewLazy {...props} />
    </Suspense>
  );
}
