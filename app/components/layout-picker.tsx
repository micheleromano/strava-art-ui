import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { ART_LAYOUTS, type ArtLayout } from "~/lib/layouts";

type Props = {
  value: ArtLayout;
  onChange: (layout: ArtLayout) => void;
  /** Layouts shown but not available, e.g. the globe for sample routes. */
  unavailable?: ArtLayout[];
  /** Says why the unavailable layouts can't be picked. */
  unavailableReason?: string;
};

export function LayoutPicker({
  value,
  onChange,
  unavailable = [],
  unavailableReason,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <span id="layout-label" className="text-sm font-medium">
        {t("studio.layout.label")}
      </span>
      <ToggleButtonGroup
        aria-labelledby="layout-label"
        aria-describedby={unavailable.length ? "layout-unavailable" : undefined}
        selectionMode="single"
        disallowEmptySelection
        isDetached
        className="flex-wrap"
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const [layout] = keys;
          if (layout) onChange(layout as ArtLayout);
        }}
      >
        {ART_LAYOUTS.map((layout) => (
          <ToggleButton
            key={layout}
            id={layout}
            isDisabled={unavailable.includes(layout)}
          >
            {t(`studio.layout.${layout}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <p className="text-sm text-muted">{t(`studio.layout.${value}Help`)}</p>
      {unavailable.length > 0 && unavailableReason && (
        <p id="layout-unavailable" className="text-sm text-muted">
          {unavailableReason}
        </p>
      )}
    </div>
  );
}
