-- ============================================================
-- Migration 007 — Supabase Storage bucket for task images
--               + Update mention trigger to handle HTML content
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Storage bucket: task-images ──────────────────────────────
-- Public bucket (images are embedded via public URL in rich-text content)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-images',
  'task-images',
  true,
  5242880,  -- 5 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload task images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-images');

-- Public read access (images referenced by src= in HTML)
CREATE POLICY "Public can view task images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'task-images');

-- Users can delete only their own uploads (folder = their user id)
CREATE POLICY "Users can delete own task images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Update mention trigger to strip HTML before matching ─────
-- task_notes now stores HTML (from Tiptap WYSIWYG editor).
-- Strip HTML tags before running the @mention regex so the trigger
-- still correctly extracts "John Doe" from "@John Doe" even when
-- the content contains HTML tags around it.

CREATE OR REPLACE FUNCTION public.handle_task_note_mentions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plain_content   TEXT;
  mention_token   TEXT;
  mentioned_uid   UUID;
  mention_ids     UUID[] := '{}';
  v_task_title    TEXT;
  v_author_name   TEXT;
BEGIN
  SELECT title     INTO v_task_title  FROM public.tasks    WHERE id = NEW.task_id;
  SELECT full_name INTO v_author_name FROM public.profiles WHERE id = NEW.author_id;

  -- Strip HTML tags so @mentions inside <span> etc. are found correctly
  plain_content := regexp_replace(NEW.content, '<[^>]+>', ' ', 'g');

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(plain_content, '@([\w][\w\s]*[\w]|[\w]+)', 'g'))[1]
  LOOP
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
