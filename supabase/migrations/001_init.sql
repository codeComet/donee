-- ============================================================
-- Donee — Full Schema Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  email       TEXT,
  role        TEXT        NOT NULL DEFAULT 'developer'
                          CHECK (role IN ('super_admin', 'pm', 'developer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. projects
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  color       TEXT        NOT NULL DEFAULT '#6366f1',
  pm_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_archived BOOLEAN     NOT NULL DEFAULT FALSE
);

-- 3. project_members
CREATE TABLE IF NOT EXISTS public.project_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- 4. tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  priority    TEXT        CHECK (priority IN ('lowest', 'low', 'medium', 'high', 'critical')),
  status      TEXT        NOT NULL DEFAULT 'backlog'
                          CHECK (status IN (
                            'backlog', 'in_progress', 'estimation', 'review',
                            'done_in_staging', 'waiting_for_confirmation', 'paused', 'done'
                          )),
  assigned_to UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimation  TEXT,
  url         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. task_notes
CREATE TABLE IF NOT EXISTS public.task_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mentions    UUID[]      NOT NULL DEFAULT '{}'
);

-- 6. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('task_assigned', 'note_mention')),
  task_id     UUID        REFERENCES public.tasks(id) ON DELETE CASCADE,
  message     TEXT,
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS tasks_project_id_idx       ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx      ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx           ON public.tasks(status);
CREATE INDEX IF NOT EXISTS task_notes_task_id_idx     ON public.task_notes(task_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx  ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS project_members_user_idx   ON public.project_members(user_id);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY "profiles_select_all"    ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own"    ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
-- super_admin can update any profile (for role management)
CREATE POLICY "profiles_update_admin"  ON public.profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ---- projects ----
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = id AND pm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'pm'))
  );

CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR pm_id = auth.uid()
  );

CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ---- project_members ----
CREATE POLICY "project_members_select" ON public.project_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'pm'))
  );

CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'pm'))
  );

-- ---- tasks ----
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'pm')
      AND EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = tasks.project_id AND pr.pm_id = auth.uid())
    )
    OR tasks.assigned_to = auth.uid()
    OR tasks.created_by = auth.uid()
  );

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'pm'))
    OR tasks.created_by = auth.uid()
  );

-- ---- task_notes ----
CREATE POLICY "task_notes_select" ON public.task_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_notes.task_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

CREATE POLICY "task_notes_insert" ON public.task_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ---- notifications ----
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at on tasks
CREATE OR REPLACE FUNCTION public.handle_task_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_updated_at();

-- Auto-create profile on auth.users INSERT (Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    'developer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Handle @mentions in task_notes and create notification rows
CREATE OR REPLACE FUNCTION public.handle_task_note_mentions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mention_token   TEXT;
  mentioned_uid   UUID;
  mention_ids     UUID[] := '{}';
  v_task_title    TEXT;
  v_author_name   TEXT;
BEGIN
  -- Resolve task title and author name
  SELECT title INTO v_task_title FROM public.tasks WHERE id = NEW.task_id;
  SELECT full_name INTO v_author_name FROM public.profiles WHERE id = NEW.author_id;

  -- Extract every @Word sequence from the note content
  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(NEW.content, '@([\w][\w\s]*[\w]|[\w]+)', 'g'))[1]
  LOOP
    -- Attempt case-insensitive match on full_name
    SELECT id INTO mentioned_uid
    FROM public.profiles
    WHERE LOWER(full_name) = LOWER(TRIM(mention_token))
    LIMIT 1;

    IF mentioned_uid IS NOT NULL AND mentioned_uid <> NEW.author_id THEN
      mention_ids := array_append(mention_ids, mentioned_uid);

      INSERT INTO public.notifications (user_id, type, task_id, message)
      VALUES (
        mentioned_uid,
        'note_mention',
        NEW.task_id,
        v_author_name || ' mentioned you in a note on task: ' || v_task_title
      );
    END IF;
  END LOOP;

  NEW.mentions := mention_ids;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_note_mentions_trigger
  BEFORE INSERT ON public.task_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_note_mentions();

-- Handle task assignment notification on INSERT
CREATE OR REPLACE FUNCTION public.handle_task_insert_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_name TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;
    INSERT INTO public.notifications (user_id, type, task_id, message)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      NEW.id,
      'You have been assigned to task: ' || NEW.title || ' in project ' || COALESCE(v_project_name, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_insert_notification_trigger
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_insert_notification();

-- Handle task assignment notification on UPDATE (when assigned_to changes)
CREATE OR REPLACE FUNCTION public.handle_task_update_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_name TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;
    INSERT INTO public.notifications (user_id, type, task_id, message)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      NEW.id,
      'You have been assigned to task: ' || NEW.title || ' in project ' || COALESCE(v_project_name, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_update_notification_trigger
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_update_notification();

-- ============================================================
-- REALTIME (enable for notifications + tasks)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
