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
          id: string
          latitude: number | null
          launch_date: string | null
          longitude: number | null
          metro_area: string | null
          name: string
          notes: string | null
          public_access_date: string | null
          service_area_sq_mi: number | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          country?: string
          created_at?: string
          id?: string
          latitude?: number | null
          launch_date?: string | null
          longitude?: number | null
          metro_area?: string | null
          name: string
          notes?: string | null
          public_access_date?: string | null
          service_area_sq_mi?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          country?: string
          created_at?: string
          id?: string
          latitude?: number | null
          launch_date?: string | null
          longitude?: number | null
          metro_area?: string | null
          name?: string
          notes?: string | null
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
        ]
      }
      companies: {
        Row: {
          created_at: string
          display_name: string
          founded_year: number | null
          id: string
          parent_company: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          founded_year?: number | null
          id?: string
          parent_company?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          founded_year?: number | null
          id?: string
          parent_company?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
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
          rides_per_week: number
          source_id: string | null
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
          rides_per_week?: number
          source_id?: string | null
        }
        Relationships: [
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
