export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          data: Json | null;
          id: string;
          target_id: string | null;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: string;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      asset_entitlements: {
        Row: {
          asset_id: string;
          company_id: string | null;
          granted_at: string;
          id: string;
          source: string;
          stripe_checkout_session_id: string | null;
          user_id: string | null;
        };
        Insert: {
          asset_id: string;
          company_id?: string | null;
          granted_at?: string;
          id?: string;
          source?: string;
          stripe_checkout_session_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          asset_id?: string;
          company_id?: string | null;
          granted_at?: string;
          id?: string;
          source?: string;
          stripe_checkout_session_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "asset_entitlements_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "digital_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_entitlements_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          apollo_meeting_id: string | null;
          created_at: string;
          duration_minutes: number;
          email: string;
          google_event_id: string | null;
          id: string;
          lead_id: string | null;
          meeting_url: string | null;
          name: string | null;
          notes: string | null;
          scheduled_at: string;
          status: Database["public"]["Enums"]["booking_status"];
        };
        Insert: {
          apollo_meeting_id?: string | null;
          created_at?: string;
          duration_minutes?: number;
          email: string;
          google_event_id?: string | null;
          id?: string;
          lead_id?: string | null;
          meeting_url?: string | null;
          name?: string | null;
          notes?: string | null;
          scheduled_at: string;
          status?: Database["public"]["Enums"]["booking_status"];
        };
        Update: {
          apollo_meeting_id?: string | null;
          created_at?: string;
          duration_minutes?: number;
          email?: string;
          google_event_id?: string | null;
          id?: string;
          lead_id?: string | null;
          meeting_url?: string | null;
          name?: string | null;
          notes?: string | null;
          scheduled_at?: string;
          status?: Database["public"]["Enums"]["booking_status"];
        };
        Relationships: [
          {
            foreignKeyName: "bookings_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          status: string;
          stripe_customer_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          status?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          status?: string;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "company_roles";
            referencedColumns: ["key"];
          },
        ];
      };
      company_roles: {
        Row: {
          created_at: string;
          key: string;
          label: string;
          rank: number;
        };
        Insert: {
          created_at?: string;
          key: string;
          label: string;
          rank: number;
        };
        Update: {
          created_at?: string;
          key?: string;
          label?: string;
          rank?: number;
        };
        Relationships: [];
      };
      digital_assets: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          id: string;
          price_cents: number | null;
          storage_path: string;
          stripe_product_id: string | null;
          title: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          price_cents?: number | null;
          storage_path: string;
          stripe_product_id?: string | null;
          title: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          price_cents?: number | null;
          storage_path?: string;
          stripe_product_id?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          due_date: string | null;
          hosted_invoice_url: string | null;
          id: string;
          paid_at: string | null;
          project_id: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          stripe_invoice_id: string | null;
          stripe_payment_intent: string | null;
          user_id: string | null;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          due_date?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          paid_at?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          stripe_invoice_id?: string | null;
          stripe_payment_intent?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          due_date?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          paid_at?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          stripe_invoice_id?: string | null;
          stripe_payment_intent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          apollo_contact_id: string | null;
          company: string | null;
          email: string;
          first_seen: string;
          id: string;
          last_seen: string;
          name: string | null;
          raw_payload: Json;
          referrer: string | null;
          source: Database["public"]["Enums"]["lead_source"];
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
        };
        Insert: {
          apollo_contact_id?: string | null;
          company?: string | null;
          email: string;
          first_seen?: string;
          id?: string;
          last_seen?: string;
          name?: string | null;
          raw_payload?: Json;
          referrer?: string | null;
          source?: Database["public"]["Enums"]["lead_source"];
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Update: {
          apollo_contact_id?: string | null;
          company?: string | null;
          email?: string;
          first_seen?: string;
          id?: string;
          last_seen?: string;
          name?: string | null;
          raw_payload?: Json;
          referrer?: string | null;
          source?: Database["public"]["Enums"]["lead_source"];
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Relationships: [];
      };
      page_events: {
        Row: {
          event_name: string;
          id: string;
          occurred_at: string;
          page_path: string | null;
          properties: Json;
          session_id: string;
          user_id: string | null;
        };
        Insert: {
          event_name: string;
          id?: string;
          occurred_at?: string;
          page_path?: string | null;
          properties?: Json;
          session_id: string;
          user_id?: string | null;
        };
        Update: {
          event_name?: string;
          id?: string;
          occurred_at?: string;
          page_path?: string | null;
          properties?: Json;
          session_id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          apollo_contact_id: string | null;
          avatar_url: string | null;
          company: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          notify_email: boolean;
          phone: string | null;
          stripe_customer_id: string | null;
          updated_at: string;
        };
        Insert: {
          apollo_contact_id?: string | null;
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          notify_email?: boolean;
          phone?: string | null;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Update: {
          apollo_contact_id?: string | null;
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          notify_email?: boolean;
          phone?: string | null;
          stripe_customer_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_files: {
        Row: {
          filename: string;
          id: string;
          mime: string | null;
          project_id: string;
          retention_until: string;
          size_bytes: number | null;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
        };
        Insert: {
          filename: string;
          id?: string;
          mime?: string | null;
          project_id: string;
          retention_until?: string;
          size_bytes?: number | null;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
        };
        Update: {
          filename?: string;
          id?: string;
          mime?: string | null;
          project_id?: string;
          retention_until?: string;
          size_bytes?: number | null;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          company_id: string | null;
          created_at: string;
          delivered_at: string | null;
          description: string | null;
          id: string;
          owner_user_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["project_status"];
          stripe_link: string | null;
          title: string;
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          description?: string | null;
          id?: string;
          owner_user_id: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          stripe_link?: string | null;
          title: string;
          total_cents?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          description?: string | null;
          id?: string;
          owner_user_id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          stripe_link?: string | null;
          title?: string;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      typeform_budget_intakes: {
        Row: {
          budget_band_label: string | null;
          budget_band_ref: string | null;
          company: string | null;
          email: string | null;
          event_id: string | null;
          form_id: string;
          id: string;
          mapping_status: string;
          mapping_warnings: Json;
          name: string | null;
          project_summary: string | null;
          raw_payload: Json;
          received_at: string;
          response_token: string;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          service_family_label: string | null;
          service_family_ref: string | null;
          status: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          budget_band_label?: string | null;
          budget_band_ref?: string | null;
          company?: string | null;
          email?: string | null;
          event_id?: string | null;
          form_id: string;
          id?: string;
          mapping_status?: string;
          mapping_warnings?: Json;
          name?: string | null;
          project_summary?: string | null;
          raw_payload: Json;
          received_at?: string;
          response_token: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          service_family_label?: string | null;
          service_family_ref?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          budget_band_label?: string | null;
          budget_band_ref?: string | null;
          company?: string | null;
          email?: string | null;
          event_id?: string | null;
          form_id?: string;
          id?: string;
          mapping_status?: string;
          mapping_warnings?: Json;
          name?: string | null;
          project_summary?: string | null;
          raw_payload?: Json;
          received_at?: string;
          response_token?: string;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          service_family_label?: string | null;
          service_family_ref?: string | null;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_order_attachments: {
        Row: {
          filename: string;
          id: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          uploaded_at: string;
          work_order_id: string;
        };
        Insert: {
          filename: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          uploaded_at?: string;
          work_order_id: string;
        };
        Update: {
          filename?: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          uploaded_at?: string;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_attachments_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      work_orders: {
        Row: {
          accepted_at: string | null;
          cancelled_at: string | null;
          closed_at: string | null;
          company_id: string | null;
          created_at: string;
          created_by: string;
          delivered_at: string | null;
          description: string | null;
          id: string;
          in_progress_at: string | null;
          invoice_id: string | null;
          priority: Database["public"]["Enums"]["work_order_priority"];
          project_id: string | null;
          quoted_amount_cents: number | null;
          quoted_at: string | null;
          service_type: Database["public"]["Enums"]["work_order_service_type"];
          status: Database["public"]["Enums"]["work_order_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          cancelled_at?: string | null;
          closed_at?: string | null;
          company_id?: string | null;
          created_at?: string;
          created_by: string;
          delivered_at?: string | null;
          description?: string | null;
          id?: string;
          in_progress_at?: string | null;
          invoice_id?: string | null;
          priority?: Database["public"]["Enums"]["work_order_priority"];
          project_id?: string | null;
          quoted_amount_cents?: number | null;
          quoted_at?: string | null;
          service_type: Database["public"]["Enums"]["work_order_service_type"];
          status?: Database["public"]["Enums"]["work_order_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          cancelled_at?: string | null;
          closed_at?: string | null;
          company_id?: string | null;
          created_at?: string;
          created_by?: string;
          delivered_at?: string | null;
          description?: string | null;
          id?: string;
          in_progress_at?: string | null;
          invoice_id?: string | null;
          priority?: Database["public"]["Enums"]["work_order_priority"];
          project_id?: string | null;
          quoted_amount_cents?: number | null;
          quoted_at?: string | null;
          service_type?: Database["public"]["Enums"]["work_order_service_type"];
          status?: Database["public"]["Enums"]["work_order_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_orders_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_orders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      company_role_rank: { Args: { cid: string }; Returns: number };
      is_company_member: { Args: { cid: string }; Returns: boolean };
    };
    Enums: {
      booking_status: "scheduled" | "completed" | "cancelled" | "noshow";
      invoice_status: "open" | "paid" | "void" | "overdue";
      lead_source: "book" | "form" | "email" | "typeform" | "other";
      project_status: "proposed" | "active" | "delivered" | "closed";
      work_order_priority: "low" | "normal" | "high";
      work_order_service_type:
        | "logo"
        | "website_update"
        | "data_export"
        | "consulting"
        | "other";
      work_order_status:
        | "open"
        | "quoted"
        | "accepted"
        | "in_progress"
        | "delivered"
        | "closed"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status: ["scheduled", "completed", "cancelled", "noshow"],
      invoice_status: ["open", "paid", "void", "overdue"],
      lead_source: ["book", "form", "email", "typeform", "other"],
      project_status: ["proposed", "active", "delivered", "closed"],
      work_order_priority: ["low", "normal", "high"],
      work_order_service_type: [
        "logo",
        "website_update",
        "data_export",
        "consulting",
        "other",
      ],
      work_order_status: [
        "open",
        "quoted",
        "accepted",
        "in_progress",
        "delivered",
        "closed",
        "cancelled",
      ],
    },
  },
} as const;
