"use client";

import {
    FileText,
    Mail,
    Users,
    Volume2,
    type LucideIcon,
} from "lucide-react";
import type {
    EditorTab,
} from "@/features/builder/types";

const builderRailItems: {
    id: EditorTab;
    label: string;
    icon: LucideIcon;
}[] = [
        {
            id: "content",
            label: "Content",
            icon: FileText,
        },
        {
            id: "event",
            label: "Event",
            icon: Mail,
        },
        {
            id: "contact",
            label: "Contact",
            icon: Users,
        },
        {
            id: "sound",
            label: "Sound",
            icon: Volume2,
        },
    ];

export default function BuilderToolRail({
    activeTab,
    setActiveTab,
}: {
    activeTab: EditorTab;
    setActiveTab: (tab: EditorTab) => void;
}) {
    return (
        <nav
            className="builderToolRail"
            aria-label="Builder tools"
        >
            {builderRailItems.map(
                ({ id, label, icon: Icon }) => {
                    const active = activeTab === id;

                    return (
                        <button
                            key={id}
                            type="button"
                            className={active ? "active" : ""}
                            onClick={() => setActiveTab(id)}
                            title={label}
                        >
                            <span className="builderToolIcon">
                                <Icon
                                    size={18}
                                    aria-hidden="true"
                                />
                            </span>

                            <span>{label}</span>
                        </button>
                    );
                },
            )}
        </nav>
    );
}