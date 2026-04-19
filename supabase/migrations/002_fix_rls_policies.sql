-- ============================================================
-- Migration 002 — Fix RLS policies
-- Run in Supabase SQL Editor
-- ============================================================

-- ---- projects_select ----
-- Before: only project members + super_admin could see projects
-- After:  all authenticated users see all projects
--         (developers need to see projects to add tasks)
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (true);

-- ---- tasks_select ----
-- Before: only project members + super_admin
-- After:  also assigned user and task creator
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR tasks.assigned_to = auth.uid()
    OR tasks.created_by = auth.uid()
  );

-- ---- tasks_insert ----
-- Before: only project members + super_admin could insert tasks
-- After:  any authenticated user (UI allows all users to add tasks)
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---- task_notes_select ----
-- Before: only project members + super_admin
-- After:  also assigned user and task creator (so devs can see notes on their tasks)
DROP POLICY IF EXISTS "task_notes_select" ON public.task_notes;
CREATE POLICY "task_notes_select" ON public.task_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_notes.task_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_notes.task_id
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
  );
