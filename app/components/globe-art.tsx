import { Button } from "@heroui/react";
import createGlobe, { type Globe } from "cobe";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import {
  globeColours,
  secondsPerTurn,
  SPIN_SPEED,
  spinFor,
  markersFor,
  spinFacing,
  tiltAngle,
  toRgb,
} from "~/lib/globe";
import type { Place } from "~/lib/places";

import { SliderControl } from "./slider-control";

type Props = {
  places: Place[];
  background: string;
  dot: string;
  /** Show the background colour behind the globe, as it will be in the download. */
  showBackground: boolean;
  label: string;
  /** Degrees north to tilt toward the viewer; negative shows more of the south. */
  tilt: number;
  /** The canvas the globe is drawn on, so the studio can save it as a PNG. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

// The globe is drawn at its on-screen size, at up to 2× pixel density and at most this
// many pixels across: drawing more costs a lot without a graphics chip, every frame.
const MAX_PIXELS_ACROSS = 2000;
// While spinning, draw at most 30 frames a second: smooth enough for a slow turn, and
// half the work (or a quarter, on 120 Hz phones) of drawing every frame.
const SPINNING_FRAME_MS = 1000 / 30;
// cobe loads its world map in the background and only shows it on a later redraw, so a
// new globe keeps redrawing for this long even while paused.
const SETTLE_MS = 1500;

/** A spinning globe with a dot for each rounded place, drawn by the cobe library. */
export function GlobeArt({
  places,
  background,
  dot,
  showBackground,
  label,
  tilt,
  canvasRef,
}: Props) {
  const { t } = useTranslation();
  const globeRef = useRef<Globe | null>(null);
  const settleUntil = useRef(0);
  // Set when the globe first appears, then kept: changing dates or routes doesn't turn it.
  const phi = useRef<number | null>(null);
  // Read on every frame, so the spin and the tilt combine.
  const theta = useRef(tiltAngle(tilt));
  theta.current = tiltAngle(tilt);
  const [supported, setSupported] = useState(true);
  // Still until someone chooses to spin it.
  const [paused, setPaused] = useState(true);
  const [speed, setSpeed] = useState<number>(SPIN_SPEED.initial);

  // cobe draws on the canvas outside React, so this connects the two: create the globe,
  // and destroy it when the places or colours change or the globe goes away.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The first time, start with the busiest place facing the viewer.
    phi.current ??= places[0] ? spinFacing(places[0].location) : 0;
    const across = canvas.clientWidth || 1000;
    const globe = createGlobe(canvas, {
      width: across,
      height: across,
      devicePixelRatio: Math.min(
        window.devicePixelRatio,
        2,
        MAX_PIXELS_ACROSS / across,
      ),
      phi: phi.current,
      theta: theta.current,
      mapSamples: 16000,
      mapBrightness: 6,
      diffuse: 1.2,
      markerColor: toRgb(dot),
      markers: markersFor(places),
      // Flat on the surface: raised dots near the globe's edge poke out past it.
      markerElevation: 0,
      ...globeColours(background),
      // Keeps the last frame readable, so it can be saved as a PNG.
      context: { preserveDrawingBuffer: true },
    });
    globeRef.current = globe;
    settleUntil.current = performance.now() + SETTLE_MS;
    // cobe draws nothing, silently, where WebGL isn't available.
    setSupported(
      Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl")),
    );
    return () => {
      globe.destroy();
      globeRef.current = null;
    };
  }, [places, background, dot, canvasRef]);

  // Draws up to 30 frames a second while spinning. While still, it only redraws when
  // something changes (the tilt) or a new globe is settling, so a still globe costs nothing.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  useEffect(() => {
    let drawnTheta = NaN;
    let lastDrawn = performance.now();
    let frame = requestAnimationFrame(function draw(now) {
      const spinning = !pausedRef.current;
      // A couple of milliseconds' leeway, so 60 Hz screens draw every other frame.
      const spinDue = spinning && now - lastDrawn >= SPINNING_FRAME_MS - 2;
      if (
        spinDue ||
        now < settleUntil.current ||
        theta.current !== drawnTheta
      ) {
        if (spinning && phi.current !== null) {
          phi.current += spinFor(now - lastDrawn, speedRef.current);
        }
        globeRef.current?.update({
          phi: phi.current ?? 0,
          theta: theta.current,
        });
        drawnTheta = theta.current;
        lastDrawn = now;
      }
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!supported) {
    return (
      <p className="rounded-lg border border-border p-8 text-center text-muted">
        {t("studio.globe.unsupported")}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <div
        className="w-full rounded-lg"
        // The picture's own colour, chosen by the person, not a design token.
        style={showBackground ? { backgroundColor: background } : undefined}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className="aspect-square w-full"
        />
      </div>
      <Button
        size="sm"
        variant="secondary"
        aria-pressed={!paused}
        onPress={() => setPaused((current) => !current)}
      >
        {paused ? t("studio.globe.spin") : t("studio.globe.pause")}
      </Button>
      <div className="flex w-full max-w-xs flex-col gap-1">
        <SliderControl
          label={t("studio.globe.speed")}
          value={speed}
          minValue={SPIN_SPEED.min}
          maxValue={SPIN_SPEED.max}
          onChange={setSpeed}
        />
        <p className="text-sm text-muted">
          {t("studio.globe.speedHelp", {
            seconds: Math.round(secondsPerTurn(speed)),
          })}
        </p>
      </div>
    </div>
  );
}
