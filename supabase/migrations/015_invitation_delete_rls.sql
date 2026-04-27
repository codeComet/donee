-- Add missing DELETE policy for workspace_invitations
-- Without this, RLS blocks all deletes (super_admin or inviter)

CREATE POLICY "workspace_invitations_delete" ON public.workspace_invitations FOR DELETE TO authenticated
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'super_admin'
    )
  );
