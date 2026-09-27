-- 027_security_hardening.sql
-- OWASP A01 (Broken Access Control) fixes found in a security audit.
-- Safe to re-run.

BEGIN;

-- ── 1. workspace_members: no self-insert ─────────────────────────────────────
-- Previously `user_id = auth.uid()` let ANY authenticated user insert themselves
-- into ANY workspace with ANY role (e.g. super_admin) given its id.
-- Creating/joining goes through SECURITY DEFINER RPCs (create_workspace,
-- join_workspace_by_code), which bypass RLS, so only super_admins need INSERT.
DROP POLICY IF EXISTS workspace_members_insert ON public.workspace_members;
CREATE POLICY workspace_members_insert ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

-- ── 2. profiles: users may only change display fields ────────────────────────
-- profiles_update_own had no column restriction, so a user could set
-- role = 'super_admin' (global admin in several policies) or change their email
-- (used by join_workspace_by_code to match email-restricted invites).
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;
GRANT INSERT (id, full_name, avatar_url) ON public.profiles TO authenticated;

-- ── 3. join_workspace_by_code: trust auth.users email, require a session ─────
CREATE OR REPLACE FUNCTION public.join_workspace_by_code(p_invite_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_member_exists BOOLEAN;
  v_user_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM public.workspace_invitations
  WHERE UPPER(invite_code) = UPPER(p_invite_code)
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invite code');
  END IF;

  IF v_invitation.email IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
    IF v_user_email IS NULL OR LOWER(v_user_email) <> LOWER(v_invitation.email) THEN
      RETURN json_build_object('error', 'This invitation was sent to a different email address');
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id AND user_id = auth.uid()
  ) INTO v_member_exists;

  IF v_member_exists THEN
    RETURN json_build_object('workspace_id', v_invitation.workspace_id, 'already_member', true);
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_invitation.workspace_id, auth.uid(), 'developer')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE public.workspace_invitations
  SET accepted_at = NOW(), accepted_by = auth.uid()
  WHERE id = v_invitation.id;

  RETURN json_build_object('workspace_id', v_invitation.workspace_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_workspace_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_workspace_by_code(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_workspace(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- ── 4. workspace_invitations: only super_admins may edit ─────────────────────
-- Previously any member could change an invitation's email/code/expiry.
DROP POLICY IF EXISTS workspace_invitations_update ON public.workspace_invitations;
CREATE POLICY workspace_invitations_update ON public.workspace_invitations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );

-- ── 5. workspace_id always derives from the parent row ───────────────────────
-- The BEFORE INSERT triggers only filled workspace_id when NULL, so a client could
-- supply a mismatched workspace_id (e.g. a note on another workspace's task).
-- Always overwrite it (SECURITY DEFINER so the lookup does not depend on the
-- caller's RLS visibility); the INSERT policies' WITH CHECK then verifies the
-- caller belongs to that workspace — RLS checks run after BEFORE triggers.
CREATE OR REPLACE FUNCTION public.set_task_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT workspace_id INTO NEW.workspace_id FROM public.projects WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_task_note_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT workspace_id INTO NEW.workspace_id FROM public.tasks WHERE id = NEW.task_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_member_workspace_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT workspace_id INTO NEW.workspace_id FROM public.projects WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$;

-- ── 6. task_notes: can only be added to tasks in the caller's workspaces ─────
DROP POLICY IF EXISTS task_notes_insert ON public.task_notes;
CREATE POLICY task_notes_insert ON public.task_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND workspace_id IS NOT NULL
    AND public.is_workspace_member(workspace_id)
  );

-- ── 7. tasks: created_by must be the caller ──────────────────────────────────
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = tasks.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- ── 8. tasks update: lock workspace/project/creator for non-PMs ──────────────
-- Role is now looked up by OLD.workspace_id (NEW.workspace_id was attacker-chosen),
-- workspace_id is immutable, and developers can't move tasks or rewrite created_by.
CREATE OR REPLACE FUNCTION public.enforce_task_field_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_is_project_pm BOOLEAN := FALSE;
BEGIN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'A task cannot be moved to another workspace.';
  END IF;

  -- Service role / SQL editor (no JWT) is unrestricted
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT wm.role INTO v_role
  FROM workspace_members wm
  WHERE wm.workspace_id = OLD.workspace_id
    AND wm.user_id = auth.uid();

  IF v_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF v_role = 'pm' THEN
    SELECT EXISTS(
      SELECT 1 FROM project_managers pmg
      WHERE pmg.project_id = OLD.project_id
        AND pmg.user_id = auth.uid()
    ) INTO v_is_project_pm;

    IF v_is_project_pm THEN
      IF OLD.project_id IS DISTINCT FROM NEW.project_id
         AND (SELECT workspace_id FROM projects WHERE id = NEW.project_id) IS DISTINCT FROM OLD.workspace_id THEN
        RAISE EXCEPTION 'A task cannot be moved to a project in another workspace.';
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  -- Developer (or PM not assigned to this project): only status and url allowed to change
  IF (OLD.title IS DISTINCT FROM NEW.title)
  OR (OLD.description IS DISTINCT FROM NEW.description)
  OR (OLD.priority IS DISTINCT FROM NEW.priority)
  OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  OR (OLD.estimation IS DISTINCT FROM NEW.estimation)
  OR (OLD.deadline IS DISTINCT FROM NEW.deadline)
  OR (OLD.project_id IS DISTINCT FROM NEW.project_id)
  OR (OLD.created_by IS DISTINCT FROM NEW.created_by) THEN
    RAISE EXCEPTION 'Only the project PM or admin can update task fields other than status and url.';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 9. Storage: uploads only into the caller's own folder ────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload task images" ON storage.objects;
CREATE POLICY "Authenticated users can upload task images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
