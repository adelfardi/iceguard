-- Persist the catalog vendor (implementation) so behaviour like Nessie commit-log history
-- is driven by stored data instead of being re-guessed from the name/URI on every request.

ALTER TABLE public.catalog_config ADD COLUMN vendor varchar(50);

-- Backfill existing rows from the old name/URI heuristic.
UPDATE public.catalog_config SET vendor =
    CASE
        WHEN lower(name || ' ' || uri) LIKE '%nessie%'  THEN 'NESSIE'
        WHEN lower(name || ' ' || uri) LIKE '%polaris%' THEN 'POLARIS'
        WHEN lower(name || ' ' || uri) LIKE '%unity%'   THEN 'UNITY'
        ELSE 'REST'
    END
WHERE vendor IS NULL;

ALTER TABLE public.catalog_config ALTER COLUMN vendor SET DEFAULT 'REST';
ALTER TABLE public.catalog_config ALTER COLUMN vendor SET NOT NULL;
