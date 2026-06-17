/**
 * Supabase generated types — placeholder.
 * Run `pnpm db:types` after applying migrations to regenerate.
 *
 * This is a hand-written stub covering the v1 schema so the codebase
 * is type-safe before the live Supabase project is provisioned.
 *
 * NOTE: each table includes `Relationships: []` because @supabase/postgrest-js
 * requires the `Relationships` key on every table to satisfy its GenericTable
 * constraint. Without it the schema generic collapses and every `.from().select()`
 * row resolves to `never`. Regenerate via `pnpm db:types` once the live schema
 * exists — that also captures real foreign-key relationships and nullability drift.
 *
 * 2026-06-04 (Phase 2): synced with `20260605000000_phase1_reconciliation.sql`
 *   - dropped `messages` (Intercom owns chat)
 *   - added `invoices.hosted_invoice_url`
 *   - added `work_orders` + `work_order_attachments`
 *
 * 2026-06-15 (Phase 3): synced with `20260615000000_phase3_stripe_customer_id.sql`
 *   - added `profiles.stripe_customer_id` (lazy-created on first invoice)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkOrderServiceType =
  | "logo"
  | "website_update"
  | "data_export"
  | "consulting"
  | "other";

export type WorkOrderStatus =
  | "open"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "delivered"
  | "closed"
  | "cancelled";

export type WorkOrderPriority = "low" | "normal" | "high";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          company: string | null;
          avatar_url: string | null;
          apollo_contact_id: string | null;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_user_id: string;
          title: string;
          description: string | null;
          status: "proposed" | "active" | "delivered" | "closed";
          started_at: string | null;
          delivered_at: string | null;
          total_cents: number;
          stripe_link: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          owner_user_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
        Relationships: [];
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          storage_path: string;
          filename: string;
          mime: string | null;
          size_bytes: number | null;
          uploaded_by: string;
          uploaded_at: string;
          retention_until: string;
        };
        Insert: Partial<Database["public"]["Tables"]["project_files"]["Row"]> & {
          project_id: string;
          storage_path: string;
          filename: string;
          uploaded_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_files"]["Row"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          project_id: string;
          amount_cents: number;
          currency: string;
          status: "open" | "paid" | "void" | "overdue";
          stripe_invoice_id: string | null;
          stripe_payment_intent: string | null;
          hosted_invoice_url: string | null;
          due_date: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          project_id: string;
          amount_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          company: string | null;
          apollo_contact_id: string | null;
          source: "book" | "form" | "email" | "typeform" | "other";
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_term: string | null;
          utm_content: string | null;
          referrer: string | null;
          first_seen: string;
          last_seen: string;
          raw_payload: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["leads"]["Row"]> & { email: string };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          lead_id: string | null;
          email: string;
          name: string | null;
          scheduled_at: string;
          duration_minutes: number;
          meeting_url: string | null;
          apollo_meeting_id: string | null;
          google_event_id: string | null;
          status: "scheduled" | "completed" | "cancelled" | "noshow";
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]> & {
          email: string;
          scheduled_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
        Relationships: [];
      };
      page_events: {
        Row: {
          id: string;
          session_id: string;
          user_id: string | null;
          event_name: string;
          properties: Json;
          page_path: string | null;
          occurred_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["page_events"]["Row"]> & {
          session_id: string;
          event_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_events"]["Row"]>;
        Relationships: [];
      };
      work_orders: {
        Row: {
          id: string;
          created_by: string;
          project_id: string | null;
          service_type: WorkOrderServiceType;
          title: string;
          description: string | null;
          status: WorkOrderStatus;
          priority: WorkOrderPriority;
          quoted_amount_cents: number | null;
          quoted_at: string | null;
          accepted_at: string | null;
          invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["work_orders"]["Row"]> & {
          created_by: string;
          service_type: WorkOrderServiceType;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_orders"]["Row"]>;
        Relationships: [];
      };
      work_order_attachments: {
        Row: {
          id: string;
          work_order_id: string;
          storage_path: string;
          filename: string;
          mime_type: string | null;
          size_bytes: number | null;
          uploaded_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["work_order_attachments"]["Row"]> & {
          work_order_id: string;
          storage_path: string;
          filename: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_order_attachments"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
