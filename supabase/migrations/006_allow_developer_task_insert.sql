-- ============================================================
-- Migration 006 — Allow developers to insert tasks in their projects
-- Run in Supabase SQL Editor
-- ============================================================
--
-- Bug: tasks_insert (from 005) only allows super_admin, PM, project_member.
-- A developer assigned to tasks in a project is none of those → RLS violation.
--
-- Fix: add user_has_task_in_project() check so developers can insert tasks
-- into projects where they already have at least one task assigned.
--
-- Notification behaviour (already wired in migration 003 trigger):
--   handle_task_insert_notification() → when creator role = 'developer':
--     - notifies all super_admins
--     - notifies project PM (if different from creator)
--   No changes needed here.
-- ============================================================

DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    -- super_admin can insert anywhere
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- PM of the project
    OR public.user_is_project_pm(tasks.project_id, auth.uid())
    -- explicit project member
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
    -- developer already assigned to at least one task in this project
    OR public.user_has_task_in_project(tasks.project_id, auth.uid())
  );
