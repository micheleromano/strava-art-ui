import { Button, Checkbox, Disclosure } from "@heroui/react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { ART_SIZE, layoutRoutes, SQUARE, type Route } from "~/lib/layouts";

import { SliderControl } from "./slider-control";

export type ListedRoute = {
  id: number;
  label: string;
  route: Route;
};

type Props = {
  routes: ListedRoute[];
  hidden: ReadonlySet<number>;
  rotations: Record<number, number>;
  rotatingId: number | null;
  onShow: (id: number, shown: boolean) => void;
  onShowAll: (shown: boolean) => void;
  onRotatingChange: (id: number | null) => void;
  onRotate: (id: number, degrees: number) => void;
};

const PREVIEW = {
  layout: "grid",
  frame: SQUARE,
  zoom: 1,
  columns: 1,
  rows: 1,
  spacing: 0.15,
} as const;

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
}: Props) {
  const { t } = useTranslation();
  return (
    <Disclosure>
      {/* Level 2: it sits directly under the page title, an h1. */}
      <Disclosure.Heading level={2}>
        <Button slot="trigger" variant="secondary" size="sm">
          {t("studio.routes.toggle", { count: routes.length })}
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-3 pt-3">
          <p className="text-sm text-muted">{t("studio.routes.help")}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={hidden.size === 0}
              onPress={() => onShowAll(true)}
            >
              {t("studio.routes.showAll")}
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              isDisabled={routes.every(({ id }) => hidden.has(id))}
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
                rotating={rotatingId === id}
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
                d={layoutRoutes([route], PREVIEW, [rotation])[0]}
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
        <Button
          size="sm"
          variant={rotating ? "secondary" : "ghost"}
          aria-pressed={rotating}
          aria-label={t("studio.routes.rotateOne", { route: label })}
          onPress={() => onRotatingChange(rotating ? null : id)}
        >
          {t("studio.routes.rotate")}
        </Button>
      </div>
      {rotating && (
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
      )}
    </li>
  );
});
