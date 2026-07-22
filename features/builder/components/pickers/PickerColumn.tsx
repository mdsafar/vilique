"use client";

type PickerColumnProps = {
    values: string[];
    selected: string;
    isDisabled?: (value: string) => boolean;
    onSelect: (value: string) => void;
};

export default function PickerColumn({
    values,
    selected,
    isDisabled,
    onSelect,
}: PickerColumnProps) {
    return (
        <div className="timePickerColumn">
            {values.map((value) => {
                const disabled =
                    isDisabled?.(value) ?? false;

                const className = [
                    value === selected ? "selected" : "",
                    disabled ? "disabled" : "",
                ]
                    .filter(Boolean)
                    .join(" ");

                return (
                    <button
                        key={value}
                        type="button"
                        className={className || undefined}
                        disabled={disabled}
                        onClick={() => onSelect(value)}
                    >
                        {value}
                    </button>
                );
            })}
        </div>
    );
}