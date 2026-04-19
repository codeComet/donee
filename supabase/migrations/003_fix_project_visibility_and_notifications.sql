-- ============================================================
-- Migration 003 — Scoped project visibility + task_created notifications
-- Run in Supabase SQL Editor
-- ============================================================

-- ---- projects_select (role-aware, replaces the permissive USING(true) from 002) ----
-- developer : only projects they are a member of
-- pm        : projects where pm_id = them + projects they are a member of
-- super_admin: all projects
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR pm_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = id AND pm.user_id = auth.uid())
  );

-- ---- tasks_insert (match the same scope as projects_select) ----
-- Before (002): WITH CHECK (true) — too permissive
-- After: developer can insert into member projects, PM into their projects, admin anywhere
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = tasks.project_id AND pr.pm_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid())
  );

-- ---- Add task_created notification type ----
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_assigned', 'note_mention', 'task_created'));

-- ---- Update task insert trigger ----
-- When a developer creates a task:
--   1. Still notify the assigned user (existing behaviour)
--   2. Notify every super_admin
--   3. Notify the project PM (if any, and not the same person as creator)
CREATE OR REPLACE FUNCTION public.handle_task_insert_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_name TEXT;
  v_pm_id        UUID;
  v_creator_name TEXT;
  v_creator_role TEXT;
BEGIN
  SELECT name, pm_id
    INTO v_project_name, v_pm_id
    FROM public.projects
   WHERE id = NEW.project_id;

  SELECT full_name, role
    INTO v_creator_name, v_creator_role
    FROM public.profiles
   WHERE id = NEW.created_by;

  -- (1) Notify assigned user
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, task_id, message)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      NEW.id,
      'You have been assigned to task: ' || NEW.title
        || ' in project ' || COALESCE(v_project_name, '')
    );
  END IF;

  -- (2 + 3) When a developer creates a task, notify super_admins + PM
  IF v_creator_role = 'developer' THEN
    -- All super_admins
    INSERT INTO public.notifications (user_id, type, task_id, message)
    SELECT id,
           'task_created',
           NEW.id,
           COALESCE(v_creator_name, 'A developer')
             || ' created task "' || NEW.title
             || '" in ' || COALESCE(v_project_name, 'a project')
      FROM public.profiles
     WHERE role = 'super_admin';

    -- Project PM (skip if PM is also the creator or is a super_admin already notified)
    IF v_pm_id IS NOT NULL AND v_pm_id <> COALESCE(NEW.created_by, v_pm_id) THEN
      INSERT INTO public.notifications (user_id, type, task_id, message)
      VALUES (
        v_pm_id,
        'task_created',
        NEW.id,
        COALESCE(v_creator_name, 'A developer')
          || ' created task "' || NEW.title
          || '" in ' || COALESCE(v_project_name, 'a project')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
