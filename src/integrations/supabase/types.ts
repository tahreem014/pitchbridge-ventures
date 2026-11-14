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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      agreement_confirmations: {
        Row: {
          agreement_id: string
          confirmed_at: string
          email: string | null
          id: string
          ip_address: string | null
          name: string | null
          party: string
          terms_hash: string
          user_agent: string | null
          user_id: string
          version: number
        }
        Insert: {
          agreement_id: string
          confirmed_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          name?: string | null
          party: string
          terms_hash: string
          user_agent?: string | null
          user_id: string
          version: number
        }
        Update: {
          agreement_id?: string
          confirmed_at?: string
          email?: string | null
          id?: string
          ip_address?: string | null
          name?: string | null
          party?: string
          terms_hash?: string
          user_agent?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreement_confirmations_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_events: {
        Row: {
          actor_id: string | null
          agreement_id: string
          created_at: string
          details: Json | null
          event: string
          id: string
          version: number | null
        }
        Insert: {
          actor_id?: string | null
          agreement_id: string
          created_at?: string
          details?: Json | null
          event: string
          id?: string
          version?: number | null
        }
        Update: {
          actor_id?: string | null
          agreement_id?: string
          created_at?: string
          details?: Json | null
          event?: string
          id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          agreement_type: string
          amount: number
          cancelled_at: string | null
          created_at: string
          entrepreneur_id: string
          executed_at: string | null
          id: string
          idea_id: string
          investor_id: string
          parties: Json | null
          proposal_id: string
          status: string
          template_version: string
          terms: Json
          terms_hash: string
          updated_at: string
          version: number
        }
        Insert: {
          agreement_type: string
          amount: number
          cancelled_at?: string | null
          created_at?: string
          entrepreneur_id: string
          executed_at?: string | null
          id?: string
          idea_id: string
          investor_id: string
          parties?: Json | null
          proposal_id: string
          status?: string
          template_version?: string
          terms: Json
          terms_hash: string
          updated_at?: string
          version?: number
        }
        Update: {
          agreement_type?: string
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          entrepreneur_id?: string
          executed_at?: string | null
          id?: string
          idea_id?: string
          investor_id?: string
          parties?: Json | null
          proposal_id?: string
          status?: string
          template_version?: string
          terms?: Json
          terms_hash?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreements_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_pitch_details: {
        Row: {
          business_model: string | null
          created_at: string
          financial_estimates: string | null
          idea_id: string
          market_research: string | null
          target_customers: string | null
          updated_at: string
        }
        Insert: {
          business_model?: string | null
          created_at?: string
          financial_estimates?: string | null
          idea_id: string
          market_research?: string | null
          target_customers?: string | null
          updated_at?: string
        }
        Update: {
          business_model?: string | null
          created_at?: string
          financial_estimates?: string | null
          idea_id?: string
          market_research?: string | null
          target_customers?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_pitch_details_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: true
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      idea_views: {
        Row: {
          created_at: string
          id: string
          idea_id: string
          viewed_on: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idea_id: string
          viewed_on?: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idea_id?: string
          viewed_on?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_views_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          category: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          equity_offered: number | null
          funding_raised: number
          funding_target: number
          has_detailed_pitch: boolean
          id: string
          stage: Database["public"]["Enums"]["idea_stage"]
          status: Database["public"]["Enums"]["idea_status"]
          tagline: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
          views_count: number
          visibility: Database["public"]["Enums"]["idea_visibility"]
        }
        Insert: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          equity_offered?: number | null
          funding_raised?: number
          funding_target?: number
          has_detailed_pitch?: boolean
          id?: string
          stage?: Database["public"]["Enums"]["idea_stage"]
          status?: Database["public"]["Enums"]["idea_status"]
          tagline?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
          views_count?: number
          visibility?: Database["public"]["Enums"]["idea_visibility"]
        }
        Update: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          equity_offered?: number | null
          funding_raised?: number
          funding_target?: number
          has_detailed_pitch?: boolean
          id?: string
          stage?: Database["public"]["Enums"]["idea_stage"]
          status?: Database["public"]["Enums"]["idea_status"]
          tagline?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
          views_count?: number
          visibility?: Database["public"]["Enums"]["idea_visibility"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      nda_acceptances: {
        Row: {
          accepted_at: string
          id: string
          idea_id: string
          investor_email: string | null
          investor_id: string
          investor_name: string | null
          ip_address: string | null
          nda_hash: string
          nda_text: string
          nda_version: string
          request_id: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          id?: string
          idea_id: string
          investor_email?: string | null
          investor_id: string
          investor_name?: string | null
          ip_address?: string | null
          nda_hash: string
          nda_text: string
          nda_version: string
          request_id: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          id?: string
          idea_id?: string
          investor_email?: string | null
          investor_id?: string
          investor_name?: string | null
          ip_address?: string | null
          nda_hash?: string
          nda_text?: string
          nda_version?: string
          request_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nda_acceptances_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nda_acceptances_nda_version_fkey"
            columns: ["nda_version"]
            isOneToOne: false
            referencedRelation: "nda_templates"
            referencedColumns: ["version"]
          },
          {
            foreignKeyName: "nda_acceptances_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "pitch_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      nda_templates: {
        Row: {
          body: string
          created_at: string
          title: string
          version: string
        }
        Insert: {
          body: string
          created_at?: string
          title: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pitch_access_log: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json | null
          event: string
          id: string
          idea_id: string
          request_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event: string
          id?: string
          idea_id: string
          request_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          event?: string
          id?: string
          idea_id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_access_log_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_access_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          idea_id: string
          investor_id: string
          message: string | null
          status: Database["public"]["Enums"]["pitch_access_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          idea_id: string
          investor_id: string
          message?: string | null
          status?: Database["public"]["Enums"]["pitch_access_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          idea_id?: string
          investor_id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["pitch_access_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pitch_access_requests_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_documents: {
        Row: {
          created_at: string
          file_path: string
          id: string
          idea_id: string
          mime_type: string
          sha256: string
          size_bytes: number
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          idea_id: string
          mime_type: string
          sha256: string
          size_bytes: number
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          idea_id?: string
          mime_type?: string
          sha256?: string
          size_bytes?: number
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_documents_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_versions: {
        Row: {
          changed_fields: string[] | null
          content_hash: string
          created_at: string
          created_by: string | null
          id: string
          idea_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          changed_fields?: string[] | null
          content_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id: string
          snapshot: Json
          version: number
        }
        Update: {
          changed_fields?: string[] | null
          content_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          idea_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pitch_versions_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          company: string | null
          created_at: string
          full_name: string | null
          headline: string | null
          id: string
          location: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id: string
          location?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          location?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          amount: number
          counter_amount: number | null
          counter_equity: number | null
          counter_message: string | null
          created_at: string
          entrepreneur_id: string
          equity: number | null
          id: string
          idea_id: string
          investor_id: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          counter_amount?: number | null
          counter_equity?: number | null
          counter_message?: string | null
          created_at?: string
          entrepreneur_id: string
          equity?: number | null
          id?: string
          idea_id: string
          investor_id: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          counter_amount?: number | null
          counter_equity?: number | null
          counter_message?: string | null
          created_at?: string
          entrepreneur_id?: string
          equity?: number | null
          id?: string
          idea_id?: string
          investor_id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_nda: {
        Args: { _nda_version: string; _request_id: string }
        Returns: undefined
      }
      add_my_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      cancel_agreement: { Args: { _agreement_id: string }; Returns: undefined }
      confirm_agreement: {
        Args: { _agreement_id: string; _version: number }
        Returns: string
      }
      authorize_pitch_document: {
        Args: { _document_id: string }
        Returns: {
          file_path: string
          is_owner: boolean
          mime_type: string
          title: string
          viewer_email: string
          viewer_name: string
        }[]
      }
      decide_pitch_access: {
        Args: { _decision: string; _request_id: string }
        Returns: undefined
      }
      get_pitch_details: {
        Args: { _idea_id: string }
        Returns: {
          business_model: string
          financial_estimates: string
          is_owner: boolean
          market_research: string
          nda_accepted_at: string
          target_customers: string
          updated_at: string
          viewer_email: string
          viewer_name: string
        }[]
      }
      get_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_pitch_access: { Args: { _idea_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_conversations: {
        Args: never
        Returns: {
          last_at: string
          last_message: string
          last_sender_id: string
          other_avatar: string
          other_headline: string
          other_id: string
          other_name: string
          unread_count: number
        }[]
      }
      list_pitch_documents: {
        Args: { _idea_id: string }
        Returns: {
          created_at: string
          id: string
          mime_type: string
          size_bytes: number
          title: string
        }[]
      }
      my_idea_stats: {
        Args: never
        Returns: {
          idea_id: string
          saves: number
          views: number
        }[]
      }
      my_views_by_day: {
        Args: { _days?: number }
        Returns: {
          day: string
          views: number
        }[]
      }
      pitch_document_count: { Args: { _idea_id: string }; Returns: number }
      record_idea_view: { Args: { _idea_id: string }; Returns: undefined }
      record_pitch_version: {
        Args: { _at?: string; _idea_id: string }
        Returns: undefined
      }
      request_pitch_access: {
        Args: { _idea_id: string; _message?: string }
        Returns: string
      }
      respond_to_proposal: {
        Args: {
          _action: string
          _amount?: number
          _equity?: number
          _message?: string
          _proposal_id: string
        }
        Returns: undefined
      }
      save_agreement_terms: {
        Args: { _agreement_id: string; _terms: Json; _type: string }
        Returns: number
      }
      set_signup_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "entrepreneur" | "investor"
      idea_stage: "idea" | "prototype" | "mvp" | "early_revenue" | "scaling"
      idea_status: "draft" | "pending" | "published" | "archived" | "rejected"
      idea_visibility: "public" | "private" | "unlisted"
      pitch_access_status: "pending" | "approved" | "rejected" | "revoked"
      proposal_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "countered"
        | "withdrawn"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "entrepreneur", "investor"],
      idea_stage: ["idea", "prototype", "mvp", "early_revenue", "scaling"],
      idea_status: ["draft", "pending", "published", "archived", "rejected"],
      idea_visibility: ["public", "private", "unlisted"],
      pitch_access_status: ["pending", "approved", "rejected", "revoked"],
      proposal_status: [
        "pending",
        "accepted",
        "rejected",
        "countered",
        "withdrawn",
      ],
    },
  },
} as const
