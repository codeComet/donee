-- tasks_insert had same issue as tasks_select (fixed in 016):
-- required project_members row OR workspace super_admin.
-- Align with tasks_select — any workspace member can insert tasks.

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
