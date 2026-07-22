"use client";

import {
    useEffect,
    useState,
} from "react";

import DatePickerField from "@/features/builder/components/pickers/DatePickerField";
import TimePickerField from "@/features/builder/components/pickers/TimePickerField";
import SoundPreviewCard from "@/features/builder/components/SoundPreviewCard";
import useMinuteNow from "@/features/builder/hooks/useMinuteNow";
import * as builderDateUtils from "@/features/builder/lib/builderDateUtils";
import * as builderTimeUtils from "@/features/builder/lib/builderTimeUtils";
import type {
    BuilderUpdateSource,
    EditorTab,
} from "@/features/builder/types";
import type {
    BuilderValidationErrors,
} from "@/features/invitations/validation";
import type {
    InvitationData,
} from "@/types/invitation";

type EditorFormProps = {
    activeTab: EditorTab;
    invitation: InvitationData;
    errors: BuilderValidationErrors;
    updateField: (
        key: string,
        value: string,
        source?: BuilderUpdateSource,
    ) => void;
    updateTheme: (
        key: keyof InvitationData["theme"],
        value: InvitationData["theme"][
            keyof InvitationData["theme"]
        ],
    ) => void;
    updateMusicFile: (
        file: File | null,
    ) => void;
    isUploadingMusic: boolean;
    isReadOnly: boolean;
};

const weddingTemplateTitleOptions = [
    "Wedding Invitation",
    "Reception",
] as const;

const weddingTemplateDefaultTitle =
    weddingTemplateTitleOptions[0];

const durationOptions = [
    {
        value: 5,
        label: "5s",
    },
    {
        value: 10,
        label: "10s",
    },
    {
        value: 15,
        label: "15s",
    },
    {
        value: 20,
        label: "20s",
    },
];

export default function EditorForm({
    activeTab,
    invitation,
    errors,
    updateField,
    updateTheme,
    updateMusicFile,
    isUploadingMusic,
    isReadOnly,
}: EditorFormProps) {
    const { startTime, endTime } = builderTimeUtils.parseTimeRange(invitation.eventTime);
    const [activePicker, setActivePicker] = useState<"date" | "startTime" | "endTime" | null>(null);
    const now = useMinuteNow(activeTab === "event");
    const selectedDate = builderDateUtils.parseDateValue(invitation.eventDate) || now;
    const minEventDate = builderDateUtils.getMinimumEventDate(now);
    const minEventDateValue = builderDateUtils.toDateInputValue(minEventDate);
    const selectedDateTime = builderDateUtils.startOfDate(selectedDate).getTime();
    const minEventDateTime = builderDateUtils.startOfDate(minEventDate).getTime();
    const minTimeMinutes = builderDateUtils.isSameDate(selectedDate, minEventDate) ? builderDateUtils.getNextSelectableMinute(now) : null;
    const maxStartTimeMinutes = 23 * 60 + 58;
    const endMinTimeMinutes = builderTimeUtils.getMinimumEndTimeMinutes(startTime);
    const usesWeddingTitleDropdown = invitation.templateId === "pastel-floral-wedding";
    const selectedWeddingTitle = weddingTemplateTitleOptions.includes(invitation.title as typeof weddingTemplateTitleOptions[number])
        ? invitation.title
        : weddingTemplateDefaultTitle;

    useEffect(() => {
        if (activeTab !== "event") return;

        if (selectedDateTime < minEventDateTime) {
            // Programmatic normalization must not mark the session as user-edited.
            updateField("eventDate", minEventDateValue, "programmatic");
            return;
        }

        let nextStartTime = startTime;
        let nextEndTime = endTime;

        if (!nextStartTime || !builderTimeUtils.isSelectableTime(nextStartTime, minTimeMinutes, maxStartTimeMinutes)) {
            nextStartTime = builderTimeUtils.fromMinutes(Math.min(Math.max(minTimeMinutes ?? 0, builderTimeUtils.toMinutes(nextStartTime || "00:00")), maxStartTimeMinutes));
        }

        const minEndMinutes = builderTimeUtils.getMinimumEndTimeMinutes(nextStartTime);
        if (!nextEndTime || !builderTimeUtils.isSelectableTime(nextEndTime, minEndMinutes, null)) {
            nextEndTime = builderTimeUtils.getPreferredEndTime(nextStartTime, minEndMinutes);
        }

        if (nextStartTime !== startTime || nextEndTime !== endTime) {
            updateField("eventTime", builderTimeUtils.formatTimeRange(nextStartTime, nextEndTime), "programmatic");
        }
    }, [activeTab, endTime, maxStartTimeMinutes, minEventDateTime, minEventDateValue, minTimeMinutes, selectedDateTime, startTime, updateField]);

    useEffect(() => {
        if (!usesWeddingTitleDropdown) return;
        if (weddingTemplateTitleOptions.includes(invitation.title as typeof weddingTemplateTitleOptions[number])) return;
        updateField("title", weddingTemplateDefaultTitle, "programmatic");
    }, [invitation.title, updateField, usesWeddingTitleDropdown]);

    if (activeTab === "content") {
        return (
            <div className="editorForm">
                <label className={errors.title ? "hasError" : ""}>
                    <span>Title</span>
                    {usesWeddingTitleDropdown ? (
                        <select
                            data-field-key="title"
                            value={selectedWeddingTitle}
                            onChange={(e) => updateField("title", e.target.value)}
                            aria-invalid={!!errors.title}
                            disabled={isReadOnly}
                        >
                            {weddingTemplateTitleOptions.map((option) => (
                                <option value={option} key={option}>{option}</option>
                            ))}
                        </select>
                    ) : (
                        <input data-field-key="title" value={invitation.title} onChange={(e) => updateField("title", e.target.value)} maxLength={45} aria-invalid={!!errors.title} disabled={isReadOnly} />
                    )}
                    {errors.title ? <small className="fieldError">{errors.title}</small> : null}
                </label>

                <label className={errors.primaryName ? "hasError" : ""}>
                    <span>Primary Name</span>
                    <input data-field-key="primaryName" value={invitation.primaryName} onChange={(e) => updateField("primaryName", e.target.value)} maxLength={25} aria-invalid={!!errors.primaryName} disabled={isReadOnly} />
                    {errors.primaryName ? <small className="fieldError">{errors.primaryName}</small> : null}
                </label>

                <label className={errors.secondaryName ? "hasError" : ""}>
                    <span>Secondary Name</span>
                    <input data-field-key="secondaryName" value={invitation.secondaryName || ""} onChange={(e) => updateField("secondaryName", e.target.value)} maxLength={25} aria-invalid={!!errors.secondaryName} disabled={isReadOnly} />
                    {errors.secondaryName ? <small className="fieldError">{errors.secondaryName}</small> : null}
                </label>

                <label className={errors.message ? "hasError" : ""}>
                    <span>Message</span>
                    <textarea data-field-key="message" value={invitation.message} onChange={(e) => updateField("message", e.target.value)} maxLength={200} aria-invalid={!!errors.message} disabled={isReadOnly} />
                    {errors.message ? <small className="fieldError">{errors.message}</small> : null}
                </label>
            </div>
        );
    }

    if (activeTab === "event") {
        return (
            <div className="editorForm">
                <label className={errors.eventDate ? "hasError" : ""}>
                    <span>Date</span>
                    <div data-field-key="eventDate" tabIndex={-1}>
                        <DatePickerField
                            value={invitation.eventDate}
                            onChange={(value) => updateField("eventDate", value)}
                            isOpen={activePicker === "date"}
                            onToggle={(open) => setActivePicker(open ? "date" : null)}
                            disabled={isReadOnly}
                        />
                    </div>
                    {errors.eventDate ? <small className="fieldError">{errors.eventDate}</small> : null}
                </label>

                <label className={errors.eventTime ? "hasError" : ""}>
                    <span>Start Time</span>
                    <div data-field-key="eventTime" tabIndex={-1}>
                        <TimePickerField
                            value={startTime}
                            onChange={(value) => updateField("eventTime", builderTimeUtils.normalizeTimeRangeForStart(value, endTime))}
                            minTimeMinutes={minTimeMinutes}
                            maxTimeMinutes={maxStartTimeMinutes}
                            isOpen={activePicker === "startTime"}
                            onToggle={(open) => setActivePicker(open ? "startTime" : null)}
                            disabled={isReadOnly}
                        />
                    </div>
                    {errors.eventTime ? <small className="fieldError">{errors.eventTime}</small> : null}
                </label>

                <label>
                    <span>End Time</span>
                    <TimePickerField
                        value={endTime}
                        onChange={(value) => updateField("eventTime", builderTimeUtils.formatTimeRange(startTime, value))}
                        minTimeMinutes={endMinTimeMinutes}
                        maxTimeMinutes={null}
                        isOpen={activePicker === "endTime"}
                        onToggle={(open) => setActivePicker(open ? "endTime" : null)}
                        disabled={isReadOnly}
                    />
                </label>

                <label className={errors.venueName ? "hasError" : ""}>
                    <span>Venue Name</span>
                    <input data-field-key="venueName" value={invitation.venueName} onChange={(e) => updateField("venueName", e.target.value)} maxLength={45} aria-invalid={!!errors.venueName} disabled={isReadOnly} />
                    {errors.venueName ? <small className="fieldError">{errors.venueName}</small> : null}
                </label>

                <label className={errors.venueAddress ? "hasError" : ""}>
                    <span>Venue Address</span>
                    <textarea data-field-key="venueAddress" value={invitation.venueAddress} onChange={(e) => updateField("venueAddress", e.target.value)} maxLength={120} aria-invalid={!!errors.venueAddress} disabled={isReadOnly} />
                    {errors.venueAddress ? <small className="fieldError">{errors.venueAddress}</small> : null}
                </label>
            </div>
        );
    }

    if (activeTab === "contact") {
        return (
            <div className="editorForm">
                <label className={errors.phone ? "hasError" : ""}>
                    <span>Primary Phone</span>
                    <input
                        data-field-key="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        value={invitation.phone || ""}
                        onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        aria-invalid={!!errors.phone}
                        disabled={isReadOnly}
                    />
                    {errors.phone ? <small className="fieldError">{errors.phone}</small> : null}
                </label>

                <label className={errors.secondaryPhone ? "hasError" : ""}>
                    <span>Secondary Phone</span>
                    <input
                        data-field-key="secondaryPhone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        value={invitation.secondaryPhone || ""}
                        onChange={(e) => updateField("secondaryPhone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        maxLength={10}
                        aria-invalid={!!errors.secondaryPhone}
                        disabled={isReadOnly}
                    />
                    {errors.secondaryPhone ? <small className="fieldError">{errors.secondaryPhone}</small> : null}
                </label>

                <label className={errors.mapLink ? "hasError" : ""}>
                    <span>Map Link</span>
                    <input
                        data-field-key="mapLink"
                        type="url"
                        inputMode="url"
                        value={invitation.mapLink}
                        onChange={(e) => updateField("mapLink", e.target.value)}
                        maxLength={250}
                        aria-invalid={!!errors.mapLink}
                        disabled={isReadOnly}
                    />
                    {errors.mapLink ? <small className="fieldError">{errors.mapLink}</small> : null}
                </label>
            </div>
        );
    }

    const defaultMusicUrl = invitation.musicUrl || invitation.defaultMusicUrl || "";
    const defaultTickUrl = invitation.tickSoundUrl || invitation.theme?.tickSoundUrl || invitation.defaultTickSoundUrl || "";
    const hasCustomSong = !!invitation.musicUrl && invitation.musicUrl !== invitation.defaultMusicUrl;

    const formatAudioFilename = (url: string | null | undefined, fallback: string) => {
        if (!url) return fallback;
        const name = url.split("/").pop()?.split("?")[0] || fallback;
        if (name.length > 22 && /^[a-f0-9-]+\.[a-z0-9]+$/i.test(name)) {
            const ext = name.split(".").pop() || "mp3";
            return `${name.slice(0, 8)}...${name.slice(-6)}.${ext}`;
        }
        return name;
    };

    return (
        <div className="editorForm">
            <div className={`editorSoundField ${errors.musicUrl ? "hasError" : ""}`}>
                <span className="editorFieldLabel">Celebration Song</span>
                <div data-field-key="musicUrl" tabIndex={-1}>
                    <SoundPreviewCard
                        icon="🎵"
                        title={hasCustomSong ? "Custom Song" : "Default Celebration Song"}
                        subtitle={formatAudioFilename(defaultMusicUrl, "No song uploaded yet")}
                        url={defaultMusicUrl || undefined}
                        badge={hasCustomSong ? "custom" : defaultMusicUrl ? "default" : undefined}
                        onRemove={hasCustomSong ? () => updateMusicFile(null) : undefined}
                        onUpload={(file) => updateMusicFile(file)}
                        isUploading={isUploadingMusic}
                        uploadId="musicUploadInput"
                        isReadOnly={isReadOnly}
                    />
                </div>
                {errors.musicUrl ? <small className="fieldError">{errors.musicUrl}</small> : null}
            </div>

            <div className="editorSoundField">
                <span className="editorFieldLabel">Clock Ticking Sound</span>
                <SoundPreviewCard
                    icon="⏰"
                    title="Default Ticking Sound"
                    subtitle={formatAudioFilename(defaultTickUrl, "No tick sound configured")}
                    url={defaultTickUrl || undefined}
                    badge="default"
                    isReadOnly={isReadOnly}
                />
                <p className="soundHelperText" style={{
                    fontSize: "var(--sound-helper-font, 10px)",
                    color: "#9ca3af",
                    marginTop: "6px",
                    lineHeight: 1.35,
                    paddingLeft: "2px",
                }}>
                    This sound plays in the background automatically. It&apos;s set by the template and cannot be changed.
                </p>
            </div>

            <label>
                <span>Song Play Duration</span>
                <div className="soundDurationOptions" style={{ display: "flex", gap: "7px", marginTop: "7px" }}>
                    {durationOptions.map((opt) => {
                        const isSelected = (invitation.theme?.musicDuration ?? 20) === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => updateTheme("musicDuration", opt.value)}
                                disabled={isReadOnly}
                                style={{
                                    flex: 1,
                                    minHeight: "38px",
                                    borderRadius: "12px",
                                    border: isSelected ? "2px solid #d8bfff" : "1px solid rgba(23, 23, 23, 0.08)",
                                    background: isSelected ? "#ead8ff" : "#fff",
                                    color: isSelected ? "#6f43e8" : "#4b5563",
                                    fontSize: "var(--sound-duration-font, 13px)",
                                    fontWeight: isSelected ? 800 : 650,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    boxShadow: isSelected ? "0 3px 10px rgba(140, 76, 243, 0.12)" : "none",
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </label>
        </div>
    );
}
