import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password, industry, registrationNumber, vatNumber, phone, address } =
      await req.json();

    if (!token || !password || String(password).length < 8) {
      return json({ success: false, error: "Invalid token or password." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Validate invitation
    const { data: inv, error: invErr } = await admin
      .from("supplier_invitations")
      .select(
        "id, email, company_name, contact_person, industry, registration_number, vat_number, organization_id, status, expires_at"
      )
      .eq("token", token)
      .maybeSingle();

    if (invErr) return json({ success: false, error: invErr.message }, 400);
    if (!inv) return json({ success: false, error: "Invitation not found." }, 404);
    if (inv.status === "ACCEPTED")
      return json({ success: false, error: "This invitation has already been used." }, 409);
    if (inv.status === "CANCELLED")
      return json({ success: false, error: "This invitation has been cancelled." }, 409);
    if (new Date(inv.expires_at).getTime() < Date.now())
      return json({ success: false, error: "Invitation has expired." }, 410);

    const email = inv.email.toLowerCase();

    // 2. Create the auth user (confirmed so they can log in immediately).
    // If a prior attempt left an orphaned auth user, reuse it and set the password.
    let userId: string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: inv.company_name },
    });

    if (createErr || !created?.user) {
      const alreadyExists =
        (createErr?.message || "").toLowerCase().includes("already") ||
        (createErr as { code?: string })?.code === "email_exists";

      if (!alreadyExists) {
        return json(
          { success: false, error: createErr?.message || "Failed to create account." },
          400
        );
      }

      // Find the existing user by email
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find(
        (u) => (u.email || "").toLowerCase() === email
      );
      if (!existing) {
        return json({ success: false, error: "Failed to create account." }, 400);
      }
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
    } else {
      userId = created.user.id;
    }

    // 3. Create profile
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      email,
      name: inv.company_name,
      organization_id: inv.organization_id,
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ success: false, error: profileErr.message }, 400);
    }

    // 4. Create supplier record
    const { error: supplierErr } = await admin.from("suppliers").insert({
      user_id: userId,
      company_name: inv.company_name,
      contact_email: email,
      contact_person: inv.contact_person,
      registration_number: registrationNumber || inv.registration_number || null,
      vat_number: vatNumber || inv.vat_number || null,
      industry: industry || inv.industry || null,
      phone: phone || null,
      address: address || null,
      organization_id: inv.organization_id,
      is_public: false,
      is_verified: true,
    });
    if (supplierErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ success: false, error: supplierErr.message }, 400);
    }

    // 5. Assign SUPPLIER role
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "SUPPLIER" });
    if (roleErr && !roleErr.message.includes("duplicate")) {
      await admin.auth.admin.deleteUser(userId);
      return json({ success: false, error: roleErr.message }, 400);
    }

    // 6. Mark invitation accepted + audit log
    await admin
      .from("supplier_invitations")
      .update({ status: "ACCEPTED", accepted_at: new Date().toISOString(), supplier_user_id: userId })
      .eq("id", inv.id);

    await admin.from("supplier_invitation_audit_log").insert({
      invitation_id: inv.id,
      organization_id: inv.organization_id,
      action: "ACCEPTED",
      performed_by: userId,
    });

    return json({ success: true });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
