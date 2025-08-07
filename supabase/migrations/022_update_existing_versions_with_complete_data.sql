-- Migration: Update existing listing versions with complete data
-- This updates versions that only contain listing table data to include all related data

BEGIN;

-- Create a function to update version content with complete data
CREATE OR REPLACE FUNCTION update_version_with_complete_data(version_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    version_record RECORD;
    listing_record RECORD;
    content_json JSONB;
    contacts_data JSONB;
    locations_data JSONB;
    faqs_data JSONB;
    sectors_data JSONB;
    use_classes_data JSONB;
    files_data JSONB;
BEGIN
    -- Get the version and its listing
    SELECT v.*, l.*
    INTO version_record
    FROM listing_versions v
    JOIN listings l ON v.listing_id = l.id
    WHERE v.id = version_id_param;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Version not found: %', version_id_param;
        RETURN FALSE;
    END IF;
    
    -- Check if this version already has complete data (has contacts array)
    IF version_record.content ? 'contacts' THEN
        RAISE NOTICE 'Version % already has complete data, skipping', version_id_param;
        RETURN FALSE;
    END IF;
    
    -- Gather related data
    SELECT COALESCE(json_agg(lc.*), '[]'::json)::jsonb 
    INTO contacts_data
    FROM listing_contacts lc 
    WHERE lc.listing_id = version_record.listing_id;
    
    SELECT COALESCE(json_agg(ll.*), '[]'::json)::jsonb 
    INTO locations_data
    FROM listing_locations ll 
    WHERE ll.listing_id = version_record.listing_id;
    
    SELECT COALESCE(json_agg(f.* ORDER BY f.display_order), '[]'::json)::jsonb 
    INTO faqs_data
    FROM faqs f 
    WHERE f.listing_id = version_record.listing_id;
    
    SELECT COALESCE(json_agg(jsonb_build_object(
        'sector_id', ls.sector_id,
        'sector', jsonb_build_object('id', s.id, 'name', s.name)
    )), '[]'::json)::jsonb 
    INTO sectors_data
    FROM listing_sectors ls 
    JOIN sectors s ON ls.sector_id = s.id 
    WHERE ls.listing_id = version_record.listing_id;
    
    SELECT COALESCE(json_agg(jsonb_build_object(
        'use_class_id', luc.use_class_id,
        'use_class', jsonb_build_object('id', uc.id, 'name', uc.name, 'code', uc.code)
    )), '[]'::json)::jsonb 
    INTO use_classes_data
    FROM listing_use_classes luc 
    JOIN use_classes uc ON luc.use_class_id = uc.id 
    WHERE luc.listing_id = version_record.listing_id;
    
    SELECT COALESCE(json_agg(fu.* ORDER BY fu.display_order), '[]'::json)::jsonb 
    INTO files_data
    FROM file_uploads fu 
    WHERE fu.listing_id = version_record.listing_id;
    
    -- Build comprehensive content JSON
    -- Keep the existing listing data but add the related data
    content_json := jsonb_build_object(
        'listing', COALESCE(version_record.content->'listing', version_record.content),
        'contacts', contacts_data,
        'locations', locations_data,
        'faqs', faqs_data,
        'sectors', sectors_data,
        'use_classes', use_classes_data,
        'files', files_data,
        'snapshot_created_at', NOW()::text,
        'snapshot_created_by', version_record.created_by,
        'snapshot_status', version_record.status
    );
    
    -- Update the version with complete content
    UPDATE listing_versions
    SET content = content_json
    WHERE id = version_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update all existing versions that have incomplete data
DO $$
DECLARE
    version_rec RECORD;
    updated_count INTEGER := 0;
    skipped_count INTEGER := 0;
BEGIN
    FOR version_rec IN 
        SELECT id, listing_id, status
        FROM listing_versions
        WHERE content IS NOT NULL
        ORDER BY created_at ASC
    LOOP
        -- Update the version with complete data
        IF update_version_with_complete_data(version_rec.id) THEN
            updated_count := updated_count + 1;
        ELSE
            skipped_count := skipped_count + 1;
        END IF;
        
        -- Log progress every 10 versions
        IF (updated_count + skipped_count) % 10 = 0 THEN
            RAISE NOTICE 'Progress: % updated, % skipped', updated_count, skipped_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration complete: % versions updated, % skipped (already had complete data)', updated_count, skipped_count;
END $$;

-- Clean up the helper function
DROP FUNCTION update_version_with_complete_data(UUID);

-- Create initial versions for any listings that still don't have versions
INSERT INTO listing_versions (
    listing_id,
    version_number,
    content,
    status,
    created_by,
    reviewed_by,
    reviewed_at,
    is_live
)
SELECT 
    l.id,
    1,
    jsonb_build_object(
        'listing', to_jsonb(l.*),
        'contacts', COALESCE((SELECT json_agg(lc.*) FROM listing_contacts lc WHERE lc.listing_id = l.id), '[]'::json),
        'locations', COALESCE((SELECT json_agg(ll.*) FROM listing_locations ll WHERE ll.listing_id = l.id), '[]'::json),
        'faqs', COALESCE((SELECT json_agg(f.* ORDER BY f.display_order) FROM faqs f WHERE f.listing_id = l.id), '[]'::json),
        'sectors', COALESCE((
            SELECT json_agg(jsonb_build_object(
                'sector_id', ls.sector_id,
                'sector', jsonb_build_object('id', s.id, 'name', s.name)
            ))
            FROM listing_sectors ls 
            JOIN sectors s ON ls.sector_id = s.id 
            WHERE ls.listing_id = l.id
        ), '[]'::json),
        'use_classes', COALESCE((
            SELECT json_agg(jsonb_build_object(
                'use_class_id', luc.use_class_id,
                'use_class', jsonb_build_object('id', uc.id, 'name', uc.name, 'code', uc.code)
            ))
            FROM listing_use_classes luc 
            JOIN use_classes uc ON luc.use_class_id = uc.id 
            WHERE luc.listing_id = l.id
        ), '[]'::json),
        'files', COALESCE((SELECT json_agg(fu.* ORDER BY fu.display_order) FROM file_uploads fu WHERE fu.listing_id = l.id), '[]'::json),
        'snapshot_created_at', NOW()::text,
        'snapshot_created_by', l.created_by,
        'snapshot_status', 'approved'
    ),
    'approved',
    l.created_by,
    l.created_by,
    COALESCE(l.approved_at, l.created_at),
    true
FROM listings l
LEFT JOIN listing_versions lv ON l.id = lv.listing_id
WHERE lv.id IS NULL
AND l.status = 'approved';

-- Update listings to reference their versions
UPDATE listings l
SET 
    live_version_id = v.id,
    current_version_id = v.id
FROM listing_versions v
WHERE l.id = v.listing_id
AND v.is_live = true
AND l.live_version_id IS NULL;

-- Verify the migration
DO $$
DECLARE
    incomplete_versions INTEGER;
    complete_versions INTEGER;
BEGIN
    SELECT COUNT(*) INTO incomplete_versions
    FROM listing_versions
    WHERE content IS NOT NULL
    AND NOT (content ? 'contacts');
    
    SELECT COUNT(*) INTO complete_versions
    FROM listing_versions
    WHERE content IS NOT NULL
    AND content ? 'contacts';
    
    RAISE NOTICE 'Version check - Complete: %, Incomplete: %', complete_versions, incomplete_versions;
    
    IF incomplete_versions > 0 THEN
        RAISE WARNING 'There are still % versions with incomplete data!', incomplete_versions;
    END IF;
END $$;

COMMIT;