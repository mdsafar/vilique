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
                    price_paise: number;
                    currency: string;
                    is_free: boolean;
                    slug: string;
                    is_paid: boolean;
                    metadata: Json;
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
                    price_paise?: number;
                    currency?: string;
                    is_free?: boolean;
                    slug?: string;
                    is_paid?: boolean;
                    metadata?: Json;
                };
                Update: Partial<Database["public"]["Tables"]["invitation_templates"]["Insert"]>;
                Relationships: [];
            };
            template_ratings: {
                Row: {
                    id: string;
                    template_id: string;
                    user_id: string;
                    rating: number;
                    is_hidden: boolean;
                    moderation_reason: string | null;
                    moderated_at: string | null;
                    moderated_by: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    template_id: string;
                    user_id: string;
                    rating: number;
                    is_hidden?: boolean;
                    moderation_reason?: string | null;
                    moderated_at?: string | null;
                    moderated_by?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["template_ratings"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "template_ratings_template_id_fkey";
                        columns: ["template_id"];
                        isOneToOne: false;
                        referencedRelation: "invitation_templates";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "template_ratings_moderated_by_fkey";
                        columns: ["moderated_by"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                ];
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
                    secondary_phone: string | null;
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
                    payment_status: "unpaid" | "paid" | "refunded";
                    lifecycle_status: "draft" | "published" | "completed" | "archived" | "unpublished";
                    original_category: string | null;
                    original_primary_name: string | null;
                    original_secondary_name: string | null;
                    original_event_date: string | null;
                    original_template_id: string | null;
                    first_published_at: string | null;
                    completed_at: string | null;
                    archived_at: string | null;
                    event_timezone: string;
                    change_risk_status: "low" | "medium" | "high";
                    identity_snapshot: Json | null;
                    identity_fingerprint: string | null;
                    event_snapshot: Json | null;
                    event_change_score: number;
                    event_status: "draft" | "published" | "completed" | "archived" | "unpublished";
                    first_payment_id: string | null;
                    publish_version: number;
                    first_publish_version: number | null;
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
                    secondary_phone?: string | null;
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
                    payment_status?: "unpaid" | "paid" | "refunded";
                    lifecycle_status?: "draft" | "published" | "completed" | "archived" | "unpublished";
                    original_category?: string | null;
                    original_primary_name?: string | null;
                    original_secondary_name?: string | null;
                    original_event_date?: string | null;
                    original_template_id?: string | null;
                    first_published_at?: string | null;
                    completed_at?: string | null;
                    archived_at?: string | null;
                    event_timezone?: string;
                    change_risk_status?: "low" | "medium" | "high";
                    identity_snapshot?: Json | null;
                    identity_fingerprint?: string | null;
                    event_snapshot?: Json | null;
                    event_change_score?: number;
                    event_status?: "draft" | "published" | "completed" | "archived" | "unpublished";
                    first_payment_id?: string | null;
                    publish_version?: number;
                    first_publish_version?: number | null;
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
                    guest_token: string;
                    status: "accepted" | "declined" | "maybe";
                    guest_count: number;
                    message: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    invitation_id: string;
                    guest_name: string;
                    guest_phone?: string | null;
                    guest_token: string;
                    status: "accepted" | "declined" | "maybe";
                    guest_count?: number;
                    message?: string | null;
                    created_at?: string;
                    updated_at?: string;
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
            payments: {
                Row: {
                    id: string;
                    user_id: string;
                    invitation_id: string;
                    template_id: string | null;
                    provider: string;
                    provider_order_id: string | null;
                    provider_payment_id: string | null;
                    provider_signature: string | null;
                    amount_paise: number;
                    currency: string;
                    status: "created" | "pending" | "attempted" | "authorized" | "captured" | "reconciling" | "publish_pending" | "published" | "recovery_pending" | "refund_pending" | "refunded" | "partially_refunded" | "failed" | "cancelled" | "manual_review" | "paid";
                    payment_state: "created" | "pending" | "authorized" | "captured" | "failed" | "cancelled" | "refunded";
                    publish_state: "draft" | "publish_pending" | "published" | "failed";
                    recovery_state: "none" | "pending" | "retrying" | "manual_review" | "unrecoverable" | "recovered";
                    refund_state: "none" | "eligible" | "pending" | "processed" | "failed";
                    provider_status: string | null;
                    provider_captured_at: string | null;
                    reconciled_at: string | null;
                    publish_attempt_count: number;
                    last_publish_attempt_at: string | null;
                    last_reconciliation_at: string | null;
                    next_reconciliation_at: string | null;
                    last_error: string | null;
                    provider_refund_id: string | null;
                    refund_amount_paise: number | null;
                    refund_approved_by: string | null;
                    refund_approved_at: string | null;
                    refund_initiated_by: string | null;
                    refund_attempt_count: number;
                    refund_requested_at: string | null;
                    refund_processed_at: string | null;
                    last_refund_reconciliation_at: string | null;
                    next_refund_reconciliation_at: string | null;
                    unrecoverable_at: string | null;
                    manual_review_reason: string | null;
                    invoice_number: string | null;
                    invoice_issued_at: string | null;
                    invoice_version: number;
                    refund_receipt_number: string | null;
                    refund_receipt_issued_at: string | null;
                    refund_reason_public: string | null;
                    failure_code: string | null;
                    failure_description: string | null;
                    receipt: string | null;
                    metadata: Json;
                    paid_at: string | null;
                    refunded_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    invitation_id: string;
                    template_id?: string | null;
                    provider?: string;
                    provider_order_id?: string | null;
                    provider_payment_id?: string | null;
                    provider_signature?: string | null;
                    amount_paise: number;
                    currency?: string;
                    status: Database["public"]["Tables"]["payments"]["Row"]["status"];
                    payment_state?: Database["public"]["Tables"]["payments"]["Row"]["payment_state"];
                    publish_state?: Database["public"]["Tables"]["payments"]["Row"]["publish_state"];
                    recovery_state?: Database["public"]["Tables"]["payments"]["Row"]["recovery_state"];
                    refund_state?: Database["public"]["Tables"]["payments"]["Row"]["refund_state"];
                    provider_status?: string | null;
                    provider_captured_at?: string | null;
                    reconciled_at?: string | null;
                    publish_attempt_count?: number;
                    last_publish_attempt_at?: string | null;
                    last_reconciliation_at?: string | null;
                    next_reconciliation_at?: string | null;
                    last_error?: string | null;
                    provider_refund_id?: string | null;
                    refund_amount_paise?: number | null;
                    refund_approved_by?: string | null;
                    refund_approved_at?: string | null;
                    refund_initiated_by?: string | null;
                    refund_attempt_count?: number;
                    refund_requested_at?: string | null;
                    refund_processed_at?: string | null;
                    last_refund_reconciliation_at?: string | null;
                    next_refund_reconciliation_at?: string | null;
                    unrecoverable_at?: string | null;
                    manual_review_reason?: string | null;
                    invoice_number?: string | null;
                    invoice_issued_at?: string | null;
                    invoice_version?: number;
                    refund_receipt_number?: string | null;
                    refund_receipt_issued_at?: string | null;
                    refund_reason_public?: string | null;
                    failure_code?: string | null;
                    failure_description?: string | null;
                    receipt?: string | null;
                    metadata?: Json;
                    paid_at?: string | null;
                    refunded_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "payments_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "payments_invitation_id_fkey";
                        columns: ["invitation_id"];
                        isOneToOne: false;
                        referencedRelation: "invitations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "payments_template_id_fkey";
                        columns: ["template_id"];
                        isOneToOne: false;
                        referencedRelation: "invitation_templates";
                        referencedColumns: ["id"];
                    }
                ];
            };
            webhook_events: {
                Row: {
                    id: string;
                    provider: string;
                    provider_event_id: string;
                    event_type: string;
                    payload: Json;
                    processing_status: "pending" | "processing" | "processed" | "failed" | "ignored" | "manual_review";
                    attempt_count: number;
                    processing_started_at: string | null;
                    processed_at: string | null;
                    failed_at: string | null;
                    last_error: string | null;
                    error_message: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    provider?: string;
                    provider_event_id: string;
                    event_type: string;
                    payload?: Json;
                    processing_status?: "pending" | "processing" | "processed" | "failed" | "ignored" | "manual_review";
                    attempt_count?: number;
                    processing_started_at?: string | null;
                    processed_at?: string | null;
                    failed_at?: string | null;
                    last_error?: string | null;
                    error_message?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["webhook_events"]["Insert"]>;
                Relationships: [];
            };
            invitation_change_audit: {
                Row: {
                    id: string;
                    invitation_id: string;
                    user_id: string;
                    change_type: string;
                    risk_level: "low" | "medium" | "high";
                    previous_values: Json;
                    proposed_values: Json;
                    decision: "allowed" | "warned" | "blocked" | "duplicated" | "manually_approved";
                    reason: string | null;
                    created_at: string;
                    reviewed_at: string | null;
                    reviewed_by: string | null;
                };
                Insert: {
                    id?: string;
                    invitation_id: string;
                    user_id: string;
                    change_type: string;
                    risk_level: "low" | "medium" | "high";
                    previous_values?: Json;
                    proposed_values?: Json;
                    decision: "allowed" | "warned" | "blocked" | "duplicated" | "manually_approved";
                    reason?: string | null;
                    created_at?: string;
                    reviewed_at?: string | null;
                    reviewed_by?: string | null;
                };
                Update: Partial<Database["public"]["Tables"]["invitation_change_audit"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "invitation_change_audit_invitation_id_fkey";
                        columns: ["invitation_id"];
                        isOneToOne: false;
                        referencedRelation: "invitations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "invitation_change_audit_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    }
                ];
            };
            payment_refund_requests: {
                Row: {
                    id: string;
                    payment_id: string;
                    invitation_id: string | null;
                    provider_payment_id: string;
                    provider_refund_id: string | null;
                    amount_paise: number;
                    currency: string;
                    status: "processing" | "pending" | "processed" | "failed" | "manual_review";
                    requested_by: string | null;
                    requested_source: "admin" | "system" | "cron";
                    public_reason: string;
                    provider_payload: Json;
                    last_error: string | null;
                    attempt_count: number;
                    requested_at: string;
                    provider_created_at: string | null;
                    processed_at: string | null;
                    failed_at: string | null;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    payment_id: string;
                    invitation_id?: string | null;
                    provider_payment_id: string;
                    provider_refund_id?: string | null;
                    amount_paise: number;
                    currency: string;
                    status?: "processing" | "pending" | "processed" | "failed" | "manual_review";
                    requested_by?: string | null;
                    requested_source?: "admin" | "system" | "cron";
                    public_reason: string;
                    provider_payload?: Json;
                    last_error?: string | null;
                    attempt_count?: number;
                    requested_at?: string;
                    provider_created_at?: string | null;
                    processed_at?: string | null;
                    failed_at?: string | null;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["payment_refund_requests"]["Insert"]>;
                Relationships: [];
            };
            request_rate_limits: {
                Row: {
                    bucket_key: string;
                    hit_count: number;
                    reset_at: string;
                    first_seen_at: string;
                    updated_at: string;
                };
                Insert: {
                    bucket_key: string;
                    hit_count?: number;
                    reset_at: string;
                    first_seen_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["request_rate_limits"]["Insert"]>;
                Relationships: [];
            };
            invitation_change_log: {
                Row: {
                    id: string;
                    invitation_id: string;
                    user_id: string;
                    before: Json;
                    after: Json;
                    risk: "low" | "medium" | "high";
                    score: number;
                    decision: "allowed" | "warned" | "blocked" | "duplicated" | "manually_approved";
                    reason: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    invitation_id: string;
                    user_id: string;
                    before?: Json;
                    after?: Json;
                    risk: "low" | "medium" | "high";
                    score?: number;
                    decision: "allowed" | "warned" | "blocked" | "duplicated" | "manually_approved";
                    reason?: string | null;
                    created_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["invitation_change_log"]["Insert"]>;
                Relationships: [
                    {
                        foreignKeyName: "invitation_change_log_invitation_id_fkey";
                        columns: ["invitation_id"];
                        isOneToOne: false;
                        referencedRelation: "invitations";
                        referencedColumns: ["id"];
                    },
                    {
                        foreignKeyName: "invitation_change_log_user_id_fkey";
                        columns: ["user_id"];
                        isOneToOne: false;
                        referencedRelation: "users";
                        referencedColumns: ["id"];
                    }
                ];
            };
        };
        Views: Record<string, never>;
        Functions: {
            claim_razorpay_webhook_event: {
                Args: {
                    p_provider_event_id: string;
                    p_event_type: string;
                    p_payload: Json;
                    p_stale_after?: string;
                };
                Returns: {
                    id: string;
                    provider_event_id: string;
                    event_type: string;
                    processing_status: "pending" | "processing" | "processed" | "failed" | "ignored" | "manual_review";
                    attempt_count: number;
                    claimed: boolean;
                }[];
            };
            claim_unrecoverable_publish_refund: {
                Args: {
                    p_payment_id: string;
                    p_requested_by: string | null;
                    p_requested_source: string;
                    p_public_reason: string;
                    p_manual_approval?: boolean;
                };
                Returns: Json;
            };
            consume_rate_limit: {
                Args: {
                    p_bucket_key: string;
                    p_limit: number;
                    p_window_seconds: number;
                };
                Returns: {
                    allowed: boolean;
                    remaining: number;
                    reset_at: string;
                    hit_count: number;
                }[];
            };
            mark_refund_provider_created: {
                Args: {
                    p_refund_request_id: string;
                    p_provider_refund_id: string;
                    p_provider_payload: Json;
                    p_provider_status?: string;
                };
                Returns: Json;
            };
            mark_refund_provider_failed: {
                Args: {
                    p_refund_request_id: string;
                    p_error: string;
                };
                Returns: undefined;
            };
            can_rate_template: {
                Args: {
                    p_template_id: string;
                    p_user_id: string;
                };
                Returns: boolean;
            };
            get_template_rating_summaries: {
                Args: {
                    p_template_keys: string[];
                };
                Returns: {
                    template_key: string;
                    average_rating: number | null;
                    rating_count: number;
                }[];
            };
            get_public_rsvp: {
                Args: {
                    p_invitation_id: string;
                    p_guest_token: string;
                };
                Returns: {
                    id: string;
                    status: "accepted" | "declined" | "maybe";
                    guest_name: string;
                    guest_phone: string | null;
                    guest_count: number;
                    message: string | null;
                    created_at: string;
                    updated_at: string;
                }[];
            };
            upsert_public_rsvp: {
                Args: {
                    p_invitation_id: string;
                    p_guest_token: string;
                    p_status: "accepted" | "declined" | "maybe";
                    p_guest_name?: string;
                    p_guest_phone?: string | null;
                    p_guest_count?: number;
                    p_message?: string | null;
                };
                Returns: {
                    id: string;
                    status: "accepted" | "declined" | "maybe";
                    guest_name: string;
                    guest_phone: string | null;
                    guest_count: number;
                    message: string | null;
                    created_at: string;
                    updated_at: string;
                }[];
            };
            update_invitation_with_identity_check: {
                Args: {
                    p_invitation_id: string;
                    p_patch: Json;
                    p_user_id: string;
                };
                Returns: Json;
            };
            publish_invitation_with_identity_check: {
                Args: {
                    p_invitation_id: string;
                    p_user_id: string;
                    p_patch: Json;
                };
                Returns: Json;
            };
        };
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};
