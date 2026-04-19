DROP POLICY IF EXISTS "task_notes_update" ON public.task_notes;
CREATE POLICY "task_notes_update" ON public.task_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_task_note_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_token text;
  mentioned_user_id uuid;
  mention_ids uuid[] := '{}';
  old_mention_ids uuid[] := '{}';
  plain_new text;
  plain_old text;
  task_title text;
  author_name text;
BEGIN
  plain_new := regexp_replace(COALESCE(NEW.content, ''), '<[^>]+>', ' ', 'g');
  plain_old := regexp_replace(COALESCE(OLD.content, ''), '<[^>]+>', ' ', 'g');
  task_title := COALESCE((SELECT title FROM public.tasks WHERE id = NEW.task_id), 'a task');
  author_name := COALESCE((SELECT full_name FROM public.profiles WHERE id = NEW.author_id), 'Someone');

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(COALESCE(NEW.content, ''), 'data-mention-id="([0-9a-fA-F-]{36})"', 'g'))[1]
  LOOP
    BEGIN
      mentioned_user_id := mention_token::uuid;
    EXCEPTION WHEN others THEN
      mentioned_user_id := NULL;
    END;

    IF mentioned_user_id IS NOT NULL
      AND mentioned_user_id != NEW.author_id
      AND NOT (mentioned_user_id = ANY(mention_ids)) THEN
      mention_ids := array_append(mention_ids, mentioned_user_id);
    END IF;
  END LOOP;

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(plain_new, '@([A-Za-z0-9 ]+)', 'g'))[1]
  LOOP
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE LOWER(full_name) = LOWER(TRIM(mention_token))
    LIMIT 1;

    IF mentioned_user_id IS NOT NULL
      AND mentioned_user_id != NEW.author_id
      AND NOT (mentioned_user_id = ANY(mention_ids)) THEN
      mention_ids := array_append(mention_ids, mentioned_user_id);
    END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' THEN
    FOR mention_token IN
      SELECT DISTINCT (regexp_matches(COALESCE(OLD.content, ''), 'data-mention-id="([0-9a-fA-F-]{36})"', 'g'))[1]
    LOOP
      BEGIN
        mentioned_user_id := mention_token::uuid;
      EXCEPTION WHEN others THEN
        mentioned_user_id := NULL;
      END;

      IF mentioned_user_id IS NOT NULL
        AND mentioned_user_id != NEW.author_id
        AND NOT (mentioned_user_id = ANY(old_mention_ids)) THEN
        old_mention_ids := array_append(old_mention_ids, mentioned_user_id);
      END IF;
    END LOOP;

    FOR mention_token IN
      SELECT DISTINCT (regexp_matches(plain_old, '@([A-Za-z0-9 ]+)', 'g'))[1]
    LOOP
      SELECT id INTO mentioned_user_id
      FROM public.profiles
      WHERE LOWER(full_name) = LOWER(TRIM(mention_token))
      LIMIT 1;

      IF mentioned_user_id IS NOT NULL
        AND mentioned_user_id != NEW.author_id
        AND NOT (mentioned_user_id = ANY(old_mention_ids)) THEN
        old_mention_ids := array_append(old_mention_ids, mentioned_user_id);
      END IF;
    END LOOP;
  END IF;

  FOREACH mentioned_user_id IN ARRAY mention_ids
  LOOP
    IF NOT (mentioned_user_id = ANY(old_mention_ids)) THEN
      INSERT INTO public.notifications (user_id, type, task_id, message)
      VALUES (
        mentioned_user_id,
        'note_mention',
        NEW.task_id,
        author_name || ' mentioned you in a note on "' || task_title || '"'
      );
    END IF;
  END LOOP;

  NEW.mentions := mention_ids;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS task_note_mentions_trigger ON public.task_notes;
CREATE TRIGGER task_note_mentions_trigger
  BEFORE INSERT OR UPDATE OF content ON public.task_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_note_mentions();
