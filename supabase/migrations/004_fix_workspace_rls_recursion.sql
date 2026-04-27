-- Fix RLS infinite recursion in workspace policies.
-- workspaces_select queried workspace_members, whose RLS policy
-- queried workspace_members again — PostgreSQL's recursion guard
-- broke the chain and returned empty, hiding valid memberships.

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
CREATE POLICY "workspace_members_select" ON public.workspace_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO authenticated
  USING (is_workspace_member(id));
