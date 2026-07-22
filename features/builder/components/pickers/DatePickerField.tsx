"use client";

import {
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    CalendarDays,
    ChevronLeft,
} from "lucide-react";
import PickerModal from "@/features/builder/components/pickers/PickerModal";
import useMinuteNow from "@/features/builder/hooks/useMinuteNow";
import * as builderDateUtils from "@/features/builder/lib/builderDateUtils";

type DatePickerFieldProps = {
    value: string;
    onChange: (value: string) => void;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
    disabled?: boolean;
};

export default function DatePickerField({
    value,
    onChange,
    isOpen,
    onToggle,
    disabled = false,
}: DatePickerFieldProps) {
    const now = useMinuteNow(isOpen);
    const minDate = useMemo(() => builderDateUtils.getMinimumEventDate(now), [now]);
    const selectedDate = builderDateUtils.parseDateValue(value) || minDate;
    const [visibleMonth, setVisibleMonth] = useState(() => selectedDate || new Date());
    const minVisibleMonth = builderDateUtils.startOfMonth(minDate);
    const canGoPreviousMonth = builderDateUtils.startOfMonth(visibleMonth).getTime() > minVisibleMonth.getTime();
    const calendarDays = builderDateUtils.getCalendarDays(visibleMonth);

    useEffect(() => {
        if (!builderDateUtils.isValidDateValue(value)) {
            onChange(builderDateUtils.toDateInputValue(minDate));
        }
    }, [minDate, onChange, value]);

    function selectDate(date: Date) {
        if (builderDateUtils.isPastDate(date, minDate)) return;
        onChange(builderDateUtils.toDateInputValue(date));
        setVisibleMonth(date);
        onToggle(false);
    }

    function goToPreviousMonth() {
        if (!canGoPreviousMonth) return;
        setVisibleMonth((current) => {
            const previousMonth = builderDateUtils.startOfMonth(builderDateUtils.addMonths(current, -1));
            return previousMonth.getTime() < minVisibleMonth.getTime() ? minVisibleMonth : previousMonth;
        });
    }

    function toggleOpen(open: boolean) {
        if (disabled) return;
        if (open && builderDateUtils.startOfMonth(visibleMonth).getTime() < minVisibleMonth.getTime()) {
            setVisibleMonth(minVisibleMonth);
        }
        onToggle(open);
    }

    return (
        <div className="customPicker">
            <button
                className="customPickerTrigger"
                type="button"
                onClick={() => toggleOpen(!isOpen)}
                disabled={disabled}
            >
                <span>{builderDateUtils.formatDisplayDate(selectedDate)}</span>
                <CalendarDays size={18} aria-hidden="true" />
            </button>

            {isOpen ? (
                <PickerModal title="Choose date" variant="date" onClose={() => onToggle(false)}>
                    <div className="customPickerPopover datePickerPopover">
                        <div className="customPickerHeader">
                            <strong>
                                {visibleMonth.toLocaleString("en", { month: "long", year: "numeric" })}
                            </strong>
                            <div>
                                <button
                                    type="button"
                                    onClick={goToPreviousMonth}
                                    aria-label="Previous month"
                                    disabled={!canGoPreviousMonth}
                                >
                                    <ChevronLeft size={17} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => setVisibleMonth(builderDateUtils.addMonths(visibleMonth, 1))} aria-label="Next month">
                                    <ChevronLeft size={17} aria-hidden="true" style={{ transform: "rotate(180deg)" }} />
                                </button>
                            </div>
                        </div>

                        <div className="datePickerGrid">
                            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                                <b key={`${day}-${index}`}>{day}</b>
                            ))}
                            {calendarDays.map((date) => {
                                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                                const isSelected = selectedDate ? builderDateUtils.isSameDate(date, selectedDate) : false;
                                const isDisabled = builderDateUtils.isPastDate(date, minDate);

                                return (
                                    <button
                                        className={[
                                            isSelected ? "selected" : "",
                                            !isCurrentMonth ? "muted" : "",
                                            isDisabled ? "disabled" : "",
                                        ].filter(Boolean).join(" ") || undefined}
                                        disabled={isDisabled}
                                        key={date.toISOString()}
                                        type="button"
                                        onClick={() => selectDate(date)}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </PickerModal>
            ) : null}
        </div>
    );
}
