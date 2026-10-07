export type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: "date" | "time" | "datetime";
  help?: string;
  minimumDate?: Date;
};

export declare function DateTimeField(props: DateTimeFieldProps): import("react").ReactElement;
