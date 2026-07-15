import { InvitationData } from "@/types/invitation";
import { getTemplateAudioDefaults } from "@/lib/config/templateAudio";

export function createDefaultInvitation(): InvitationData {
    const audioDefaults = getTemplateAudioDefaults("pastel-floral-wedding");
    const now = new Date();
    const eventTime = getDefaultEventTime(now);

    return {
        id: "default-draft-placeholder-id",
        slug: "maya-arjun-wedding",
        category: "wedding",
        templateId: "pastel-floral-wedding",

        title: "Wedding Invitation",
        primaryName: "Maya",
        secondaryName: "Arjun",

        eventDate: toDateInputValue(now),
        eventTime,
        venueName: "The Rose Garden Hall",
        venueAddress: "MG Road, Kochi",
        mapLink: "https://www.google.com/maps/search/?api=1&query=The+Rose+Garden+Hall+MG+Road+Kochi",

        phone: "9000000000",
        secondaryPhone: "9000000001",
        message: "Invite you to celebrate our wedding",

        musicUrl: "",
        tickSoundUrl: "",
        defaultMusicUrl: audioDefaults.musicUrl || "",
        defaultTickSoundUrl: audioDefaults.tickSoundUrl || "",

        theme: {
            primaryColor: "#b99aad",
            secondaryColor: "#789988",
            backgroundColor: "#f8f1fa",
            textColor: "#696979",
            fontStyle: "elegant",
            musicDuration: 20,
            tickSoundUrl: "",
        },

        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
}

function toDateInputValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDefaultEventTime(date: Date) {
    const nowMinutes = date.getHours() * 60 + date.getMinutes();
    const nextSlot = Math.ceil((nowMinutes + 1) / 15) * 15;
    const startMinutes = Math.min(Math.max(nextSlot, 9 * 60), 23 * 60 + 58);
    const endMinutes = Math.min(startMinutes + 3 * 60 + 30, 23 * 60 + 59);

    return `${formatTimeLabel(startMinutes)} - ${formatTimeLabel(endMinutes)}`;
}

function formatTimeLabel(totalMinutes: number) {
    const hours24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;

    return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}
