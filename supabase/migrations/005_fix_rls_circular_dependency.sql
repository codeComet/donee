-- ============================================================
-- Migration 005 — Fix circular RLS dependency (infinite recursion)
-- Run in Supabase SQL Editor
-- ============================================================
--
-- Root cause: migration 004 created a circular dependency:
--   projects_select → EXISTS (SELECT FROM tasks) → tasks_select
--   tasks_select    → EXISTS (SELECT FROM projects) → projects_select
--                                                    ↑ loops forever
--
-- Postgres throws "infinite recursion detected in policy for relation 'projects'"
-- which Next.js silently swallows via `?? []`, returning empty data everywhere.
--
-- Fix: SECURITY DEFINER helper functions query the other table bypassing RLS,
-- breaking the cycle entirely.
-- ============================================================

-- ---- Helper: is user PM of a project? (bypasses RLS on projects) ----
CREATE OR REPLACE FUNCTION public.user_is_project_pm(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND pm_id = p_user_id
  );
$$;

-- ---- Helper: does user have any task assigned in a project? (bypasses RLS on tasks) ----
CREATE OR REPLACE FUNCTION public.user_has_task_in_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE project_id = p_project_id AND assigned_to = p_user_id
  );
$$;

-- ---- projects_select ----
-- Replaces 004 version. Uses SECURITY DEFINER fn for tasks lookup → no recursion.
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (
    -- super_admin sees all
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- PM sees their own projects
    OR pm_id = auth.uid()
    -- project members see their projects
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = id AND pm.user_id = auth.uid())
    -- developer assigned to a task sees the project (needed for join; uses SECURITY DEFINER → no recursion)
    OR public.user_has_task_in_project(id, auth.uid())
  );

-- ---- tasks_select ----
-- Replaces 004 version. Uses SECURITY DEFINER fn for PM check → no recursion.
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    -- super_admin
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- PM of the project (SECURITY DEFINER → bypasses projects RLS → no recursion)
    OR public.user_is_project_pm(tasks.project_id, auth.uid())
    -- project member
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
    -- assigned user
    OR tasks.assigned_to = auth.uid()
    -- task creator
    OR tasks.created_by = auth.uid()
  );

-- ---- tasks_insert ----
-- Also fix: the migration 003 version references projects table directly,
-- which now goes through the fixed projects_select (safe), but use SECURITY DEFINER for clarity.
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR public.user_is_project_pm(tasks.project_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
  );

-- ---- task_notes_select ----
-- Replaces 004 version. Uses SECURITY DEFINER fn for PM check → no recursion.
DROP POLICY IF EXISTS "task_notes_select" ON public.task_notes;
CREATE POLICY "task_notes_select" ON public.task_notes FOR SELECT TO authenticated
  USING (
    -- super_admin
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- PM of the task's project (SECURITY DEFINER → no recursion)
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_notes.task_id
        AND public.user_is_project_pm(t.project_id, auth.uid())
    )
    -- project member
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_notes.task_id AND pm.user_id = auth.uid()
    )
    -- assigned user or task creator
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_notes.task_id
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
  );
