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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          api_key_encrypted: string | null
          created_at: string
          current_month_spend: number | null
          id: string
          is_active: boolean | null
          max_tokens: number | null
          metadata: Json | null
          model: string | null
          monthly_budget_cap: number | null
          provider: string | null
          purpose: string | null
          system_prompt: string | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          api_key_encrypted?: string | null
          created_at?: string
          current_month_spend?: number | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          monthly_budget_cap?: number | null
          provider?: string | null
          purpose?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string | null
          created_at?: string
          current_month_spend?: number | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          metadata?: Json | null
          model?: string | null
          monthly_budget_cap?: number | null
          provider?: string | null
          purpose?: string | null
          system_prompt?: string | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          call_type: string | null
          campaign_id: string | null
          company_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string | null
          next_steps: string | null
          outcome: string | null
          recording_url: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          summary: string | null
          transcript: string | null
          twilio_call_sid: string | null
        }
        Insert: {
          call_type?: string | null
          campaign_id?: string | null
          company_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          next_steps?: string | null
          outcome?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
          transcript?: string | null
          twilio_call_sid?: string | null
        }
        Update: {
          call_type?: string | null
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string | null
          next_steps?: string | null
          outcome?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          summary?: string | null
          transcript?: string | null
          twilio_call_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          name: string
          email: string
          mobile: string | null
          channels: Json
          status: string
          invited_by: string | null
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          mobile?: string | null
          channels?: Json
          status?: string
          invited_by?: string | null
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          mobile?: string | null
          channels?: Json
          status?: string
          invited_by?: string | null
          accepted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          calls_made: number | null
          company_id: string
          created_at: string
          deals_won: number | null
          emails_sent: number | null
          estimated_deal_value: number | null
          geographic_focus: string | null
          id: string
          leads_found: number | null
          leads_qualified: number | null
          meetings_booked: number | null
          minimum_score: number | null
          name: string
          proposals_sent: number | null
          replies_received: number | null
          status: string | null
          target_closings_per_month: number | null
          target_criteria: Json | null
          target_description: string | null
          target_meetings_per_week: number | null
          target_proposals_per_week: number | null
          updated_at: string
        }
        Insert: {
          calls_made?: number | null
          company_id: string
          created_at?: string
          deals_won?: number | null
          emails_sent?: number | null
          estimated_deal_value?: number | null
          geographic_focus?: string | null
          id?: string
          leads_found?: number | null
          leads_qualified?: number | null
          meetings_booked?: number | null
          minimum_score?: number | null
          name: string
          proposals_sent?: number | null
          replies_received?: number | null
          status?: string | null
          target_closings_per_month?: number | null
          target_criteria?: Json | null
          target_description?: string | null
          target_meetings_per_week?: number | null
          target_proposals_per_week?: number | null
          updated_at?: string
        }
        Update: {
          calls_made?: number | null
          company_id?: string
          created_at?: string
          deals_won?: number | null
          emails_sent?: number | null
          estimated_deal_value?: number | null
          geographic_focus?: string | null
          id?: string
          leads_found?: number | null
          leads_qualified?: number | null
          meetings_booked?: number | null
          minimum_score?: number | null
          name?: string
          proposals_sent?: number | null
          replies_received?: number | null
          status?: string | null
          target_closings_per_month?: number | null
          target_criteria?: Json | null
          target_description?: string | null
          target_meetings_per_week?: number | null
          target_proposals_per_week?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          actions_taken: Json | null
          ai_model_used: string | null
          company_id: string | null
          content: string
          context: string | null
          created_at: string
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          actions_taken?: Json | null
          ai_model_used?: string | null
          company_id?: string | null
          content: string
          context?: string | null
          created_at?: string
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          actions_taken?: Json | null
          ai_model_used?: string | null
          company_id?: string | null
          content?: string
          context?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ai_profile: Json | null
          autonomy_level: number | null
          contact_name: string | null
          contact_role: string | null
          created_at: string
          description: string | null
          fleet_or_inventory: Json | null
          geographic_range: string | null
          id: string
          industry: string | null
          name: string
          outreach_languages: string[] | null
          owner_id: string | null
          pricing_summary: string | null
          selling_points: Json | null
          services: Json | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_plan: string | null
          target_markets: Json | null
          tone_preference: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          ai_profile?: Json | null
          autonomy_level?: number | null
          contact_name?: string | null
          contact_role?: string | null
          created_at?: string
          description?: string | null
          fleet_or_inventory?: Json | null
          geographic_range?: string | null
          id?: string
          industry?: string | null
          name: string
          outreach_languages?: string[] | null
          owner_id?: string | null
          pricing_summary?: string | null
          selling_points?: Json | null
          services?: Json | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string | null
          target_markets?: Json | null
          tone_preference?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          ai_profile?: Json | null
          autonomy_level?: number | null
          contact_name?: string | null
          contact_role?: string | null
          created_at?: string
          description?: string | null
          fleet_or_inventory?: Json | null
          geographic_range?: string | null
          id?: string
          industry?: string | null
          name?: string
          outreach_languages?: string[] | null
          owner_id?: string | null
          pricing_summary?: string | null
          selling_points?: Json | null
          services?: Json | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_plan?: string | null
          target_markets?: Json | null
          tone_preference?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_companies_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          api_key_encrypted: string | null
          company_id: string | null
          created_at: string
          daily_send_limit: number | null
          id: string
          provider: string | null
          sender_name: string | null
          sending_domain: string | null
          sending_email: string | null
          updated_at: string
          warmup_started_at: string | null
          warmup_status: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          company_id?: string | null
          created_at?: string
          daily_send_limit?: number | null
          id?: string
          provider?: string | null
          sender_name?: string | null
          sending_domain?: string | null
          sending_email?: string | null
          updated_at?: string
          warmup_started_at?: string | null
          warmup_status?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          company_id?: string | null
          created_at?: string
          daily_send_limit?: number | null
          id?: string
          provider?: string | null
          sender_name?: string | null
          sending_domain?: string | null
          sending_email?: string | null
          updated_at?: string
          warmup_started_at?: string | null
          warmup_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_replies: {
        Row: {
          ai_draft_approved: boolean | null
          ai_draft_response: string | null
          body: string
          created_at: string
          from_email: string | null
          handled_by: string | null
          id: string
          intent: string | null
          lead_id: string
          outreach_email_id: string | null
          sent_response: string | null
          subject: string | null
        }
        Insert: {
          ai_draft_approved?: boolean | null
          ai_draft_response?: string | null
          body: string
          created_at?: string
          from_email?: string | null
          handled_by?: string | null
          id?: string
          intent?: string | null
          lead_id: string
          outreach_email_id?: string | null
          sent_response?: string | null
          subject?: string | null
        }
        Update: {
          ai_draft_approved?: boolean | null
          ai_draft_response?: string | null
          body?: string
          created_at?: string
          from_email?: string | null
          handled_by?: string | null
          id?: string
          intent?: string | null
          lead_id?: string
          outreach_email_id?: string | null
          sent_response?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_replies_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_replies_outreach_email_id_fkey"
            columns: ["outreach_email_id"]
            isOneToOne: false
            referencedRelation: "outreach_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          business_name: string
          campaign_id: string | null
          city: string | null
          company_id: string
          contact_email: string | null
          contact_linkedin_url: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          country: string | null
          created_at: string
          description: string | null
          email: string | null
          enrichment_source: string | null
          id: string
          industry: string | null
          phone: string | null
          rating: number | null
          region: string | null
          research_data: Json | null
          review_count: number | null
          score: number | null
          score_reasoning: string | null
          size_estimate: string | null
          source: string | null
          status: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          campaign_id?: string | null
          city?: string | null
          company_id: string
          contact_email?: string | null
          contact_linkedin_url?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          enrichment_source?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          rating?: number | null
          region?: string | null
          research_data?: Json | null
          review_count?: number | null
          score?: number | null
          score_reasoning?: string | null
          size_estimate?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          campaign_id?: string | null
          city?: string | null
          company_id?: string
          contact_email?: string | null
          contact_linkedin_url?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          enrichment_source?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          rating?: number | null
          region?: string | null
          research_data?: Json | null
          review_count?: number | null
          score?: number | null
          score_reasoning?: string | null
          size_estimate?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          ai_model_used: string | null
          body: string
          campaign_id: string | null
          channel: string | null
          clicked_at: string | null
          company_id: string
          created_at: string
          email_type: string | null
          id: string
          lead_id: string
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          sequence_step_id: string | null
          status: string | null
          subject: string
        }
        Insert: {
          ai_model_used?: string | null
          body: string
          campaign_id?: string | null
          channel?: string | null
          clicked_at?: string | null
          company_id: string
          created_at?: string
          email_type?: string | null
          id?: string
          lead_id: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_step_id?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          ai_model_used?: string | null
          body?: string
          campaign_id?: string | null
          channel?: string | null
          clicked_at?: string | null
          company_id?: string
          created_at?: string
          email_type?: string | null
          id?: string
          lead_id?: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          sequence_step_id?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          company_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          monthly_amount: number | null
          plan: string | null
          setup_fee_paid: boolean | null
          status: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_amount?: number | null
          plan?: string | null
          setup_fee_paid?: boolean | null
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          monthly_amount?: number | null
          plan?: string | null
          setup_fee_paid?: boolean | null
          status?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      },
      api_keys: {
        Row: {
          id: string
          key_name: string
          key_value: string
          label: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key_name: string
          key_value: string
          label?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key_name?: string
          key_value?: string
          label?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
    Enums: {
      app_role: ["admin", "client"],
    },
  },
} as const
