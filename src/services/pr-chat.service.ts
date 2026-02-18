import { supabase } from "@/integrations/supabase/client";

export interface PRMessage {
  id: string;
  pr_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export interface SendMessageInput {
  pr_id: string;
  message: string;
}

export async function getPRMessages(prId: string): Promise<{ success: boolean; data?: PRMessage[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("pr_messages")
      .select("*")
      .eq("pr_id", prId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return { success: true, data: data as PRMessage[] };
  } catch (err: any) {
    console.error("Error fetching PR messages:", err);
    return { success: false, error: err.message };
  }
}

export async function sendPRMessage(input: SendMessageInput): Promise<{ success: boolean; data?: PRMessage; error?: string }> {
  try {
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get user profile and role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, surname, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile.organization_id) throw new Error("User has no organization");

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError) throw roleError;

    const senderName = profile.surname 
      ? `${profile.name} ${profile.surname}` 
      : profile.name;

    const { data, error } = await supabase
      .from("pr_messages")
      .insert({
        pr_id: input.pr_id,
        sender_id: user.id,
        sender_name: senderName,
        sender_role: roleData.role,
        message: input.message.trim(),
        organization_id: profile.organization_id,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as PRMessage };
  } catch (err: any) {
    console.error("Error sending PR message:", err);
    return { success: false, error: err.message };
  }
}

export async function getMessageCount(prId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("pr_messages")
      .select("*", { count: "exact", head: true })
      .eq("pr_id", prId);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error("Error getting message count:", err);
    return 0;
  }
}
