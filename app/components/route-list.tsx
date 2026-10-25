import { Button, Checkbox, Disclosure } from "@heroui/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { ART_SIZE, previewPath, type Route } from "~/lib/layouts";

import { SliderControl } from "./slider-control";

export type ListedRoute = {
  /** Stable across refreshes; see listRoutes. */
  id: string;
  /** Names the route for everyone, including screen-reader users, so it must be unique. */
  label: string;
  route: Route;
};

type Props = {
  routes: ListedRoute[];
  hidden: ReadonlySet<string>;
  rotations: Record<string, number>;
  rotatingId: string | null;
  onShow: (id: string, shown: boolean) => void;
  onShowAll: (shown: boolean) => void;
  onRotatingChange: (id: string | null) => void;
  onRotate: (id: string, degrees: number) => void;
  /** False where turning routes means nothing, e.g. on the globe. */
  canRotate?: boolean;
};

/** Every route in the chosen dates: untick one to leave it out, or rotate it. */
export function RouteList({
  routes,
  hidden,
  rotations,
  rotatingId,
  onShow,
  onShowAll,
  onRotatingChange,
  onRotate,
  canRotate = true,
}: Props) {
  const { t } = useTranslation();
  return (
    <Disclosure>
      {/* Level 2: it sits directly under the page title, an h1. */}
      <Disclosure.Heading level={2}>
        <Button slot="trigger" variant="secondary" size="sm">
          {canRotate
            ? t("studio.routes.toggle", { count: routes.length })
            : t("studio.routes.toggleChooseOnly", { count: routes.length })}
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-3 pt-3">
          <p className="text-sm text-muted">{t("studio.routes.help")}</p>
          {/* Always enabled: disabling the button just pressed would drop keyboard focus. */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => onShowAll(true)}
            >
              {t("studio.routes.showAll")}
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => onShowAll(false)}
            >
              {t("studio.routes.hideAll")}
            </Button>
          </div>
          <ul
            aria-label={t("studio.routes.list")}
            className="flex max-h-80 flex-col gap-1 overflow-y-auto"
          >
            {routes.map(({ id, label, route }) => (
              <RouteRow
                key={id}
                id={id}
                label={label}
                route={route}
                shown={!hidden.has(id)}
                rotation={rotations[id] ?? 0}
                rotating={canRotate && rotatingId === id}
                canRotate={canRotate}
                onShow={onShow}
                onRotatingChange={onRotatingChange}
                onRotate={onRotate}
              />
            ))}
          </ul>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

type RowProps = ListedRoute & {
  shown: boolean;
  rotation: number;
  rotating: boolean;
  canRotate: boolean;
  onShow: Props["onShow"];
  onRotatingChange: Props["onRotatingChange"];
  onRotate: Props["onRotate"];
};

// Memoised so turning one route only redraws that row's preview, not every row's.
const RouteRow = memo(function RouteRow({
  id,
  label,
  route,
  shown,
  rotation,
  rotating,
  canRotate,
  onShow,
  onRotatingChange,
  onRotate,
}: RowProps) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-2 rounded-lg px-1 py-1">
      <div className="flex items-center justify-between gap-2">
        <Checkbox isSelected={shown} onChange={(next) => onShow(id, next)}>
          <Checkbox.Content>
            {/* A border keeps unticked boxes visible on light backgrounds. */}
            <Checkbox.Control className="border border-foreground/50">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <svg
              aria-hidden
              viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}
              className="size-8 shrink-0"
            >
              <path
                d={previewPath(route, rotation)}
                fill="none"
                stroke="currentColor"
                strokeWidth={60}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="flex flex-col">
              <span>{label}</span>
              {rotation ? (
                <span className="text-xs text-muted">
                  {t("studio.routes.turned", { degrees: rotation })}
                </span>
              ) : null}
            </span>
          </Checkbox.Content>
        </Checkbox>
        {canRotate && (
          <Button
            size="sm"
            variant={rotating ? "secondary" : "ghost"}
            aria-pressed={rotating}
            aria-label={t("studio.routes.rotateOne", { route: label })}
            onPress={() => onRotatingChange(rotating ? null : id)}
          >
            {t("studio.routes.rotate")}
          </Button>
        )}
      </div>
      {rotating && (
        <div className="flex flex-col items-start gap-2">
          <SliderControl
            label={t("studio.routes.angle", { route: label })}
            value={rotation}
            minValue={0}
            maxValue={359}
            formatOptions={{
              style: "unit",
              unit: "degree",
              unitDisplay: "narrow",
            }}
            onChange={(degrees) => onRotate(id, degrees)}
          />
          {rotation !== 0 && (
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => onRotate(id, 0)}
            >
              {t("studio.routes.turnBack")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
});
