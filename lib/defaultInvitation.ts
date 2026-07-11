import { InvitationData } from "@/types/invitation";
import { nanoid } from "nanoid";

export function createDefaultInvitation(): InvitationData {
    const now = new Date().toISOString();

    return {
        id: nanoid(),
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

        theme: {
            primaryColor: "#b99aad",
            secondaryColor: "#789988",
            backgroundColor: "#f8f1fa",
            textColor: "#696979",
            fontStyle: "elegant",
        },

        createdAt: now,
        updatedAt: now,
    };
}
