DROP POLICY IF EXISTS "task_notes_delete" ON public.task_notes;
CREATE POLICY "task_notes_delete" ON public.task_notes FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );
