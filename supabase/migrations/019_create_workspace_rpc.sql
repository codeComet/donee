-- Workspace creation via RPC to avoid auth.uid() being NULL in server action context.
-- SECURITY DEFINER runs as function owner (postgres), bypasses RLS.
-- auth.uid() IS available inside PL/pgSQL even when RLS check context fails.

CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID;
  v_workspace_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (name, created_by)
  VALUES (p_name, v_user_id)
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, v_user_id, 'super_admin');

  RETURN v_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;
