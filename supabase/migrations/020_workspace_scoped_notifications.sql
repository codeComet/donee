-- Migration 020 — Scope task_created notifications to the task's workspace
-- Problem: handle_task_insert_notification notified ALL super_admins globally.
-- Fix: join workspace_members so only super_admins in the same workspace are notified.

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
    INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      NEW.id,
      'You have been assigned to task: ' || NEW.title
        || ' in project ' || COALESCE(v_project_name, ''),
      NEW.created_by
    );
  END IF;

  -- (2 + 3) When a developer creates a task, notify super_admins + PM
  --         Scoped to the task's workspace only.
  IF v_creator_role = 'developer' THEN
    -- Super_admins who are members of this workspace
    INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
    SELECT p.id,
           'task_created',
           NEW.id,
           COALESCE(v_creator_name, 'A developer')
             || ' created task "' || NEW.title
             || '" in ' || COALESCE(v_project_name, 'a project'),
           NEW.created_by
      FROM public.profiles p
      JOIN public.workspace_members wm
        ON wm.user_id = p.id
       AND wm.workspace_id = NEW.workspace_id
     WHERE p.role = 'super_admin';

    -- Project PM (skip if PM is creator)
    IF v_pm_id IS NOT NULL AND v_pm_id <> COALESCE(NEW.created_by, v_pm_id) THEN
      INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
      VALUES (
        v_pm_id,
        'task_created',
        NEW.id,
        COALESCE(v_creator_name, 'A developer')
          || ' created task "' || NEW.title
          || '" in ' || COALESCE(v_project_name, 'a project'),
        NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
