import { InvitationData } from "@/types/invitation";
import { getTemplateAudioDefaults } from "@/lib/config/templateAudio";

export function createDefaultInvitation(): InvitationData {
    const audioDefaults = getTemplateAudioDefaults("pastel-floral-wedding");

    return {
        id: "default-draft-placeholder-id",
        slug: "maya-arjun-wedding",
        category: "wedding",
        templateId: "pastel-floral-wedding",

        title: "Wedding Invitation",
        primaryName: "Maya",
        secondaryName: "Arjun",

        eventDate: "2027-02-14",
        eventTime: "05:30 PM - 09:00 PM",
        venueName: "The Rose Garden Hall",
        venueAddress: "MG Road, Kochi",
        mapLink: "https://www.google.com/maps/search/?api=1&query=The+Rose+Garden+Hall+MG+Road+Kochi",

        phone: "9000000000",
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

        createdAt: "2026-07-11T12:00:00.000Z",
        updatedAt: "2026-07-11T12:00:00.000Z",
    };
}
