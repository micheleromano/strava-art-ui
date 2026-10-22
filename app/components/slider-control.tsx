import { Label, Slider } from "@heroui/react";

type Props = {
  label: string;
  value: number;
  minValue: number;
  maxValue: number;
  step?: number;
  formatOptions?: Intl.NumberFormatOptions;
  onChange: (value: number) => void;
};

export function SliderControl({ label, onChange, ...props }: Props) {
  return (
    <Slider
      {...props}
      className="w-full"
      onChange={(value) => onChange(value as number)}
    >
      <Label>{label}</Label>
      <Slider.Output />
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
}
