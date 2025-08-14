-- Get all tables and their columns with constraints
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRIMARY KEY'
        WHEN tc.constraint_type = 'FOREIGN KEY' THEN 'FOREIGN KEY -> ' || ccu.table_name || '(' || ccu.column_name || ')'
        WHEN tc.constraint_type = 'UNIQUE' THEN 'UNIQUE'
        ELSE tc.constraint_type
    END as constraint_info
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
LEFT JOIN information_schema.key_column_usage kcu ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name AND c.table_schema = kcu.table_schema
LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;