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
      attachments: {
        Row: {
          ai_extracted: Json | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          invoice_date: string | null
          invoice_number: string | null
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string
          notes: string | null
          organization_id: string
          pr_id: string | null
          reimbursement_id: string | null
          supplier_id: string | null
          supplier_name: string | null
          transaction_id: string | null
          uploaded_by: string
          vat_number: string | null
        }
        Insert: {
          ai_extracted?: Json | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string
          notes?: string | null
          organization_id: string
          pr_id?: string | null
          reimbursement_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          transaction_id?: string | null
          uploaded_by: string
          vat_number?: string | null
        }
        Update: {
          ai_extracted?: Json | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string
          notes?: string | null
          organization_id?: string
          pr_id?: string | null
          reimbursement_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          transaction_id?: string | null
          uploaded_by?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["category_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          type: Database["public"]["Enums"]["category_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          type?: Database["public"]["Enums"]["category_type"]
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          budget_limit: number | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          manager_user_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          budget_limit?: number | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          budget_limit?: number | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      freemium_business_profiles: {
        Row: {
          company_name: string
          company_type: Database["public"]["Enums"]["company_type"]
          created_at: string
          full_name: string
          id: string
          next_vat_submission_date: string | null
          registration_number: string
          updated_at: string
          user_id: string
          vat_cycle: Database["public"]["Enums"]["vat_cycle"] | null
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          company_name: string
          company_type: Database["public"]["Enums"]["company_type"]
          created_at?: string
          full_name: string
          id?: string
          next_vat_submission_date?: string | null
          registration_number: string
          updated_at?: string
          user_id: string
          vat_cycle?: Database["public"]["Enums"]["vat_cycle"] | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          company_name?: string
          company_type?: Database["public"]["Enums"]["company_type"]
          created_at?: string
          full_name?: string
          id?: string
          next_vat_submission_date?: string | null
          registration_number?: string
          updated_at?: string
          user_id?: string
          vat_cycle?: Database["public"]["Enums"]["vat_cycle"] | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      freemium_documents: {
        Row: {
          description: string | null
          file_name: string
          file_path: string
          id: string
          upload_date: string
          user_id: string
        }
        Insert: {
          description?: string | null
          file_name: string
          file_path: string
          id?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          description?: string | null
          file_name?: string
          file_path?: string
          id?: string
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
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
      invoices: {
        Row: {
          created_at: string
          document_url: string
          id: string
          organization_id: string
          pr_id: string
          quote_id: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_url: string
          id?: string
          organization_id: string
          pr_id: string
          quote_id: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_url?: string
          id?: string
          organization_id?: string
          pr_id?: string
          quote_id?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          organization_id: string | null
          related_transaction_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          organization_id?: string | null
          related_transaction_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          organization_id?: string | null
          related_transaction_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      ocr_analyses: {
        Row: {
          bucket: string
          confidence: number | null
          created_at: string
          created_by: string
          document_type: Database["public"]["Enums"]["ocr_document_type"]
          error_message: string | null
          extracted: Json | null
          id: string
          invoice_id: string | null
          model: string | null
          organization_id: string
          pr_id: string | null
          raw_text: string | null
          reimbursement_id: string | null
          status: Database["public"]["Enums"]["ocr_status"]
          storage_path: string
          updated_at: string
        }
        Insert: {
          bucket: string
          confidence?: number | null
          created_at?: string
          created_by: string
          document_type: Database["public"]["Enums"]["ocr_document_type"]
          error_message?: string | null
          extracted?: Json | null
          id?: string
          invoice_id?: string | null
          model?: string | null
          organization_id: string
          pr_id?: string | null
          raw_text?: string | null
          reimbursement_id?: string | null
          status?: Database["public"]["Enums"]["ocr_status"]
          storage_path: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          confidence?: number | null
          created_at?: string
          created_by?: string
          document_type?: Database["public"]["Enums"]["ocr_document_type"]
          error_message?: string | null
          extracted?: Json | null
          id?: string
          invoice_id?: string | null
          model?: string | null
          organization_id?: string
          pr_id?: string | null
          raw_text?: string | null
          reimbursement_id?: string | null
          status?: Database["public"]["Enums"]["ocr_status"]
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_analyses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_analyses_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_analyses_reimbursement_id_fkey"
            columns: ["reimbursement_id"]
            isOneToOne: false
            referencedRelation: "reimbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          company_email: string | null
          created_at: string
          id: string
          name: string
          registration_number: string | null
          tax_number: string | null
        }
        Insert: {
          address?: string | null
          company_email?: string | null
          created_at?: string
          id?: string
          name: string
          registration_number?: string | null
          tax_number?: string | null
        }
        Update: {
          address?: string | null
          company_email?: string | null
          created_at?: string
          id?: string
          name?: string
          registration_number?: string | null
          tax_number?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount_paid: number
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          organization_id: string
          payment_date: string | null
          payment_reference: string | null
          reimbursement_id: string | null
          transaction_id: string | null
        }
        Insert: {
          amount_paid: number
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          payment_date?: string | null
          payment_reference?: string | null
          reimbursement_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount_paid?: number
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_reference?: string | null
          reimbursement_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_reimbursement_id_fkey"
            columns: ["reimbursement_id"]
            isOneToOne: false
            referencedRelation: "reimbursements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_audit_log: {
        Row: {
          action: string
          amount: number | null
          batch_id: string | null
          id: string
          invoice_id: string | null
          new_status: string | null
          notes: string | null
          old_status: string | null
          organization_id: string
          performed_at: string
          performed_by: string | null
        }
        Insert: {
          action: string
          amount?: number | null
          batch_id?: string | null
          id?: string
          invoice_id?: string | null
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          organization_id: string
          performed_at?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          amount?: number | null
          batch_id?: string | null
          id?: string
          invoice_id?: string | null
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          organization_id?: string
          performed_at?: string
          performed_by?: string | null
        }
        Relationships: []
      }
      payment_batches: {
        Row: {
          batch_number: string
          confirmed_at: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_reference: string | null
          status: string
          total_amount: number
        }
        Insert: {
          batch_number: string
          confirmed_at?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_reference?: string | null
          status?: string
          total_amount?: number
        }
        Update: {
          batch_number?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_reference?: string | null
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      pr_message_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "pr_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pr_messages: {
        Row: {
          created_at: string
          id: string
          is_system_note: boolean
          message: string
          organization_id: string
          pr_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system_note?: boolean
          message: string
          organization_id: string
          pr_id: string
          sender_id: string
          sender_name: string
          sender_role: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system_note?: boolean
          message?: string
          organization_id?: string
          pr_id?: string
          sender_id?: string
          sender_name?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "pr_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          tier: Database["public"]["Enums"]["subscription_tier"]
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
          tier?: Database["public"]["Enums"]["subscription_tier"]
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
          tier?: Database["public"]["Enums"]["subscription_tier"]
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
          category_id: string | null
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
          requires_reimbursement: boolean
          status: Database["public"]["Enums"]["pr_status"]
          total_amount: number
          transaction_id: string
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          category_id?: string | null
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
          requires_reimbursement?: boolean
          status?: Database["public"]["Enums"]["pr_status"]
          total_amount?: number
          transaction_id: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          category_id?: string | null
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
          requires_reimbursement?: boolean
          status?: Database["public"]["Enums"]["pr_status"]
          total_amount?: number
          transaction_id?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requisitions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
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
          document_url: string | null
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
          document_url?: string | null
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
          document_url?: string | null
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
      receipt_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          message: string | null
          organization_id: string
          performed_by: string | null
          receipt_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          message?: string | null
          organization_id: string
          performed_by?: string | null
          receipt_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          message?: string | null
          organization_id?: string
          performed_by?: string | null
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_audit_log_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          calculated_total: number | null
          calculated_unit_price: number | null
          created_at: string
          id: string
          is_valid: boolean
          item_name: string
          organization_id: string
          quantity: number
          receipt_id: string
          total: number
          unit_price: number | null
          updated_at: string
          warning: string | null
        }
        Insert: {
          calculated_total?: number | null
          calculated_unit_price?: number | null
          created_at?: string
          id?: string
          is_valid?: boolean
          item_name: string
          organization_id: string
          quantity?: number
          receipt_id: string
          total?: number
          unit_price?: number | null
          updated_at?: string
          warning?: string | null
        }
        Update: {
          calculated_total?: number | null
          calculated_unit_price?: number | null
          created_at?: string
          id?: string
          is_valid?: boolean
          item_name?: string
          organization_id?: string
          quantity?: number
          receipt_id?: string
          total?: number
          unit_price?: number | null
          updated_at?: string
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          grand_total: number
          id: string
          invoice_number: string | null
          ocr_analysis_id: string | null
          organization_id: string
          raw_json: Json | null
          raw_text: string | null
          receipt_date: string | null
          source_bucket: string | null
          source_path: string | null
          status: string
          store_name: string | null
          subtotal: number
          updated_at: string
          vat: number
        }
        Insert: {
          created_at?: string
          created_by: string
          currency?: string
          grand_total?: number
          id?: string
          invoice_number?: string | null
          ocr_analysis_id?: string | null
          organization_id: string
          raw_json?: Json | null
          raw_text?: string | null
          receipt_date?: string | null
          source_bucket?: string | null
          source_path?: string | null
          status?: string
          store_name?: string | null
          subtotal?: number
          updated_at?: string
          vat?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          grand_total?: number
          id?: string
          invoice_number?: string | null
          ocr_analysis_id?: string | null
          organization_id?: string
          raw_json?: Json | null
          raw_text?: string | null
          receipt_date?: string | null
          source_bucket?: string | null
          source_path?: string | null
          status?: string
          store_name?: string | null
          subtotal?: number
          updated_at?: string
          vat?: number
        }
        Relationships: []
      }
      reimbursement_audit_log: {
        Row: {
          action: string
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          organization_id: string
          performed_at: string
          performed_by: string | null
          reimbursement_id: string
        }
        Insert: {
          action: string
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          organization_id: string
          performed_at?: string
          performed_by?: string | null
          reimbursement_id: string
        }
        Update: {
          action?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          organization_id?: string
          performed_at?: string
          performed_by?: string | null
          reimbursement_id?: string
        }
        Relationships: []
      }
      reimbursements: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          description: string
          employee_id: string
          employee_name: string
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          paid_by_employee: boolean
          payment_method: string | null
          pr_id: string | null
          proof_document_url: string | null
          reimbursement_date: string | null
          reimbursement_reference: string | null
          status: Database["public"]["Enums"]["reimbursement_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          description: string
          employee_id: string
          employee_name: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          paid_by_employee?: boolean
          payment_method?: string | null
          pr_id?: string | null
          proof_document_url?: string | null
          reimbursement_date?: string | null
          reimbursement_reference?: string | null
          status?: Database["public"]["Enums"]["reimbursement_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          description?: string
          employee_id?: string
          employee_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          paid_by_employee?: boolean
          payment_method?: string | null
          pr_id?: string | null
          proof_document_url?: string | null
          reimbursement_date?: string | null
          reimbursement_reference?: string | null
          status?: Database["public"]["Enums"]["reimbursement_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_invitations: {
        Row: {
          company_name: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          status: string
          token: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          status?: string
          token?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company_name: string
          contact_email: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          invited_by_admin_id: string | null
          is_active: boolean
          is_manual: boolean
          is_public: boolean
          is_verified: boolean
          organization_id: string
          phone: string | null
          registration_number: string | null
          supplier_code: string | null
          supplier_type: Database["public"]["Enums"]["supplier_type"]
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_email?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          invited_by_admin_id?: string | null
          is_active?: boolean
          is_manual?: boolean
          is_public?: boolean
          is_verified?: boolean
          organization_id: string
          phone?: string | null
          registration_number?: string | null
          supplier_code?: string | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"]
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_email?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          invited_by_admin_id?: string | null
          is_active?: boolean
          is_manual?: boolean
          is_public?: boolean
          is_verified?: boolean
          organization_id?: string
          phone?: string | null
          registration_number?: string | null
          supplier_code?: string | null
          supplier_type?: Database["public"]["Enums"]["supplier_type"]
          user_id?: string | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          amount_paid: number
          approved_at: string
          created_at: string
          currency: string
          id: string
          organization_id: string
          paid_at: string | null
          pr_id: string
          status: string
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          amount_paid?: number
          approved_at?: string
          created_at?: string
          currency?: string
          id?: string
          organization_id: string
          paid_at?: string | null
          pr_id: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          approved_at?: string
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string
          paid_at?: string | null
          pr_id?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: true
            referencedRelation: "purchase_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      clean_receipt_items: {
        Row: {
          created_at: string | null
          id: string | null
          is_valid: boolean | null
          item_name: string | null
          organization_id: string | null
          quantity: number | null
          receipt_id: string | null
          total: number | null
          unit_price: number | null
          warning: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          is_valid?: boolean | null
          item_name?: string | null
          organization_id?: string | null
          quantity?: number | null
          receipt_id?: string | null
          total?: number | null
          unit_price?: never
          warning?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          is_valid?: boolean | null
          item_name?: string | null
          organization_id?: string | null
          quantity?: number | null
          receipt_id?: string | null
          total?: number | null
          unit_price?: never
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _notify_role: {
        Args: {
          _message: string
          _org_id: string
          _related: string
          _role: Database["public"]["Enums"]["app_role"]
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: undefined
      }
      _notify_users: {
        Args: {
          _message: string
          _org_id: string
          _related: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_ids: string[]
        }
        Returns: undefined
      }
      accept_invitation: {
        Args: { _email: string; _token: string }
        Returns: boolean
      }
      accept_quote_and_reject_others: {
        Args: { _pr_id: string; _quote_id: string }
        Returns: Json
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
      accept_supplier_invitation_token: {
        Args: { _token: string; _user_id: string }
        Returns: boolean
      }
      add_reimbursement_comment: {
        Args: { _comment: string; _reimbursement_id: string }
        Returns: Json
      }
      approve_reimbursement: {
        Args: { _notes?: string; _reimbursement_id: string }
        Returns: Json
      }
      assign_invitation_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      cancel_batch_draft: { Args: { _batch_id: string }; Returns: Json }
      complete_company_registration: {
        Args: {
          _company_address: string
          _company_name: string
          _company_type: Database["public"]["Enums"]["company_type"]
          _email: string
          _name: string
          _next_vat_submission_date?: string
          _organization_id: string
          _phone: string
          _registration_number: string
          _surname: string
          _tax_number: string
          _user_id: string
          _vat_cycle?: Database["public"]["Enums"]["vat_cycle"]
          _vat_number?: string
          _vat_registered: boolean
        }
        Returns: Json
      }
      confirm_batch_paid: {
        Args: {
          _batch_id: string
          _payment_date?: string
          _payment_reference?: string
        }
        Returns: Json
      }
      create_payment_batch: {
        Args: { _allocations: Json; _notes?: string }
        Returns: Json
      }
      create_payment_batch_draft: {
        Args: { _allocations: Json; _notes?: string }
        Returns: Json
      }
      create_supplier_invitation: {
        Args: { _company_name: string; _email: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
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
      mark_reimbursement_paid: {
        Args: {
          _payment_date?: string
          _payment_reference?: string
          _reimbursement_id: string
        }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      organization_has_active_hod: {
        Args: { _org_id: string }
        Returns: boolean
      }
      organization_has_admin: { Args: { _org_id: string }; Returns: boolean }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_overdue_invoices: { Args: never; Returns: number }
      reject_reimbursement: {
        Args: { _notes?: string; _reimbursement_id: string }
        Returns: Json
      }
      submit_reimbursement: {
        Args: {
          _amount: number
          _description: string
          _notes?: string
          _payment_method: string
          _pr_id?: string
          _proof_url: string
          _reference?: string
          _reimbursement_date?: string
          _title: string
        }
        Returns: Json
      }
      submit_reimbursement_for_pr: {
        Args: {
          _amount: number
          _description: string
          _notes?: string
          _payment_method: string
          _pr_id: string
          _proof_url?: string
          _reference?: string
          _reimbursement_date?: string
        }
        Returns: Json
      }
      update_batch_draft: {
        Args: { _add?: Json; _batch_id: string; _remove?: string[] }
        Returns: Json
      }
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
      validate_supplier_invitation: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role: "EMPLOYEE" | "HOD" | "FINANCE" | "ADMIN" | "SUPPLIER"
      attachment_kind: "INVOICE" | "RECEIPT" | "OTHER"
      category_type: "EXPENSE" | "ASSET"
      company_type: "PTY_LTD" | "PLC" | "NPO"
      notification_type:
        | "requisition_submitted"
        | "requisition_approved"
        | "requisition_declined"
        | "reimbursement_submitted"
        | "reimbursement_approved"
        | "partial_payment"
        | "full_payment"
        | "batch_created"
        | "overdue_transaction"
        | "invoice_uploaded"
        | "ai_receipt_matched"
      ocr_document_type: "INVOICE" | "REIMBURSEMENT_PROOF" | "PR_DOCUMENT"
      ocr_status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
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
      reimbursement_status:
        | "PENDING"
        | "APPROVED"
        | "DECLINED"
        | "PAID"
        | "AWAITING_PAYMENT"
      subscription_tier: "FREEMIUM" | "STANDARD" | "ADMIN"
      supplier_type: "REGISTERED" | "PREFERRED" | "ONE_TIME"
      urgency_level: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      user_status: "ACTIVE" | "PENDING" | "SUSPENDED"
      vat_cycle: "MONTHLY" | "BI_MONTHLY"
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
      attachment_kind: ["INVOICE", "RECEIPT", "OTHER"],
      category_type: ["EXPENSE", "ASSET"],
      company_type: ["PTY_LTD", "PLC", "NPO"],
      notification_type: [
        "requisition_submitted",
        "requisition_approved",
        "requisition_declined",
        "reimbursement_submitted",
        "reimbursement_approved",
        "partial_payment",
        "full_payment",
        "batch_created",
        "overdue_transaction",
        "invoice_uploaded",
        "ai_receipt_matched",
      ],
      ocr_document_type: ["INVOICE", "REIMBURSEMENT_PROOF", "PR_DOCUMENT"],
      ocr_status: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
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
      reimbursement_status: [
        "PENDING",
        "APPROVED",
        "DECLINED",
        "PAID",
        "AWAITING_PAYMENT",
      ],
      subscription_tier: ["FREEMIUM", "STANDARD", "ADMIN"],
      supplier_type: ["REGISTERED", "PREFERRED", "ONE_TIME"],
      urgency_level: ["LOW", "NORMAL", "HIGH", "URGENT"],
      user_status: ["ACTIVE", "PENDING", "SUSPENDED"],
      vat_cycle: ["MONTHLY", "BI_MONTHLY"],
    },
  },
} as const
