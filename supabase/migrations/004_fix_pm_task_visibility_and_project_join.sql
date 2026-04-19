-- ============================================================
-- Migration 004 — Fix PM task visibility + project join for assigned devs
-- Run in Supabase SQL Editor
-- ============================================================

-- ---- projects_select ----
-- Problem: developer assigned to a task in a project couldn't see
--          project row → nested join in tasks query returns task.project = null.
-- Fix: also allow SELECT on a project if the user is assigned to any task in it.
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (
    -- super_admin sees all
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- PM sees their own projects
    OR pm_id = auth.uid()
    -- project members see their projects
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = id AND pm.user_id = auth.uid())
    -- developer assigned to a task in this project can see the project (needed for join)
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.project_id = id AND t.assigned_to = auth.uid())
  );

-- ---- tasks_select ----
-- Problem: PM is set as pm_id on project but is NOT in project_members
--          → PM cannot see tasks in their own project.
-- Fix: add pm_id check.
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    -- super_admin
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- PM of the project
    OR EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = tasks.project_id AND pr.pm_id = auth.uid())
    -- project member
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
    -- assigned user
    OR tasks.assigned_to = auth.uid()
    -- task creator
    OR tasks.created_by = auth.uid()
  );

-- ---- task_notes_select ----
-- Same PM gap: PM couldn't see notes on tasks in their projects.
DROP POLICY IF EXISTS "task_notes_select" ON public.task_notes;
CREATE POLICY "task_notes_select" ON public.task_notes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.projects pr ON pr.id = t.project_id
      WHERE t.id = task_notes.task_id AND pr.pm_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_notes.task_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_notes.task_id
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
  );
