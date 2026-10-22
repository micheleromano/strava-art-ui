import {
  Alert,
  Button,
  buttonVariants,
  parseColor,
  Spinner,
  Switch,
} from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Form,
  isRouteErrorResponse,
  Link,
  redirect,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "react-router";

import { ColourControl } from "~/components/colour-control";
import { DateRangeControl } from "~/components/date-range-control";
import { LayoutPicker } from "~/components/layout-picker";
import { PalettePicker } from "~/components/palette-picker";
import { RouteArt } from "~/components/route-art";
import { SliderControl } from "~/components/slider-control";
import { contrastRatio, MIN_GRAPHIC_CONTRAST } from "~/lib/contrast";
import { inRange, rangeFromParams, type DayRange } from "~/lib/date-range";
import { downloadPng, downloadSvg } from "~/lib/download";
import {
  loadActivities,
  refreshActivities,
  type LoadFailure,
} from "~/lib/load-activities";
import {
  decodeRoutes,
  LAYOUTS,
  layoutRoutes,
  type Layout,
} from "~/lib/layouts";
import { PALETTES } from "~/lib/palettes";
import { shadeRamp } from "~/lib/shades";
import { sampleActivities } from "~/lib/sample.server";
import { sessionFrom } from "~/lib/session.server";
import i18n from "~/i18n";

import type { Route } from "./+types/studio";

const PNG_SIZE = 2048;
// The same trim the sample data gets, applied to people's own routes when they ask for it.
const TRIM_METRES = 500;
const MAX_GRID = 10;
const DEFAULT_GRID = 4;

export function meta() {
  return [{ title: `${i18n.t("studio.title")} · ${i18n.t("app.name")}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await sessionFrom(request);
  const connected = session.has("tokens");
  const wantsSample =
    new URL(request.url).searchParams.get("source") === "sample";
  if (connected && !wantsSample) {
    return { connected, source: "strava" as const, sample: null };
  }
  if (sampleActivities.length === 0) throw redirect("/");
  return { connected, source: "sample" as const, sample: sampleActivities };
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  const server = await serverLoader();
  const activities = await loadActivities(server);
  return { connected: server.connected, source: server.source, activities };
}
clientLoader.hydrate = true as const;

// "Get latest activities": saves a fresh copy, which the revalidating clientLoader then reads.
export async function clientAction() {
  return { refreshFailure: await refreshActivities() };
}

// Changing the dates only filters what's already loaded, so it doesn't need to reload anything.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return defaultShouldRevalidate;
  return (
    currentUrl.pathname !== nextUrl.pathname ||
    currentUrl.searchParams.get("source") !== nextUrl.searchParams.get("source")
  );
}

export function HydrateFallback() {
  const { t } = useTranslation();
  return (
    <main className="container mx-auto p-4 py-12">
      <div role="status" className="flex items-center gap-3">
        <Spinner />
        <p>{t("studio.loading")}</p>
      </div>
    </main>
  );
}

export default function Studio({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { t } = useTranslation();
  const { activities, connected, source } = loaderData;
  const navigation = useNavigation();
  const refreshing = navigation.state !== "idle" && navigation.formData != null;
  const [pngState, setPngState] = useState<"idle" | "pending" | "failed">(
    "idle",
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [background, setBackground] = useState(
    parseColor(PALETTES[0].background),
  );
  const [line, setLine] = useState(parseColor(PALETTES[0].line));
  const [shades, setShades] = useState(true);
  const [hideEnds, setHideEnds] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [spacing, setSpacing] = useState(0.15);
  const svgRef = useRef<SVGSVGElement>(null);

  // What's drawn lives in the URL, so a link brings back the same picture; the look stays on the page.
  const timeZone = getLocalTimeZone();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = rangeFromParams(from, to, timeZone, activities);
  const layout = layoutFrom(searchParams.get("layout"));
  const columns = gridSizeFrom(searchParams.get("columns"));
  const rows = gridSizeFrom(searchParams.get("rows"));

  // Decoding routes is the slow part, so it only reruns when the activities or dates change.
  const { routes, skipped } = useMemo(() => {
    const shown = inRange(
      activities,
      rangeFromParams(from, to, timeZone, activities),
      timeZone,
    ).sort((a, b) => b.startDate.localeCompare(a.startDate));
    // The sample is already trimmed; people's own routes are trimmed here if they choose.
    const routes = decodeRoutes(
      shown.map((activity) => activity.polyline),
      source === "strava" && hideEnds ? TRIM_METRES : 0,
    );
    return { routes, skipped: shown.length - routes.length };
  }, [activities, from, to, timeZone, source, hideEnds]);

  const paths = useMemo(
    () => layoutRoutes(routes, { layout, zoom, columns, rows, spacing }),
    [routes, layout, zoom, columns, rows, spacing],
  );

  // Lowercase to match the palettes; Color writes hex in uppercase.
  const backgroundHex = background.toString("hex").toLowerCase();
  const lineHex = line.toString("hex").toLowerCase();
  const colours = shades
    ? shadeRamp(lineHex, paths.length)
    : paths.map(() => lineHex);
  // With shades on, the lightest and darkest shades are the ones most likely to blend in.
  const lowContrast = (shades ? [lineHex, ...shadeRamp(lineHex, 2)] : [lineHex])
    .map((colour) => contrastRatio(backgroundHex, colour))
    .some((ratio) => ratio < MIN_GRAPHIC_CONTRAST);

  const setParams = (values: Record<string, string>) =>
    setSearchParams(
      (params) => {
        for (const [name, value] of Object.entries(values)) {
          params.set(name, value);
        }
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  const changeRange = (next: DayRange) =>
    setParams({ from: next.start.toString(), to: next.end.toString() });

  const savePng = async (svg: SVGSVGElement) => {
    setPngState("pending");
    try {
      await downloadPng(svg, "strava-art.png", PNG_SIZE);
      setPngState("idle");
    } catch {
      setPngState("failed");
    }
  };

  return (
    <main className="container mx-auto flex flex-col gap-6 p-4 py-8">
      <nav className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/" className={buttonVariants({ variant: "ghost" })}>
          {t("studio.home")}
        </Link>
        {connected && (
          <Form method="post" action="/disconnect">
            <Button type="submit" variant="secondary" size="sm">
              {t("studio.disconnect")}
            </Button>
          </Form>
        )}
      </nav>

      <h1 className="text-3xl font-semibold">{t("studio.title")}</h1>

      {source === "sample" && (
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("studio.sample.title")}</Alert.Title>
            <Alert.Description>{t("studio.sample.body")}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="flex flex-col gap-6">
          <LayoutPicker
            value={layout}
            onChange={(next) => setParams({ layout: next })}
          />

          {source === "strava" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                {t(`studio.privacy.${layout}`)}
              </p>
              <Switch isSelected={hideEnds} onChange={setHideEnds}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  {t("studio.hideEnds")}
                </Switch.Content>
              </Switch>
            </div>
          )}

          {layout === "grid" ? (
            <div className="flex flex-col gap-4">
              <SliderControl
                label={t("studio.columns")}
                value={columns}
                minValue={1}
                maxValue={MAX_GRID}
                onChange={(value) => setParams({ columns: String(value) })}
              />
              <SliderControl
                label={t("studio.rows")}
                value={rows}
                minValue={1}
                maxValue={MAX_GRID}
                onChange={(value) => setParams({ rows: String(value) })}
              />
              <SliderControl
                label={t("studio.spacing")}
                value={spacing}
                minValue={0}
                maxValue={0.6}
                step={0.05}
                formatOptions={{ style: "percent" }}
                onChange={setSpacing}
              />
            </div>
          ) : (
            <SliderControl
              label={t("studio.zoom")}
              value={zoom}
              minValue={0.5}
              maxValue={4}
              step={0.1}
              formatOptions={{ style: "percent" }}
              onChange={setZoom}
            />
          )}
          <SliderControl
            label={t("studio.thickness")}
            value={strokeWidth}
            minValue={0.5}
            maxValue={8}
            step={0.5}
            onChange={setStrokeWidth}
          />

          <DateRangeControl
            label={t("studio.dates")}
            value={range}
            maxValue={today(timeZone)}
            onChange={changeRange}
          />

          <PalettePicker
            background={backgroundHex}
            line={lineHex}
            onChange={(palette) => {
              setBackground(parseColor(palette.background));
              setLine(parseColor(palette.line));
            }}
          />
          <div className="flex flex-col gap-3">
            <ColourControl
              label={t("studio.background")}
              value={background}
              onChange={setBackground}
            />
            <ColourControl
              label={t("studio.line")}
              value={line}
              onChange={setLine}
            />
            <Switch isSelected={shades} onChange={setShades}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                {t("studio.shades")}
              </Switch.Content>
            </Switch>
            {shades && (
              <p className="text-sm text-muted">{t("studio.shadesHelp")}</p>
            )}
          </div>

          {lowContrast && (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t("studio.lowContrast")}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <div aria-live="polite" className="flex flex-col gap-1 text-sm">
            <p>
              {paths.length < routes.length
                ? t("studio.gridShown", {
                    count: paths.length,
                    total: routes.length,
                  })
                : t("studio.shown", { count: paths.length })}
            </p>
            {skipped > 0 && (
              <p className="text-muted">
                {t("studio.skipped", { count: skipped })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              isDisabled={paths.length === 0}
              isPending={pngState === "pending"}
              onPress={() => svgRef.current && savePng(svgRef.current)}
            >
              {t("studio.downloadPng")}
            </Button>
            <Button
              variant="secondary"
              isDisabled={paths.length === 0}
              onPress={() =>
                svgRef.current && downloadSvg(svgRef.current, "strava-art.svg")
              }
            >
              {t("studio.downloadSvg")}
            </Button>
          </div>

          {pngState === "failed" && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t("studio.pngFailed")}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {source === "strava" && (
            <Form method="post" className="flex flex-col items-start gap-2">
              <Button
                type="submit"
                variant="tertiary"
                size="sm"
                isPending={refreshing}
              >
                {t("studio.refresh")}
              </Button>
              {actionData?.refreshFailure && !refreshing && (
                <Alert status="warning">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {failureMessage(t, actionData.refreshFailure)}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
            </Form>
          )}
        </section>

        <section className="max-w-3xl">
          {paths.length === 0 ? (
            <p className="rounded-lg border border-border p-8 text-center text-muted">
              {emptyMessage(t, {
                activities: activities.length,
                routes: routes.length,
                skipped,
              })}
            </p>
          ) : (
            <RouteArt
              ref={svgRef}
              paths={paths}
              colours={colours}
              background={backgroundHex}
              strokeWidth={strokeWidth}
              label={t(`studio.artLabel.${layout}`, { count: paths.length })}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function emptyMessage(
  t: TFunction,
  counts: {
    activities: number;
    routes: number;
    skipped: number;
  },
): string {
  if (counts.activities === 0) return t("studio.noActivities");
  if (counts.routes === 0 && counts.skipped > 0) return t("studio.noMaps");
  return t("studio.empty");
}

function layoutFrom(value: string | null): Layout {
  return LAYOUTS.find((layout) => layout === value) ?? "start";
}

function gridSizeFrom(value: string | null): number {
  const size = Number(value);
  return Number.isInteger(size) && size >= 1 && size <= MAX_GRID
    ? size
    : DEFAULT_GRID;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const failure: LoadFailure | null = isRouteErrorResponse(error)
    ? error.data
    : null;
  return (
    <main className="container mx-auto flex flex-col gap-4 p-4 py-12">
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t("studio.errors.title")}</Alert.Title>
          <Alert.Description>
            {failure ? failureMessage(t, failure) : t("studio.errors.failed")}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      <div className="flex gap-2">
        <Button
          onPress={() => revalidator.revalidate()}
          isPending={revalidator.state === "loading"}
        >
          {t("studio.errors.retry")}
        </Button>
        <Link to="/" className={buttonVariants({ variant: "secondary" })}>
          {t("errors.home")}
        </Link>
      </div>
    </main>
  );
}

function failureMessage(t: TFunction, failure: LoadFailure): string {
  if (failure.status !== 429) return t("studio.errors.failed");
  return failure.retryAfterMinutes
    ? t("studio.errors.busy", { count: failure.retryAfterMinutes })
    : t("studio.errors.busyLater");
}
