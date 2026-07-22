"use client";

import { Clock3 } from "lucide-react";

import PickerColumn from "@/features/builder/components/pickers/PickerColumn";
import PickerModal from "@/features/builder/components/pickers/PickerModal";
import * as builderTimeUtils from "@/features/builder/lib/builderTimeUtils";

type TimePickerFieldProps = {
    value: string;
    onChange: (value: string) => void;
    minTimeMinutes: number | null;
    maxTimeMinutes: number | null;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
};

export default function TimePickerField({
    value,
    onChange,
    minTimeMinutes,
    maxTimeMinutes,
    isOpen,
    onToggle,
}: TimePickerFieldProps) {
    const parsed = builderTimeUtils.parseTimeInputParts(value);

    function updateTime(next: Partial<ReturnType<typeof builderTimeUtils.parseTimeInputParts>>) {
        const nextValue = builderTimeUtils.toTimeInputFromParts({ ...parsed, ...next });
        if (!builderTimeUtils.isSelectableTime(nextValue, minTimeMinutes, maxTimeMinutes)) return;
        onChange(nextValue);
    }

    return (
        <div className="customPicker">
            <button
                className="customPickerTrigger"
                type="button"
                onClick={() => onToggle(!isOpen)}
            >
                <span>{value ? builderTimeUtils.fromTimeInputValue(value) : "Select time"}</span>
                <Clock3 size={18} aria-hidden="true" />
            </button>

            {isOpen ? (
                <PickerModal title="Choose time" variant="time" onClose={() => onToggle(false)}>
                    <div className="customPickerPopover timePickerPopover">
                        <div className="timePickerSummary">
                            <span>Selected time</span>
                            <strong>{builderTimeUtils.fromTimeInputValue(builderTimeUtils.toTimeInputFromParts(parsed))}</strong>
                        </div>
                        <div className="timePickerColumns">
                            <div className="timePickerColGroup">
                                <span className="timePickerColLabel">Hour</span>
                                <PickerColumn
                                    values={Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))}
                                    selected={parsed.hour}
                                    isDisabled={(hour) => !builderTimeUtils.isSelectableTime(builderTimeUtils.toTimeInputFromParts({ ...parsed, hour }), minTimeMinutes, maxTimeMinutes)}
                                    onSelect={(hour) => updateTime({ hour })}
                                />
                            </div>
                            <div className="timePickerColGroup">
                                <span className="timePickerColLabel">Min</span>
                                <PickerColumn
                                    values={Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"))}
                                    selected={parsed.minute}
                                    isDisabled={(minute) => !builderTimeUtils.isSelectableTime(builderTimeUtils.toTimeInputFromParts({ ...parsed, minute }), minTimeMinutes, maxTimeMinutes)}
                                    onSelect={(minute) => updateTime({ minute })}
                                />
                            </div>
                            <div className="timePickerColGroup">
                                <span className="timePickerColLabel">Period</span>
                                <PickerColumn
                                    values={["AM", "PM"]}
                                    selected={parsed.period}
                                    isDisabled={(period) => !builderTimeUtils.isSelectableTime(builderTimeUtils.toTimeInputFromParts({ ...parsed, period: period as "AM" | "PM" }), minTimeMinutes, maxTimeMinutes)}
                                    onSelect={(period) => updateTime({ period: period as "AM" | "PM" })}
                                />
                            </div>
                        </div>

                        <div className="customPickerFooter single">
                            <button type="button" onClick={() => onToggle(false)}>Done</button>
                        </div>
                    </div>
                </PickerModal>
            ) : null}
        </div>
    );
}