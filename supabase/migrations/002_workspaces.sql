-- ============================================================
-- Donee — Workspace Migration
-- Run AFTER 001_init.sql
-- ============================================================

-- ============================================================
-- NEW TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         TEXT        NOT NULL DEFAULT 'developer'
                           CHECK (role IN ('super_admin', 'pm', 'developer')),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email        TEXT,
  invite_code  TEXT        NOT NULL UNIQUE DEFAULT UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 8)),
  invited_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  accepted_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- ADD workspace_id TO EXISTING TABLES (nullable for backfill)
-- ============================================================

ALTER TABLE public.projects        ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks           ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.task_notes      ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.notifications   ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Extend notification types to support workspace_invite (preserve task_created if already in use)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_assigned', 'note_mention', 'task_created', 'workspace_invite'));

-- ============================================================
-- BACKFILL: create "Intoit Group" workspace, migrate all data
-- ============================================================

DO $$
DECLARE
  v_workspace_id UUID;
  v_creator_id   UUID;
BEGIN
  -- Use first super_admin or first user as workspace creator
  SELECT id INTO v_creator_id FROM public.profiles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1;
  IF v_creator_id IS NULL THEN
    SELECT id INTO v_creator_id FROM public.profiles ORDER BY created_at LIMIT 1;
  END IF;

  -- Create the default workspace
  INSERT INTO public.workspaces (name, created_by)
  VALUES ('Intoit Group', v_creator_id)
  RETURNING id INTO v_workspace_id;

  -- Add all existing profiles as workspace members (preserve their current role)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT v_workspace_id, id, role
  FROM public.profiles
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Backfill workspace_id on all existing rows
  UPDATE public.projects        SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.project_members SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.tasks           SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.task_notes      SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.notifications   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
END $$;

-- Make workspace_id NOT NULL on the primary entities after backfill
ALTER TABLE public.projects        ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tasks           ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.project_members ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================================
-- TRIGGERS: auto-set workspace_id on insert
-- ============================================================

-- Tasks inherit workspace_id from their project
CREATE OR REPLACE FUNCTION public.set_task_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_workspace_id_trigger
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_workspace_id();

-- task_notes inherit workspace_id from their task
CREATE OR REPLACE FUNCTION public.set_task_note_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.tasks WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_notes_set_workspace_id_trigger
  BEFORE INSERT ON public.task_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_task_note_workspace_id();

-- project_members inherit workspace_id from their project
CREATE OR REPLACE FUNCTION public.set_project_member_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER project_members_set_workspace_id_trigger
  BEFORE INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.set_project_member_workspace_id();

-- notifications inherit workspace_id from their task (when task_id set)
CREATE OR REPLACE FUNCTION public.set_notification_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.task_id IS NOT NULL THEN
    SELECT workspace_id INTO NEW.workspace_id FROM public.tasks WHERE id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_set_workspace_id_trigger
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_notification_workspace_id();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS workspace_members_workspace_idx    ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_idx         ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_invitations_code_idx     ON public.workspace_invitations(invite_code);
CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS projects_workspace_idx             ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS tasks_workspace_idx                ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS project_members_workspace_idx      ON public.project_members(workspace_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- ---- workspaces ----
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspaces.id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspaces.id AND wm.user_id = auth.uid() AND wm.role = 'super_admin'
    )
  );

-- ---- workspace_members ----
CREATE POLICY "workspace_members_select" ON public.workspace_members FOR SELECT TO authenticated
  USING (
    -- Can see own membership
    user_id = auth.uid()
    -- OR fellow workspace members
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm2
      WHERE wm2.workspace_id = workspace_members.workspace_id AND wm2.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (
    -- Self-join (accepting invite)
    user_id = auth.uid()
    -- OR workspace super_admin adding someone
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

CREATE POLICY "workspace_members_update" ON public.workspace_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

CREATE POLICY "workspace_members_delete" ON public.workspace_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

-- ---- workspace_invitations ----
CREATE POLICY "workspace_invitations_select" ON public.workspace_invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_invitations_insert" ON public.workspace_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

CREATE POLICY "workspace_invitations_update" ON public.workspace_invitations FOR UPDATE TO authenticated
  USING (
    -- Invitee can accept
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id AND wm.user_id = auth.uid()
    )
  );

-- ---- Drop + recreate workspace-scoped policies for projects ----
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
        AND wm.role IN ('super_admin', 'pm')
    )
  );

CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
    OR (
      pm_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
          AND wm.role = 'pm'
      )
    )
  );

CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

-- ---- project_members: workspace-scoped ----
DROP POLICY IF EXISTS "project_members_select"  ON public.project_members;
DROP POLICY IF EXISTS "project_members_insert"  ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete"  ON public.project_members;

CREATE POLICY "project_members_select" ON public.project_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = project_members.workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = project_members.workspace_id AND wm.user_id = auth.uid()
        AND wm.role IN ('super_admin', 'pm')
    )
  );

CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = project_members.workspace_id AND wm.user_id = auth.uid()
        AND wm.role IN ('super_admin', 'pm')
    )
  );

-- ---- tasks: workspace-scoped ----
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
          AND wm.role = 'pm'
      )
      AND EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = tasks.project_id AND pr.pm_id = auth.uid()
      )
    )
    OR tasks.assigned_to = auth.uid()
    OR tasks.created_by = auth.uid()
  );

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id AND wm.user_id = auth.uid()
        AND wm.role IN ('super_admin', 'pm')
    )
    OR tasks.created_by = auth.uid()
  );

-- ---- task_notes: workspace-scoped ----
DROP POLICY IF EXISTS "task_notes_select" ON public.task_notes;
DROP POLICY IF EXISTS "task_notes_insert" ON public.task_notes;

CREATE POLICY "task_notes_select" ON public.task_notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = task_notes.task_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = task_notes.workspace_id AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

CREATE POLICY "task_notes_insert" ON public.task_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- ---- profiles: also allow workspace super_admins to update members ----
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (
    -- Global super_admin
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    -- OR workspace super_admin can update profiles of their workspace members
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      JOIN public.workspace_members target ON target.workspace_id = wm.workspace_id AND target.user_id = profiles.id
      WHERE wm.user_id = auth.uid() AND wm.role = 'super_admin'
    )
  );

-- ============================================================
-- FUNCTION: join workspace via invite code
-- ============================================================

CREATE OR REPLACE FUNCTION public.join_workspace_by_code(p_invite_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation RECORD;
  v_member_exists BOOLEAN;
  v_user_email TEXT;
BEGIN
  -- Find valid invitation
  SELECT * INTO v_invitation
  FROM public.workspace_invitations
  WHERE UPPER(invite_code) = UPPER(p_invite_code)
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invite code');
  END IF;

  -- Check email restriction if invite is email-specific
  IF v_invitation.email IS NOT NULL THEN
    SELECT email INTO v_user_email FROM public.profiles WHERE id = auth.uid();
    IF LOWER(v_user_email) != LOWER(v_invitation.email) THEN
      RETURN json_build_object('error', 'This invitation was sent to a different email address');
    END IF;
  END IF;

  -- Check if already a member
  SELECT EXISTS(
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id AND user_id = auth.uid()
  ) INTO v_member_exists;

  IF v_member_exists THEN
    RETURN json_build_object('workspace_id', v_invitation.workspace_id, 'already_member', true);
  END IF;

  -- Add as member with developer role
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, auth.uid(), 'developer')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark invitation accepted
  UPDATE public.workspace_invitations
  SET accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = v_invitation.id;

  RETURN json_build_object('workspace_id', v_invitation.workspace_id);
END;
$$;

-- ============================================================
-- TRIGGER: notify user when added to workspace
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_workspace_member_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_workspace_name TEXT;
BEGIN
  SELECT name INTO v_workspace_name FROM public.workspaces WHERE id = NEW.workspace_id;

  INSERT INTO public.notifications (user_id, type, workspace_id, message)
  VALUES (
    NEW.user_id,
    'workspace_invite',
    NEW.workspace_id,
    'You have been added to workspace: ' || COALESCE(v_workspace_name, 'a workspace')
  );

  RETURN NEW;
END;
$$;

-- Only fire for new non-backfill inserts. We wrap in a DO block to avoid
-- the trigger firing on rows inserted earlier in this migration.
CREATE TRIGGER workspace_member_added_notification_trigger
  AFTER INSERT ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_member_added();

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
