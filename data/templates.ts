import { InvitationCategory } from "@/types/invitation";

export interface InvitationTemplate {
    id: string;
    name: string;
    category: InvitationCategory;
    accent: string;
    gradient: string;
    description: string;
    mood: string;
    badge: "Free" | "Premium";
    popularity: "Featured" | "Popular" | "Newest";
    features: string[];
    palette: string[];
    previewSections: string[];
    ratingAverage?: number | null;
    ratingCount?: number;
}

export const templates: InvitationTemplate[] = [
    {
        id: "pastel-floral-wedding",
        name: "Pastel Floral Wedding",
        category: "wedding",
        accent: "#b99aad",
        gradient: "linear-gradient(145deg, #f8dfea 0%, #ead9fb 52%, #dcefe7 100%)",
        description: "Soft pastel wedding invitation with floral animations, RSVP, music and venue moments.",
        mood: "Elegant garden ceremony",
        badge: "Free",
        popularity: "Featured",
        features: ["Floating flowers", "Countdown", "Music", "Venue actions"],
        palette: ["#b99aad", "#789988", "#f8f1fa", "#c7a45c"],
        previewSections: ["Accept screen", "Music", "Map", "WhatsApp"],
    },
];
