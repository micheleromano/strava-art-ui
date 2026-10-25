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

// The globe is drawn 1000 px across at 2× pixel density, so the PNG is 2000 × 2000.
const SIZE = 1000;
const PIXEL_RATIO = 2;
// Radians per frame: one full turn in about 35 seconds at 60 frames a second.
const SPIN = 0.003;

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
    const globe = createGlobe(canvas, {
      width: SIZE,
      height: SIZE,
      devicePixelRatio: PIXEL_RATIO,
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
    // cobe draws nothing, silently, where WebGL isn't available.
    setSupported(
      Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl")),
    );
    return () => {
      globe.destroy();
      globeRef.current = null;
    };
  }, [places, background, dot, canvasRef]);

  // Redraws every frame, even when paused: cobe loads its world map in the background
  // and only shows it on the next redraw. Pausing only stops the turning.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    let frame = requestAnimationFrame(function draw() {
      if (!pausedRef.current) phi.current += SPIN;
      globeRef.current?.update({ phi: phi.current, theta: theta.current });
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
