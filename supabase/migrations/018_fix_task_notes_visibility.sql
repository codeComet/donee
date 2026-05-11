-- task_notes_select was overwritten by 002_workspaces.sql (applied after 005),
-- stripping the created_by/assigned_to checks. Result: developers who created
-- tasks but are not in project_members cannot see notes on their own tasks.
--
-- Align with tasks_select (016): any workspace member sees all notes in that workspace.

DROP POLICY IF EXISTS "task_notes_select" ON public.task_notes;

CREATE POLICY "task_notes_select" ON public.task_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = task_notes.workspace_id AND wm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
