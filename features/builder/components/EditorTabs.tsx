"use client";
import type {
    EditorTab,
} from "@/features/builder/types";

const editorTabs: {
    id: EditorTab;
    label: string;
}[] = [
        {
            id: "content",
            label: "Content",
        },
        {
            id: "event",
            label: "Event",
        },
        {
            id: "contact",
            label: "Contact",
        },
        {
            id: "sound",
            label: "Sound",
        },
    ];

export default function EditorTabs({
    activeTab,
    setActiveTab,
}: {
    activeTab: EditorTab;
    setActiveTab: (tab: EditorTab) => void;
}) {
    return (
        <div className="editorTabs">
            {editorTabs.map(({ id, label }) => (
                <button
                    key={id}
                    type="button"
                    className={
                        activeTab === id ? "active" : ""
                    }
                    onClick={() => setActiveTab(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}