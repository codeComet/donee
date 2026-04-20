ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notifications_actor_id_idx ON public.notifications(actor_id);

CREATE OR REPLACE FUNCTION public.handle_task_update_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_name TEXT;
  v_actor_id     UUID;
BEGIN
  v_actor_id := auth.uid();

  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = NEW.project_id;
    INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
    VALUES (
      NEW.assigned_to,
      'task_assigned',
      NEW.id,
      'You have been assigned to task: ' || NEW.title || ' in project ' || COALESCE(v_project_name, ''),
      v_actor_id
    );
  END IF;

  RETURN NEW;
END;
$$;

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

  IF v_creator_role = 'developer' THEN
    INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
    SELECT id,
           'task_created',
           NEW.id,
           COALESCE(v_creator_name, 'A developer')
             || ' created task "' || NEW.title
             || '" in ' || COALESCE(v_project_name, 'a project'),
           NEW.created_by
      FROM public.profiles
     WHERE role = 'super_admin';

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
      INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
      VALUES (
        mentioned_user_id,
        'note_mention',
        NEW.task_id,
        author_name || ' mentioned you in a note on "' || task_title || '"',
        NEW.author_id
      );
    END IF;
  END LOOP;

  NEW.mentions := mention_ids;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_task_description_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mention_token text;
  mentioned_user_id uuid;
  new_ids uuid[] := '{}';
  old_ids uuid[] := '{}';
  plain_new text;
  plain_old text;
  v_actor_id uuid;
  v_actor_name text;
BEGIN
  v_actor_id := auth.uid();
  v_actor_name := COALESCE((SELECT full_name FROM public.profiles WHERE id = v_actor_id), 'Someone');

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
    IF (v_actor_id IS NULL OR mentioned_user_id != v_actor_id)
      AND NOT (mentioned_user_id = ANY(old_ids)) THEN
      INSERT INTO public.notifications (user_id, type, task_id, message, actor_id)
      VALUES (
        mentioned_user_id,
        'note_mention',
        NEW.id,
        v_actor_name || ' mentioned you in the description of "' || COALESCE(NEW.title, 'a task') || '"',
        v_actor_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

