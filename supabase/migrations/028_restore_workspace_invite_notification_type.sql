-- 003_fix_project_visibility_and_notifications sorts after 002_workspaces and drops 'workspace_invite'
-- from the check, breaking handle_workspace_member_added on fresh setups. Prod already has this (no-op there).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_assigned', 'note_mention', 'task_created', 'workspace_invite'));
