GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;

GRANT ALL PRIVILEGES ON TABLE public.workspaces TO anon, authenticated, service_role, authenticator;
GRANT ALL PRIVILEGES ON TABLE public.workspace_members TO anon, authenticated, service_role, authenticator;
GRANT ALL PRIVILEGES ON TABLE public.workspace_invitations TO anon, authenticated, service_role, authenticator;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO anon, authenticated, service_role, authenticator;

NOTIFY pgrst, 'reload schema';
