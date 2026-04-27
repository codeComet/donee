-- tasks_select was too restrictive: required project_members row OR workspace super_admin.
-- Users who join a workspace via invite have no project_members rows → see nothing.
-- projects_select already allows all workspace members; align tasks_select to match.

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
    )
  );

-- Also allow seeing tasks assigned to you even without a workspace_members row
-- (handles edge cases during workspace transition)
-- Covered by the above since workspace members include all invited users.

NOTIFY pgrst, 'reload schema';
