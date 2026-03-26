-- Add index on pop_final for performance
-- This index is used for filtering and sorting BUAs by population
CREATE INDEX IF NOT EXISTS idx_bua_pop_final
ON public.built_up_areas USING btree (pop_final)
TABLESPACE pg_default;
