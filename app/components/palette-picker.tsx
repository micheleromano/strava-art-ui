import { ColorSwatch, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { PALETTES } from "~/lib/palettes";

type Palette = (typeof PALETTES)[number];

type Props = {
  background: string;
  line: string;
  onChange: (palette: Palette) => void;
};

/** Ready-made colour pairs; none is selected once someone picks their own colours. */
export function PalettePicker({ background, line, onChange }: Props) {
  const { t } = useTranslation();
  const selected = PALETTES.find(
    (palette) => palette.background === background && palette.line === line,
  );
  return (
    <div className="flex flex-col gap-2">
      <span id="palette-label" className="text-sm font-medium">
        {t("studio.palettes.label")}
      </span>
      <ToggleButtonGroup
        aria-labelledby="palette-label"
        selectionMode="single"
        disallowEmptySelection
        isDetached
        size="sm"
        className="flex-wrap"
        selectedKeys={selected ? [selected.id] : []}
        onSelectionChange={(keys) => {
          const palette = PALETTES.find(({ id }) => keys.has(id));
          if (palette) onChange(palette);
        }}
      >
        {PALETTES.map((palette) => (
          <ToggleButton key={palette.id} id={palette.id}>
            <span aria-hidden className="flex -space-x-1">
              {/* A border keeps pale swatches visible against the button. */}
              <ColorSwatch
                color={palette.background}
                size="xs"
                className="border border-foreground/40"
              />
              <ColorSwatch
                color={palette.line}
                size="xs"
                className="border border-foreground/40"
              />
            </span>
            {t(`studio.palettes.${palette.id}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
