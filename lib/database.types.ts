/**
 * Supabase generated types — placeholder.
 * Run `pnpm db:types` after applying migrations to regenerate.
 *
 * This is a hand-written stub covering the v1 schema so the codebase
 * is type-safe before the live Supabase project is provisioned.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
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
          due_date: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          project_id: string;
          amount_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          from_user_id: string;
          to_user_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          thread_id: string;
          from_user_id: string;
          to_user_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
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
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
