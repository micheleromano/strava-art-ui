import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  type Color,
} from "@heroui/react";
import { useTranslation } from "react-i18next";

type Props = {
  label: string;
  value: Color;
  onChange: (colour: Color) => void;
};

export function ColourControl({ label, value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <ColorPicker value={value} onChange={onChange}>
      <ColorPicker.Trigger>
        <ColorSwatch size="lg" />
        <Label>{label}</Label>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="gap-2">
        <ColorArea
          aria-label={t("studio.colourArea", { name: label })}
          className="max-w-full"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
        >
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider
          aria-label={t("studio.hue", { name: label })}
          channel="hue"
          className="px-1"
          colorSpace="hsb"
        >
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorField aria-label={t("studio.hex", { name: label })}>
          <ColorField.Group variant="secondary">
            <ColorField.Prefix>
              <ColorSwatch size="xs" />
            </ColorField.Prefix>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}
