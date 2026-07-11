export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    full_name?: string | null;
                    avatar_url?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            invitation_templates: {
                Row: {
                    id: string;
                    template_key: string;
                    name: string;
                    category: string;
                    description: string | null;
                    preview_image_url: string | null;
                    accent_color: string | null;
                    is_premium: boolean;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    template_key: string;
                    name: string;
                    category: string;
                    description?: string | null;
                    preview_image_url?: string | null;
                    accent_color?: string | null;
                    is_premium?: boolean;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["invitation_templates"]["Insert"]>;
                Relationships: [];
            };
            invitations: {
                Row: {
                    id: string;
                    user_id: string;
                    template_id: string | null;
                    slug: string;
                    category: string;
                    title: string;
                    primary_name: string;
                    secondary_name: string | null;
                    event_date: string | null;
                    event_time: string | null;
                    venue_name: string | null;
                    venue_address: string | null;
                    map_link: string | null;
                    phone: string | null;
                    whatsapp: string | null;
                    message: string | null;
                    music_url: string | null;
                    cover_image_url: string | null;
                    gallery_urls: Json;
                    theme: Json;
                    sections: Json;
                    status: "draft" | "published" | "archived";
                    published_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    template_id?: string | null;
                    slug: string;
                    category: string;
                    title: string;
                    primary_name: string;
                    secondary_name?: string | null;
                    event_date?: string | null;
                    event_time?: string | null;
                    venue_name?: string | null;
                    venue_address?: string | null;
                    map_link?: string | null;
                    phone?: string | null;
                    whatsapp?: string | null;
                    message?: string | null;
                    music_url?: string | null;
                    cover_image_url?: string | null;
                    gallery_urls?: Json;
                    theme?: Json;
                    sections?: Json;
                    status?: "draft" | "published" | "archived";
                    published_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["invitations"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "invitations_template_id_fkey";
                        columns: ["template_id"];
                        isOneToOne: false;
                        referencedRelation: "invitation_templates";
                        referencedColumns: ["id"];
                    },
                ];
            };
            rsvps: {
                Row: {
                    id: string;
                    invitation_id: string;
                    guest_name: string;
                    guest_phone: string | null;
                    status: "accepted" | "declined" | "maybe";
                    guest_count: number;
                    message: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    invitation_id: string;
                    guest_name: string;
                    guest_phone?: string | null;
                    status: "accepted" | "declined" | "maybe";
                    guest_count?: number;
                    message?: string | null;
                    created_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["rsvps"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "rsvps_invitation_id_fkey";
                        columns: ["invitation_id"];
                        isOneToOne: false;
                        referencedRelation: "invitations";
                        referencedColumns: ["id"];
                    },
                ];
            };
            guest_wishes: {
                Row: {
                    id: string;
                    invitation_id: string;
                    guest_name: string;
                    message: string;
                    is_approved: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    invitation_id: string;
                    guest_name: string;
                    message: string;
                    is_approved?: boolean;
                    created_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["guest_wishes"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "guest_wishes_invitation_id_fkey";
                        columns: ["invitation_id"];
                        isOneToOne: false;
                        referencedRelation: "invitations";
                        referencedColumns: ["id"];
                    },
                ];
            };
            invitation_events: {
                Row: {
                    id: string;
                    invitation_id: string;
                    event_type:
                        | "view"
                        | "share"
                        | "music_play"
                        | "map_click"
                        | "call_click"
                        | "whatsapp_click"
                        | "rsvp_submit";
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    invitation_id: string;
                    event_type: Database["public"]["Tables"]["invitation_events"]["Row"]["event_type"];
                    metadata?: Json;
                    created_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["invitation_events"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "invitation_events_invitation_id_fkey";
                        columns: ["invitation_id"];
                        isOneToOne: false;
                        referencedRelation: "invitations";
                        referencedColumns: ["id"];
                    },
                ];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};
