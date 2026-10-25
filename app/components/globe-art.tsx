import { Button } from "@heroui/react";
import createGlobe, { type Globe } from "cobe";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import {
  globeColours,
  markersFor,
  spinFacing,
  tiltAngle,
  toRgb,
} from "~/lib/globe";
import type { Place } from "~/lib/places";

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
// Radians per frame: one full turn in about 35 seconds at 60 frames a second.
const SPIN = 0.003;
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
  const phi = useRef(0);
  // Read on every frame, so the spin and the tilt combine.
  const theta = useRef(tiltAngle(tilt));
  theta.current = tiltAngle(tilt);
  const [supported, setSupported] = useState(true);
  // Starts still for anyone who has asked their device to reduce motion.
  const [paused, setPaused] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Turn the busiest place to face the viewer whenever the places change.
  useEffect(() => {
    if (places[0]) phi.current = spinFacing(places[0].location);
  }, [places]);

  // cobe draws on the canvas outside React, so this connects the two: create the globe,
  // and destroy it when the places or colours change or the globe goes away.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

  // Redraws every frame while spinning. While paused it only redraws when something
  // changes (the tilt) or a new globe is settling, so a still globe costs nothing.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    let drawnTheta = NaN;
    let frame = requestAnimationFrame(function draw(now) {
      const spinning = !pausedRef.current;
      if (spinning) phi.current += SPIN;
      if (
        spinning ||
        now < settleUntil.current ||
        theta.current !== drawnTheta
      ) {
        globeRef.current?.update({ phi: phi.current, theta: theta.current });
        drawnTheta = theta.current;
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
    </div>
  );
}
