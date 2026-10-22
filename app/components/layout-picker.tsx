import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { LAYOUTS, type Layout } from "~/lib/layouts";

type Props = {
  value: Layout;
  onChange: (layout: Layout) => void;
};

export function LayoutPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <span id="layout-label" className="text-sm font-medium">
        {t("studio.layout.label")}
      </span>
      <ToggleButtonGroup
        aria-labelledby="layout-label"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const [layout] = keys;
          if (layout) onChange(layout as Layout);
        }}
      >
        {LAYOUTS.map((layout, index) => (
          <ToggleButton key={layout} id={layout}>
            {index > 0 && <ToggleButtonGroup.Separator />}
            {t(`studio.layout.${layout}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <p className="text-sm text-muted">{t(`studio.layout.${value}Help`)}</p>
    </div>
  );
}
