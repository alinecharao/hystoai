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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      characters: {
        Row: {
          avatar: string
          background: string
          created_at: string
          description: string
          gender: string
          greeting: string
          id: string
          image_url: string
          instructions: string
          name: string
          opening_scene: string
          personality: string
          tagline: string
          tags: string[]
          user_id: string | null
        }
        Insert: {
          avatar?: string
          background?: string
          created_at?: string
          description?: string
          gender?: string
          greeting?: string
          id?: string
          image_url?: string
          instructions?: string
          name: string
          opening_scene?: string
          personality?: string
          tagline?: string
          tags?: string[]
          user_id?: string | null
        }
        Update: {
          avatar?: string
          background?: string
          created_at?: string
          description?: string
          gender?: string
          greeting?: string
          id?: string
          image_url?: string
          instructions?: string
          name?: string
          opening_scene?: string
          personality?: string
          tagline?: string
          tags?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      assistant_response_versions: {
        Row: {
          id: string
          assistant_message_id: string
          user_id: string
          character_id: string
          content: string
          is_selected: boolean
          created_at: string
        }
        Insert: {
          id?: string
          assistant_message_id: string
          user_id: string
          character_id: string
          content: string
          is_selected?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          assistant_message_id?: string
          user_id?: string
          character_id?: string
          content?: string
          is_selected?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_response_versions_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_regeneration_claims: {
        Row: {
          assistant_message_id: string
          user_id: string
          character_id: string
          claim_token: string
          claimed_at: string
        }
        Insert: {
          assistant_message_id: string
          user_id: string
          character_id: string
          claim_token?: string
          claimed_at?: string
        }
        Update: {
          assistant_message_id?: string
          user_id?: string
          character_id?: string
          claim_token?: string
          claimed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_regeneration_claims_assistant_message_id_fkey"
            columns: ["assistant_message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_generation_claims: {
        Row: {
          character_id: string
          claim_token: string
          claimed_at: string
          user_id: string
          user_message_id: string
        }
        Insert: {
          character_id: string
          claim_token?: string
          claimed_at?: string
          user_id: string
          user_message_id: string
        }
        Update: {
          character_id?: string
          claim_token?: string
          claimed_at?: string
          user_id?: string
          user_message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_generation_claims_user_message_id_fkey"
            columns: ["user_message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          character_id: string
          client_message_id: string | null
          content: string
          created_at: string
          id: string
          reply_to_message_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          character_id: string
          client_message_id?: string | null
          content: string
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          role: string
          user_id?: string
        }
        Update: {
          character_id?: string
          client_message_id?: string | null
          content?: string
          created_at?: string
          id?: string
          reply_to_message_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          age: number | null
          boundaries: string
          created_at: string
          description: string
          dislikes: string
          gender: string
          id: string
          is_default: boolean
          likes: string
          name: string
          photo_url: string
          role_description: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          boundaries?: string
          created_at?: string
          description?: string
          dislikes?: string
          gender?: string
          id?: string
          is_default?: boolean
          likes?: string
          name: string
          photo_url?: string
          role_description?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          boundaries?: string
          created_at?: string
          description?: string
          dislikes?: string
          gender?: string
          id?: string
          is_default?: boolean
          likes?: string
          name?: string
          photo_url?: string
          role_description?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      story_memory_notes: {
        Row: {
          id: string
          user_id: string
          character_id: string
          anchor_message_id: string
          source_message_id: string | null
          category: "fact" | "timeline" | "knowledge" | "private"
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          character_id: string
          anchor_message_id: string
          source_message_id?: string | null
          category: "fact" | "timeline" | "knowledge" | "private"
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          character_id?: string
          anchor_message_id?: string
          source_message_id?: string | null
          category?: "fact" | "timeline" | "knowledge" | "private"
          body?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_memory_notes_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_memory_notes_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      story_memories: {
        Row: {
          character_id: string
          known_facts: string
          last_processed_message_id: string | null
          revision: number
          scene: string
          source_ids: string[]
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          character_id: string
          known_facts?: string
          last_processed_message_id?: string | null
          revision?: number
          scene?: string
          source_ids?: string[]
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          character_id?: string
          known_facts?: string
          last_processed_message_id?: string | null
          revision?: number
          scene?: string
          source_ids?: string[]
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_memories_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_chat_story_memory: {
        Args: {
          p_character_id: string
          p_assistant_message_id: string
          p_summary: string
          p_scene: string
          p_known_facts: string
        }
        Returns: boolean
      }
      claim_assistant_regeneration: {
        Args: { p_assistant_message_id: string; p_character_id: string }
        Returns: string | null
      }
      release_assistant_regeneration: {
        Args: { p_assistant_message_id: string; p_claim_token: string }
        Returns: boolean
      }
      finish_assistant_regeneration: {
        Args: { p_assistant_message_id: string; p_claim_token: string; p_content: string }
        Returns: string | null
      }
      select_assistant_response_version: {
        Args: { p_assistant_message_id: string; p_version_id: string | null }
        Returns: boolean
      }
      append_chat_user_message: {
        Args: { p_character_id: string; p_content: string; p_message_id: string }
        Returns: boolean
      }
      claim_chat_generation: {
        Args: { p_character_id: string; p_user_message_id: string }
        Returns: string
      }
      release_chat_generation: {
        Args: { p_claim_token: string; p_user_message_id: string }
        Returns: boolean
      }
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
    Enums: {},
  },
} as const
