CREATE OR REPLACE FUNCTION get_category_descendants(input_ids uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result_ids uuid[];
  current_id uuid;
  child_ids uuid[];
  visited_ids uuid[] := ARRAY[]::uuid[];
  queue_ids uuid[];
BEGIN
  -- Start with input IDs
  queue_ids := input_ids;
  result_ids := input_ids;

  -- Breadth-first search for all descendants
  WHILE array_length(queue_ids, 1) > 0 LOOP
    -- Pop first item from queue
    current_id := queue_ids[1];
    queue_ids := queue_ids[2:array_length(queue_ids, 1)];

    -- Skip if already visited (cycle protection)
    IF current_id = ANY(visited_ids) THEN
      CONTINUE;
    END IF;
    visited_ids := array_append(visited_ids, current_id);

    -- Find direct children
    SELECT array_agg(id)
    INTO child_ids
    FROM categories
    WHERE parent_category_id = current_id;

    -- Add children to results and queue
    IF child_ids IS NOT NULL THEN
      -- Add new children to results
      result_ids := result_ids || child_ids;

      -- Add new children to queue for processing
      queue_ids := queue_ids || child_ids;
    END IF;
  END LOOP;

  -- Remove duplicates and return
  SELECT array_agg(DISTINCT id)
  INTO result_ids
  FROM unnest(result_ids) AS id;

  RETURN COALESCE(result_ids, input_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_category_descendants(uuid[]) TO authenticated, anon;

COMMENT ON FUNCTION get_category_descendants IS
'Expands category IDs to include all descendant categories. Guards against cycles.';
