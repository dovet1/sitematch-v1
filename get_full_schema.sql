-- Get complete database schema including tables, columns, and all relationships

-- Tables and columns with data types
SELECT 
    'TABLE: ' || table_name as object,
    string_agg(
        column_name || ' ' || data_type || 
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        E',\n  ' ORDER BY ordinal_position
    ) as definition
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name

UNION ALL

-- Foreign key relationships
SELECT 
    'FK: ' || tc.table_name || '.' || kcu.column_name as object,
    ' -> ' || ccu.table_name || '(' || ccu.column_name || ')' as definition
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'

ORDER BY object;