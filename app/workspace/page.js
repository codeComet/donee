import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSideClient } from "@/lib/supabase";
import { getWorkspaceId } from "@/lib/workspace";
import WorkspaceOnboarding from "./WorkspaceOnboarding";

export default async function WorkspacePage({ searchParams }) {
  const cookieStore = await cookies();
  const supabase = createServerSideClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  let loadError = null;

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  let admin = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  const shouldTryAdminFallback =
    !!admin &&
    (membershipError ||
      (Array.isArray(memberships) && memberships.length === 0));

  let finalMemberships = memberships ?? [];
  let membershipClient = supabase;

  if (membershipError) {
    loadError = `${membershipError.message} (Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL})`;
  }

  if (shouldTryAdminFallback) {
    const { data: adminMemberships, error: adminMembershipsError } = await admin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (adminMembershipsError && !loadError)
      loadError = adminMembershipsError.message;
    if (Array.isArray(adminMemberships)) {
      finalMemberships = adminMemberships;
      membershipClient = admin;
    }

    if (finalMemberships.length === 0) {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        await admin.from("profiles").insert({
          id: user.id,
          full_name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            (user.email ? user.email.split("@")[0] : "User"),
          avatar_url: user.user_metadata?.avatar_url ?? null,
          email: user.email ?? null,
          role: "developer",
        });
      }

      const { data: workspacesForHeal, count: workspacesCount } = await admin
        .from("workspaces")
        .select("id", { count: "exact" })
        .order("created_at", { ascending: true })
        .limit(2);

      if (workspacesCount === 1 && workspacesForHeal?.[0]?.id) {
        await admin.from("workspace_members").insert({
          workspace_id: workspacesForHeal[0].id,
          user_id: user.id,
          role: "developer",
        });

        const { data: healedMemberships } = await admin
          .from("workspace_members")
          .select("workspace_id, role")
          .eq("user_id", user.id)
          .order("joined_at", { ascending: false });

        if (Array.isArray(healedMemberships)) {
          finalMemberships = healedMemberships;
          membershipClient = admin;
        }
      }
    }
  }

  const workspaceIds = finalMemberships.map((m) => m.workspace_id);

  const { data: workspaceRows } =
    workspaceIds.length > 0
      ? await membershipClient
          .from("workspaces")
          .select("id, name, created_at")
          .in("id", workspaceIds)
      : { data: [] };

  const workspaces = finalMemberships
    .map((m) => {
      const ws = (workspaceRows ?? []).find((w) => w.id === m.workspace_id);
      return ws ? { ...ws, role: m.role } : null;
    })
    .filter(Boolean);

  // If user has a valid workspace cookie AND no view param, redirect to dashboard
  const params = await searchParams;
  const view = params?.view;
  const currentWorkspaceId = getWorkspaceId(cookieStore);
  if (
    !view &&
    currentWorkspaceId &&
    workspaces.some((w) => w.id === currentWorkspaceId)
  ) {
    redirect("/dashboard");
  }

  return (
    <WorkspaceOnboarding
      workspaces={workspaces}
      initialView={view}
      loadError={loadError}
    />
  );
}
