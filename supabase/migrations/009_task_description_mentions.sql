CREATE OR REPLACE FUNCTION public.handle_task_description_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_token text;
  mentioned_user_id uuid;
  new_ids uuid[] := '{}';
  old_ids uuid[] := '{}';
  plain_new text;
  plain_old text;
  actor_id uuid;
  actor_name text;
BEGIN
  actor_id := auth.uid();
  actor_name := COALESCE((SELECT full_name FROM public.profiles WHERE id = actor_id), 'Someone');

  plain_new := regexp_replace(COALESCE(NEW.description, ''), '<[^>]+>', ' ', 'g');
  plain_old := regexp_replace(COALESCE(OLD.description, ''), '<[^>]+>', ' ', 'g');

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(COALESCE(NEW.description, ''), 'data-mention-id="([0-9a-fA-F-]{36})"', 'g'))[1]
  LOOP
    BEGIN
      mentioned_user_id := mention_token::uuid;
    EXCEPTION WHEN others THEN
      mentioned_user_id := NULL;
    END;

    IF mentioned_user_id IS NOT NULL AND NOT (mentioned_user_id = ANY(new_ids)) THEN
      new_ids := array_append(new_ids, mentioned_user_id);
    END IF;
  END LOOP;

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(plain_new, '@([A-Za-z0-9 ]+)', 'g'))[1]
  LOOP
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE LOWER(full_name) = LOWER(TRIM(mention_token))
    LIMIT 1;

    IF mentioned_user_id IS NOT NULL AND NOT (mentioned_user_id = ANY(new_ids)) THEN
      new_ids := array_append(new_ids, mentioned_user_id);
    END IF;
  END LOOP;

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(COALESCE(OLD.description, ''), 'data-mention-id="([0-9a-fA-F-]{36})"', 'g'))[1]
  LOOP
    BEGIN
      mentioned_user_id := mention_token::uuid;
    EXCEPTION WHEN others THEN
      mentioned_user_id := NULL;
    END;

    IF mentioned_user_id IS NOT NULL AND NOT (mentioned_user_id = ANY(old_ids)) THEN
      old_ids := array_append(old_ids, mentioned_user_id);
    END IF;
  END LOOP;

  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(plain_old, '@([A-Za-z0-9 ]+)', 'g'))[1]
  LOOP
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE LOWER(full_name) = LOWER(TRIM(mention_token))
    LIMIT 1;

    IF mentioned_user_id IS NOT NULL AND NOT (mentioned_user_id = ANY(old_ids)) THEN
      old_ids := array_append(old_ids, mentioned_user_id);
    END IF;
  END LOOP;

  FOREACH mentioned_user_id IN ARRAY new_ids
  LOOP
    IF (actor_id IS NULL OR mentioned_user_id != actor_id)
      AND NOT (mentioned_user_id = ANY(old_ids)) THEN
      INSERT INTO public.notifications (user_id, type, task_id, message)
      VALUES (
        mentioned_user_id,
        'note_mention',
        NEW.id,
        actor_name || ' mentioned you in the description of "' || COALESCE(NEW.title, 'a task') || '"'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tasks_description_mentions_trigger ON public.tasks;
CREATE TRIGGER tasks_description_mentions_trigger
  AFTER INSERT OR UPDATE OF description ON public.tasks
  FOR EACH ROW
  WHEN (NEW.description IS NOT NULL AND NEW.description <> '')
  EXECUTE FUNCTION public.handle_task_description_mentions();
