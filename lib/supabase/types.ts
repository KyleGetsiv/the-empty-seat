export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          company_id: string
          country: string
          created_at: string
          external_keys: Json
          id: string
          latitude: number | null
          launch_date: string | null
          longitude: number | null
          metro_area: string | null
          name: string
          notes: string | null
          program_id: string | null
          public_access_date: string | null
          service_area_sq_mi: number | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          country?: string
          created_at?: string
          external_keys?: Json
          id?: string
          latitude?: number | null
          launch_date?: string | null
          longitude?: number | null
          metro_area?: string | null
          name: string
          notes?: string | null
          program_id?: string | null
          public_access_date?: string | null
          service_area_sq_mi?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          country?: string
          created_at?: string
          external_keys?: Json
          id?: string
          latitude?: number | null
          launch_date?: string | null
          longitude?: number | null
          metro_area?: string | null
          name?: string
          notes?: string | null
          program_id?: string | null
          public_access_date?: string | null
          service_area_sq_mi?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "operator_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          display_name: string
          founded_year: number | null
          hq_country: string | null
          id: string
          ownership: string | null
          parent_company: string | null
          slug: string
          status_summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          founded_year?: number | null
          hq_country?: string | null
          id?: string
          ownership?: string | null
          parent_company?: string | null
          slug: string
          status_summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          founded_year?: number | null
          hq_country?: string | null
          id?: string
          ownership?: string | null
          parent_company?: string | null
          slug?: string
          status_summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      competitor_snapshots: {
        Row: {
          autonomous_miles_cumulative: number | null
          cities_operating_total: number | null
          cities_serving_public: number | null
          created_at: string
          cumulative_rides: number | null
          disclosure_quality: string
          funding_total_usd: number | null
          id: string
          implied_valuation_usd: number | null
          notes: string | null
          program_id: string
          snapshot_date: string
          source_id: string | null
          supervision: string | null
          updated_at: string
          vehicle_count: number | null
          weekly_rides: number | null
        }
        Insert: {
          autonomous_miles_cumulative?: number | null
          cities_operating_total?: number | null
          cities_serving_public?: number | null
          created_at?: string
          cumulative_rides?: number | null
          disclosure_quality?: string
          funding_total_usd?: number | null
          id?: string
          implied_valuation_usd?: number | null
          notes?: string | null
          program_id: string
          snapshot_date: string
          source_id?: string | null
          supervision?: string | null
          updated_at?: string
          vehicle_count?: number | null
          weekly_rides?: number | null
        }
        Update: {
          autonomous_miles_cumulative?: number | null
          cities_operating_total?: number | null
          cities_serving_public?: number | null
          created_at?: string
          cumulative_rides?: number | null
          disclosure_quality?: string
          funding_total_usd?: number | null
          id?: string
          implied_valuation_usd?: number | null
          notes?: string | null
          program_id?: string
          snapshot_date?: string
          source_id?: string | null
          supervision?: string | null
          updated_at?: string
          vehicle_count?: number | null
          weekly_rides?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_snapshots_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "operator_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_snapshots_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      disclosed_metrics: {
        Row: {
          as_of: string
          attribution: string
          company_id: string
          created_at: string
          id: string
          metric: string
          notes: string | null
          scope: string
          source_id: string | null
          stated_by: string | null
          updated_at: string
          value: number
        }
        Insert: {
          as_of: string
          attribution?: string
          company_id: string
          created_at?: string
          id?: string
          metric: string
          notes?: string | null
          scope?: string
          source_id?: string | null
          stated_by?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          as_of?: string
          attribution?: string
          company_id?: string
          created_at?: string
          id?: string
          metric?: string
          notes?: string | null
          scope?: string
          source_id?: string | null
          stated_by?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "disclosed_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disclosed_metrics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings_events: {
        Row: {
          accession_number: string | null
          company_id: string
          created_at: string
          error: string | null
          event_date: string
          event_type: string
          extraction_model: string | null
          extraction_version: number | null
          fiscal_period: string
          id: string
          processed_at: string | null
          processing_status: string
          source_id: string | null
          storage_key: string | null
          subject_company_id: string
          updated_at: string
        }
        Insert: {
          accession_number?: string | null
          company_id: string
          created_at?: string
          error?: string | null
          event_date: string
          event_type: string
          extraction_model?: string | null
          extraction_version?: number | null
          fiscal_period: string
          id?: string
          processed_at?: string | null
          processing_status?: string
          source_id?: string | null
          storage_key?: string | null
          subject_company_id: string
          updated_at?: string
        }
        Update: {
          accession_number?: string | null
          company_id?: string
          created_at?: string
          error?: string | null
          event_date?: string
          event_type?: string
          extraction_model?: string | null
          extraction_version?: number | null
          fiscal_period?: string
          id?: string
          processed_at?: string | null
          processing_status?: string
          source_id?: string | null
          storage_key?: string | null
          subject_company_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_events_subject_company_id_fkey"
            columns: ["subject_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          capex_usd: number | null
          company_id: string
          created_at: string
          fiscal_period: string
          id: string
          is_disclosed: boolean
          methodology_note: string | null
          operating_loss_usd: number | null
          opex_usd: number | null
          period_end: string
          period_start: string
          revenue_usd: number | null
          source_id: string | null
          updated_at: string
        }
        Insert: {
          capex_usd?: number | null
          company_id: string
          created_at?: string
          fiscal_period: string
          id?: string
          is_disclosed?: boolean
          methodology_note?: string | null
          operating_loss_usd?: number | null
          opex_usd?: number | null
          period_end: string
          period_start: string
          revenue_usd?: number | null
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          capex_usd?: number | null
          company_id?: string
          created_at?: string
          fiscal_period?: string
          id?: string
          is_disclosed?: boolean
          methodology_note?: string | null
          operating_loss_usd?: number | null
          opex_usd?: number | null
          period_end?: string
          period_start?: string
          revenue_usd?: number | null
          source_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_snapshots: {
        Row: {
          active_vehicle_count: number | null
          city_id: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          snapshot_date: string
          source_id: string | null
          vehicle_count: number
        }
        Insert: {
          active_vehicle_count?: number | null
          city_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          snapshot_date: string
          source_id?: string | null
          vehicle_count: number
        }
        Update: {
          active_vehicle_count?: number | null
          city_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          snapshot_date?: string
          source_id?: string | null
          vehicle_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fleet_snapshots_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_snapshots_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          event_date: string
          headline: string
          id: string
          is_published: boolean
          kyle_annotation: string | null
          source_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          event_date: string
          headline: string
          id?: string
          is_published?: boolean
          kyle_annotation?: string | null
          source_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          event_date?: string
          headline?: string
          id?: string
          is_published?: boolean
          kyle_annotation?: string | null
          source_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_program_roles: {
        Row: {
          company_id: string
          program_id: string
          role: string
        }
        Insert: {
          company_id: string
          program_id: string
          role: string
        }
        Update: {
          company_id?: string
          program_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_program_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_program_roles_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "operator_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_programs: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          lead_company_id: string
          slug: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          lead_company_id: string
          slug: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          lead_company_id?: string
          slug?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_programs_lead_company_id_fkey"
            columns: ["lead_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_estimates: {
        Row: {
          avg_fare_usd: number | null
          city_id: string | null
          company_id: string
          confidence: string
          created_at: string
          id: string
          methodology_note: string | null
          period_end: string
          period_start: string
          program_id: string | null
          rides_per_week: number
          source_id: string | null
          tier: string | null
          vehicle_miles_traveled: number | null
        }
        Insert: {
          avg_fare_usd?: number | null
          city_id?: string | null
          company_id: string
          confidence: string
          created_at?: string
          id?: string
          methodology_note?: string | null
          period_end: string
          period_start: string
          rides_per_week: number
          source_id?: string | null
          tier?: string | null
          vehicle_miles_traveled?: number | null
        }
        Update: {
          avg_fare_usd?: number | null
          city_id?: string | null
          company_id?: string
          confidence?: string
          created_at?: string
          id?: string
          methodology_note?: string | null
          period_end?: string
          period_start?: string
          program_id?: string | null
          rides_per_week?: number
          source_id?: string | null
          tier?: string | null
          vehicle_miles_traveled?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_estimates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "operator_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_estimates_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_estimates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          key: string
          markdown_body: string
          updated_at: string
        }
        Insert: {
          key: string
          markdown_body: string
          updated_at?: string
        }
        Update: {
          key?: string
          markdown_body?: string
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          content_hash: string | null
          created_at: string
          id: string
          published_at: string | null
          publisher: string
          scraped_at: string | null
          storage_key: string | null
          title: string
          url: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          publisher: string
          scraped_at?: string | null
          storage_key?: string | null
          title: string
          url: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          publisher?: string
          scraped_at?: string | null
          storage_key?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      waymo_mentions: {
        Row: {
          confidence: string
          created_at: string
          disclosed_metric_id: string | null
          earnings_event_id: string
          extracted_metric: Json | null
          id: string
          kyle_annotation: string | null
          mention_type: string
          page_or_timestamp: string | null
          quote_text: string
          review_status: string
          speaker: string | null
          updated_at: string
        }
        Insert: {
          confidence: string
          created_at?: string
          disclosed_metric_id?: string | null
          earnings_event_id: string
          extracted_metric?: Json | null
          id?: string
          kyle_annotation?: string | null
          mention_type: string
          page_or_timestamp?: string | null
          quote_text: string
          review_status?: string
          speaker?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: string
          created_at?: string
          disclosed_metric_id?: string | null
          earnings_event_id?: string
          extracted_metric?: Json | null
          id?: string
          kyle_annotation?: string | null
          mention_type?: string
          page_or_timestamp?: string | null
          quote_text?: string
          review_status?: string
          speaker?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waymo_mentions_earnings_event_id_fkey"
            columns: ["earnings_event_id"]
            isOneToOne: false
            referencedRelation: "earnings_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waymo_mentions_disclosed_metric_id_fkey"
            columns: ["disclosed_metric_id"]
            isOneToOne: false
            referencedRelation: "disclosed_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
