import {
  Alert,
  Button,
  buttonVariants,
  parseColor,
  Checkbox,
  Spinner,
  Switch,
} from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { GlobeArt } from "~/components/globe-art";
import { RouteArt } from "~/components/route-art";
import { RouteList } from "~/components/route-list";
import { SliderControl } from "~/components/slider-control";
import { contrastRatio, MIN_GRAPHIC_CONTRAST } from "~/lib/contrast";
import { inRange, rangeFromParams, type DayRange } from "~/lib/date-range";
import {
  canSharePng,
  downloadPng,
  downloadSvg,
  makePng,
  screenPngSize,
  sharePng,
  globePng,
} from "~/lib/download";
import { listRoutes } from "~/lib/listed-routes";
import { platformFrom, type Platform } from "~/lib/platform";
import {
  loadActivities,
  refreshActivities,
  type LoadFailure,
} from "~/lib/load-activities";
import {
  frameFor,
  ART_LAYOUTS,
  layoutRoutes,
  SQUARE,
  type ArtLayout,
} from "~/lib/layouts";
import { defaultTilt } from "~/lib/globe";
import { PALETTES } from "~/lib/palettes";
import { countPlaces, placeOf } from "~/lib/places";
import { shadeRamp } from "~/lib/shades";
import { sampleActivities } from "~/lib/sample.server";
import { sessionFrom } from "~/lib/session.server";
import i18n from "~/i18n";

import type { Route } from "./+types/studio";

// Square downloads are this many pixels across; screen-shaped ones match the screen's pixels.
const SQUARE_PNG_SIZE = 2048;
const PNG_FILENAME = "route-art.png";
// The same trim the sample data gets, applied to people's own routes when they ask for it.
const TRIM_METRES = 500;

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
  const [exported, setExported] = useState<ExportState | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [background, setBackground] = useState(
    parseColor(PALETTES[0].background),
  );
  const [line, setLine] = useState(parseColor(PALETTES[0].line));
  const [shades, setShades] = useState(true);
  const [hideEnds, setHideEnds] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [strokeWidth, setStrokeWidth] = useState(2);
  // Keyed by each route's stable id, so they stay with the right route after a refresh.
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [matchScreen, setMatchScreen] = useState(false);
  // This page only renders in the browser (see clientLoader), so the screen is known.
  const { width: screenWidth, height: screenHeight } = window.screen;
  const pixelRatio = window.devicePixelRatio;
  const canShare = useMemo(() => canSharePng(), []);
  const platform = platformFrom(navigator.userAgent, navigator.maxTouchPoints);
  const frame = useMemo(
    () => (matchScreen ? frameFor(screenWidth, screenHeight) : SQUARE),
    [matchScreen, screenWidth, screenHeight],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const globeRef = useRef<HTMLCanvasElement | null>(null);
  const [transparent, setTransparent] = useState(true);
  // Starts toward the busiest place the first time there are places, then stays put.
  const [tilt, setTilt] = useState<number | null>(null);

  // What's drawn lives in the URL, so a link brings back the same picture; the look stays on the page.
  const timeZone = getLocalTimeZone();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = rangeFromParams(from, to, timeZone, activities);
  // The globe needs places: people's own routes have real ones, and the sample has
  // rounded ones if the owner's sample file includes them.
  const globeAvailable =
    source === "strava" || activities.some((activity) => activity.place);
  const layout = layoutFrom(searchParams.get("layout"), globeAvailable);

  // Decoding routes is the slow part, so it only reruns when the activities or dates change.
  const { drawable, skipped } = useMemo(() => {
    const inDates = inRange(
      activities,
      rangeFromParams(from, to, timeZone, activities),
      timeZone,
    );
    const dateFormat = new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone,
    });
    // The sample is already trimmed; people's own routes are trimmed here if they choose.
    const { routes, skipped } = listRoutes(
      inDates,
      source === "strava" && hideEnds ? TRIM_METRES : 0,
      (startDate) => dateFormat.format(new Date(startDate)),
    );
    const drawable = routes.map(({ id, date, sameDay, route, place }) => ({
      id,
      route,
      place,
      label:
        sameDay.count > 1
          ? i18n.t("studio.routes.sameDay", { date, ...sameDay })
          : date,
    }));
    return { drawable, skipped };
  }, [activities, from, to, timeZone, source, hideEnds]);
  const included = useMemo(
    () => drawable.filter(({ id }) => !hidden.has(id)),
    [drawable, hidden],
  );

  const paths = useMemo(
    () =>
      layout === "globe"
        ? []
        : layoutRoutes(
            included.map(({ route }) => route),
            { layout, frame, zoom },
            included.map(({ id }) => rotations[id] ?? 0),
          ),
    [included, layout, frame, zoom, rotations],
  );
  // Rounded to about 25 km before they reach the globe; exact points never do.
  const places = useMemo(
    () =>
      layout === "globe"
        ? countPlaces(
            included.flatMap(({ route, place }) => {
              // The sample stores rounded places; people's own routes are rounded here.
              const location = place ?? placeOf(route);
              return location ? [location] : [];
            }),
          )
        : [],
    [included, layout],
  );
  const drawnCount = layout === "globe" ? places.length : paths.length;
  // Set during render, once, rather than in an effect (React's "adjusting state" pattern).
  if (tilt === null && places.length > 0) setTilt(defaultTilt(places));
  const shownTilt = tilt ?? defaultTilt(places);

  // Stable callbacks, so the route list only redraws the row that changed.
  const showRoute = useCallback(
    (id: string, shown: boolean) =>
      setHidden((current) => {
        const next = new Set(current);
        if (shown) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const showAllRoutes = useCallback(
    (shown: boolean) =>
      setHidden((current) =>
        shown
          ? new Set()
          : new Set([...current, ...drawable.map(({ id }) => id)]),
      ),
    [drawable],
  );
  const rotateRoute = useCallback(
    (id: string, degrees: number) =>
      setRotations((current) => ({ ...current, [id]: degrees })),
    [],
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

  // A new object whenever anything that's drawn changes, so a finished PNG (and the
  // message about it) only counts for the picture it was made from.
  const picture = useMemo(
    () => ({
      paths,
      places,
      backgroundHex,
      lineHex,
      shades,
      strokeWidth,
      frame,
      transparent,
      tilt: shownTilt,
    }),
    [
      paths,
      places,
      backgroundHex,
      lineHex,
      shades,
      strokeWidth,
      frame,
      transparent,
      shownTilt,
    ],
  );
  const current = exported?.picture === picture ? exported : null;
  const making = current?.status === "making";
  const pngSize = matchScreen
    ? screenPngSize(screenWidth, screenHeight, pixelRatio)
    : { width: SQUARE_PNG_SIZE, height: SQUARE_PNG_SIZE };

  const makeCurrentPng = (): Promise<Blob> => {
    if (layout === "globe") {
      if (!globeRef.current) throw new Error("The globe isn't drawn yet");
      return globePng(globeRef.current, transparent ? null : backgroundHex);
    }
    if (!svgRef.current) throw new Error("The picture isn't drawn yet");
    return makePng(svgRef.current, pngSize.width, pngSize.height);
  };

  const exportPng = async (how: ExportState["how"]) => {
    // Reuse a PNG made on an earlier tap: phones only open the share menu right after a tap.
    let png = current?.png;
    setExported({ status: "making", how, picture, png });
    if (!png) {
      try {
        png = await makeCurrentPng();
      } catch {
        setExported({ status: "failed", how, picture });
        return;
      }
    }
    if (how === "download") {
      downloadPng(png, PNG_FILENAME);
      setExported({ status: "downloaded", how, picture, png });
      return;
    }
    try {
      const shared = await sharePng(png, PNG_FILENAME);
      // Closing the share menu without choosing anything isn't an error.
      setExported({
        status: shared ? "shared" : "cancelled",
        how,
        picture,
        png,
      });
    } catch (error) {
      const tooSlow =
        error instanceof DOMException && error.name === "NotAllowedError";
      setExported({
        status: tooSlow ? "shareReady" : "shareFailed",
        how,
        picture,
        png,
      });
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
            unavailable={globeAvailable ? [] : ["globe"]}
            unavailableReason={t("studio.globe.sampleUnavailable")}
          />

          {layout !== "globe" && (
            <div className="flex flex-col gap-1">
              <Checkbox
                isSelected={matchScreen}
                onChange={setMatchScreen}
                aria-describedby="screen-size"
              >
                <Checkbox.Content>
                  {/* A border keeps the unticked box visible on light backgrounds. */}
                  <Checkbox.Control className="border border-foreground/50">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {t("studio.matchScreen")}
                </Checkbox.Content>
              </Checkbox>
              <p id="screen-size" className="text-sm text-muted">
                {t("studio.matchScreenSize", {
                  ...screenPngSize(screenWidth, screenHeight, pixelRatio),
                })}
              </p>
            </div>
          )}

          {source === "strava" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                {t(`studio.privacy.${layout}`)}
              </p>
              {layout !== "globe" && (
                <Switch isSelected={hideEnds} onChange={setHideEnds}>
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    {t("studio.hideEnds")}
                  </Switch.Content>
                </Switch>
              )}
            </div>
          )}

          {layout === "globe" && (
            <div className="flex flex-col gap-1">
              <SliderControl
                label={t("studio.globe.tilt")}
                value={shownTilt}
                minValue={-90}
                maxValue={90}
                formatOptions={{
                  style: "unit",
                  unit: "degree",
                  unitDisplay: "narrow",
                }}
                onChange={setTilt}
              />
              <p className="text-sm text-muted">{t("studio.globe.tiltHelp")}</p>
            </div>
          )}

          {layout !== "globe" && (
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
          {layout !== "globe" && (
            <SliderControl
              label={t("studio.thickness")}
              value={strokeWidth}
              minValue={1}
              maxValue={10}
              onChange={setStrokeWidth}
            />
          )}

          <DateRangeControl
            label={t("studio.dates")}
            value={range}
            maxValue={today(timeZone)}
            onChange={changeRange}
          />

          {drawable.length > 0 && (
            <RouteList
              routes={drawable}
              hidden={hidden}
              rotations={rotations}
              rotatingId={rotatingId}
              onShow={showRoute}
              onShowAll={showAllRoutes}
              onRotatingChange={setRotatingId}
              onRotate={rotateRoute}
              canRotate={layout !== "globe"}
            />
          )}

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
            {layout !== "globe" && (
              <>
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
              </>
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
              {layout === "globe"
                ? t("studio.globe.shown", {
                    count: places.length,
                    routes: included.length,
                  })
                : t("studio.shown", { count: paths.length })}
            </p>
            {drawable.length > included.length && (
              <p className="text-muted">
                {t("studio.hiddenCount", {
                  count: drawable.length - included.length,
                })}
              </p>
            )}
            {skipped > 0 && (
              <p className="text-muted">
                {t("studio.skipped", { count: skipped })}
              </p>
            )}
          </div>

          {layout === "globe" && (
            <Checkbox isSelected={transparent} onChange={setTransparent}>
              <Checkbox.Content>
                {/* A border keeps the unticked box visible on light backgrounds. */}
                <Checkbox.Control className="border border-foreground/50">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {t("studio.globe.transparent")}
              </Checkbox.Content>
            </Checkbox>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              isDisabled={drawnCount === 0 || making}
              isPending={making && current?.how === "download"}
              onPress={() => exportPng("download")}
            >
              {t("studio.downloadPng")}
            </Button>
            {canShare && (
              <Button
                variant="secondary"
                isDisabled={drawnCount === 0 || making}
                isPending={making && current?.how === "share"}
                onPress={() => exportPng("share")}
              >
                {t("studio.sharePng")}
              </Button>
            )}
            {layout !== "globe" && (
              <Button
                variant="secondary"
                isDisabled={paths.length === 0}
                onPress={() =>
                  svgRef.current && downloadSvg(svgRef.current, "route-art.svg")
                }
              >
                {t("studio.downloadSvg")}
              </Button>
            )}
          </div>

          {canShare && source === "strava" && (
            <p className="text-sm text-muted">
              {layout === "globe"
                ? t("studio.globe.shareNote")
                : t("studio.shareNote")}
            </p>
          )}

          {/* Always present, so screen readers announce each result as it appears. */}
          <div role="status" className="flex flex-col gap-2">
            {making && (
              <span className="sr-only">{t("studio.exported.making")}</span>
            )}
            {current && (
              <ExportMessage
                status={current.status}
                platform={platform}
                // The globe is always square, but it isn't meant as a wallpaper.
                square={!matchScreen && layout !== "globe"}
              />
            )}
          </div>

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
          {drawnCount === 0 ? (
            <p className="rounded-lg border border-border p-8 text-center text-muted">
              {emptyMessage(t, {
                activities: activities.length,
                routes: drawable.length,
                included: included.length,
                skipped,
              })}
            </p>
          ) : layout === "globe" ? (
            <GlobeArt
              canvasRef={globeRef}
              places={places}
              background={backgroundHex}
              dot={lineHex}
              showBackground={!transparent}
              tilt={shownTilt}
              label={t("studio.artLabel.globe", {
                count: places.length,
                routes: included.length,
              })}
            />
          ) : (
            <RouteArt
              ref={svgRef}
              paths={paths}
              frame={frame}
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

type ExportState = {
  status:
    | "making"
    | "downloaded"
    | "shared"
    | "cancelled"
    | "shareReady"
    | "failed"
    | "shareFailed";
  how: "download" | "share";
  /** The picture this PNG was made from; see `picture` in Studio. */
  picture: object;
  png?: Blob;
};

function ExportMessage({
  status,
  platform,
  square,
}: {
  status: ExportState["status"];
  platform: Platform;
  square: boolean;
}) {
  const { t } = useTranslation();
  if (status === "making" || status === "cancelled") return null;
  if (status === "failed" || status === "shareFailed") {
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            {status === "failed"
              ? t("studio.pngFailed")
              : t("studio.shareFailed")}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  if (status === "shareReady") {
    return (
      <Alert>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            {t("studio.exported.shareReady")}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }
  // After sharing, only phones get steps: elsewhere it may have gone to a chat or AirDrop.
  const steps =
    status === "downloaded"
      ? t(`studio.wallpaper.${platform}`)
      : platform === "ios" || platform === "android"
        ? t(`studio.wallpaper.shared.${platform}`)
        : null;
  return (
    <Alert status="accent">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {status === "downloaded"
            ? t("studio.exported.downloaded")
            : t("studio.exported.shared")}
        </Alert.Title>
        {steps && (
          <Alert.Description>
            {steps} {square && t("studio.wallpaper.squareHint")}
          </Alert.Description>
        )}
      </Alert.Content>
    </Alert>
  );
}

function emptyMessage(
  t: TFunction,
  counts: {
    activities: number;
    routes: number;
    included: number;
    skipped: number;
  },
): string {
  if (counts.activities === 0) return t("studio.noActivities");
  if (counts.routes > 0 && counts.included === 0) return t("studio.allHidden");
  if (counts.routes === 0 && counts.skipped > 0) return t("studio.noMaps");
  return t("studio.empty");
}

function layoutFrom(value: string | null, globeAvailable: boolean): ArtLayout {
  const layout = ART_LAYOUTS.find((known) => known === value) ?? "start";
  return layout === "globe" && !globeAvailable ? "start" : layout;
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
