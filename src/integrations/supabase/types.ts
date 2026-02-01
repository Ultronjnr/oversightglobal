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
      invitations: {
        Row: {
          created_at: string
          department: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          company_email: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          company_email?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          company_email?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pr_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          pr_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          pr_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          pr_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_messages_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          id: string
          name: string
          organization_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          surname: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          id: string
          name: string
          organization_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          surname?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          name?: string
          organization_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requisitions: {
        Row: {
          created_at: string
          currency: string
          document_url: string | null
          due_date: string | null
          finance_status: string
          history: Json
          hod_status: string
          id: string
          items: Json
          organization_id: string
          parent_pr_id: string | null
          payment_due_date: string | null
          requested_by: string
          requested_by_department: string | null
          requested_by_name: string
          status: Database["public"]["Enums"]["pr_status"]
          total_amount: number
          transaction_id: string
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          created_at?: string
          currency?: string
          document_url?: string | null
          due_date?: string | null
          finance_status?: string
          history?: Json
          hod_status?: string
          id?: string
          items?: Json
          organization_id: string
          parent_pr_id?: string | null
          payment_due_date?: string | null
          requested_by: string
          requested_by_department?: string | null
          requested_by_name: string
          status?: Database["public"]["Enums"]["pr_status"]
          total_amount?: number
          transaction_id: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          created_at?: string
          currency?: string
          document_url?: string | null
          due_date?: string | null
          finance_status?: string
          history?: Json
          hod_status?: string
          id?: string
          items?: Json
          organization_id?: string
          parent_pr_id?: string | null
          payment_due_date?: string | null
          requested_by?: string
          requested_by_department?: string | null
          requested_by_name?: string
          status?: Database["public"]["Enums"]["pr_status"]
          total_amount?: number
          transaction_id?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_parent_pr_id_fkey"
            columns: ["parent_pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requisitions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          created_at: string
          id: string
          items: Json
          message: string | null
          organization_id: string
          pr_id: string
          requested_by: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          message?: string | null
          organization_id: string
          pr_id: string
          requested_by: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          message?: string | null
          organization_id?: string
          pr_id?: string
          requested_by?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          created_at: string
          delivery_time: string | null
          id: string
          notes: string | null
          organization_id: string
          pr_id: string
          quote_request_id: string
          status: string
          supplier_id: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          pr_id: string
          quote_request_id: string
          status?: string
          supplier_id: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          pr_id?: string
          quote_request_id?: string
          status?: string
          supplier_id?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string
          contact_email: string
          contact_person: string | null
          created_at: string
          id: string
          industry: string | null
          invited_by_admin_id: string | null
          is_public: boolean
          is_verified: boolean
          organization_id: string | null
          phone: string | null
          registration_number: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_email: string
          contact_person?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          invited_by_admin_id?: string | null
          is_public?: boolean
          is_verified?: boolean
          organization_id?: string | null
          phone?: string | null
          registration_number?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_email?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          invited_by_admin_id?: string | null
          is_public?: boolean
          is_verified?: boolean
          organization_id?: string | null
          phone?: string | null
          registration_number?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { _email: string; _token: string }
        Returns: boolean
      }
      accept_supplier_invitation:
        | {
            Args: {
              _address?: string
              _company_name: string
              _email: string
              _industries: string[]
              _phone?: string
              _registration_number?: string
              _token: string
              _user_id: string
              _vat_number?: string
            }
            Returns: Json
          }
        | {
            Args: {
              _address?: string
              _company_name: string
              _contact_person?: string
              _email: string
              _industries: string[]
              _phone?: string
              _registration_number?: string
              _token: string
              _user_id: string
              _vat_number?: string
            }
            Returns: Json
          }
      assign_invitation_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      create_supplier_invitation: {
        Args: { _company_name: string; _email: string }
        Returns: Json
      }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_supplier_linked_to_org: {
        Args: { _org_id: string; _supplier_id: string }
        Returns: boolean
      }
      is_valid_self_role_assignment: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      organization_has_active_hod: {
        Args: { _org_id: string }
        Returns: boolean
      }
      organization_has_admin: { Args: { _org_id: string }; Returns: boolean }
      validate_invitation: {
        Args: { _email: string; _token: string }
        Returns: {
          department: string
          email: string
          expires_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }[]
      }
      validate_pr_items: { Args: { items: Json }; Returns: boolean }
    }
    Enums: {
      app_role: "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER"
      org_supplier_status: "PENDING" | "ACCEPTED" | "DECLINED"
      pr_status:
        | "PENDING_HOD_APPROVAL"
        | "HOD_APPROVED"
        | "HOD_DECLINED"
        | "PENDING_FINANCE_APPROVAL"
        | "FINANCE_APPROVED"
        | "FINANCE_DECLINED"
        | "SPLIT"
      quote_status:
        | "PENDING"
        | "SUBMITTED"
        | "ACCEPTED"
        | "REJECTED"
        | "EXPIRED"
      urgency_level: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      user_status: "ACTIVE" | "PENDING" | "SUSPENDED"
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
      app_role: ["EMPLOYEE", "HOD", "FINANCE", "ADMIN", "SUPPLIER"],
      org_supplier_status: ["PENDING", "ACCEPTED", "DECLINED"],
      pr_status: [
        "PENDING_HOD_APPROVAL",
        "HOD_APPROVED",
        "HOD_DECLINED",
        "PENDING_FINANCE_APPROVAL",
        "FINANCE_APPROVED",
        "FINANCE_DECLINED",
        "SPLIT",
      ],
      quote_status: ["PENDING", "SUBMITTED", "ACCEPTED", "REJECTED", "EXPIRED"],
      urgency_level: ["LOW", "NORMAL", "HIGH", "URGENT"],
      user_status: ["ACTIVE", "PENDING", "SUSPENDED"],
    },
  },
} as const
