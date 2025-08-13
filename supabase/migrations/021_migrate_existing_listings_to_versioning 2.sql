-- Migration: Create initial versions for existing listings
-- This ensures existing listings work with the new versioning system

BEGIN;

-- Create a function to generate version content for existing listings
CREATE OR REPLACE FUNCTION create_initial_version_for_listing(listing_id_param UUID)
RETURNS UUID AS $$
DECLARE
    version_record RECORD;
    content_json JSONB;
    new_version_id UUID;
    listing_record RECORD;
    contacts_data JSONB;
    locations_data JSONB;
    faqs_data JSONB;
    sectors_data JSONB;
    use_classes_data JSONB;
    files_data JSONB;
BEGIN
    -- Get the listing data
    SELECT * INTO listing_record FROM listings WHERE id = listing_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Listing not found: %', listing_id_param;
    END IF;
    
    -- Gather related data
    SELECT COALESCE(json_agg(lc.*), '[]'::json)::jsonb 
    INTO contacts_data
    FROM listing_contacts lc 
    WHERE lc.listing_id = listing_id_param;
    
    SELECT COALESCE(json_agg(ll.*), '[]'::json)::jsonb 
    INTO locations_data
    FROM listing_locations ll 
    WHERE ll.listing_id = listing_id_param;
    
    SELECT COALESCE(json_agg(f.* ORDER BY f.display_order), '[]'::json)::jsonb 
    INTO faqs_data
    FROM faqs f 
    WHERE f.listing_id = listing_id_param;
    
    SELECT COALESCE(json_agg(jsonb_build_object(
        'sector_id', ls.sector_id,
        'sector', jsonb_build_object('id', s.id, 'name', s.name)
    )), '[]'::json)::jsonb 
    INTO sectors_data
    FROM listing_sectors ls 
    JOIN sectors s ON ls.sector_id = s.id 
    WHERE ls.listing_id = listing_id_param;
    
    SELECT COALESCE(json_agg(jsonb_build_object(
        'use_class_id', luc.use_class_id,
        'use_class', jsonb_build_object('id', uc.id, 'name', uc.name, 'code', uc.code)
    )), '[]'::json)::jsonb 
    INTO use_classes_data
    FROM listing_use_classes luc 
    JOIN use_classes uc ON luc.use_class_id = uc.id 
    WHERE luc.listing_id = listing_id_param;
    
    SELECT COALESCE(json_agg(fu.* ORDER BY fu.display_order), '[]'::json)::jsonb 
    INTO files_data
    FROM file_uploads fu 
    WHERE fu.listing_id = listing_id_param;
    
    -- Build comprehensive content JSON
    content_json := jsonb_build_object(
        'listing', to_jsonb(listing_record),
        'contacts', contacts_data,
        'locations', locations_data,
        'faqs', faqs_data,
        'sectors', sectors_data,
        'use_classes', use_classes_data,
        'files', files_data,
        'snapshot_created_at', NOW()::text,
        'snapshot_created_by', listing_record.created_by,
        'snapshot_status', 'approved'
    );
    
    -- Create the version record
    INSERT INTO listing_versions (
        listing_id,
        version_number,
        content,
        status,
        created_by,
        reviewed_by,
        reviewed_at,
        is_live
    ) VALUES (
        listing_id_param,
        1, -- First version
        content_json,
        'approved', -- Existing listings are considered approved
        listing_record.created_by,
        listing_record.created_by, -- Self-approved for migration
        listing_record.created_at,
        true -- This becomes the live version
    ) RETURNING id INTO new_version_id;
    
    RETURN new_version_id;
END;
$$ LANGUAGE plpgsql;

-- Create initial versions for all existing listings that don't have any versions
DO $$
DECLARE
    listing_rec RECORD;
    new_version_id UUID;
    updated_count INTEGER := 0;
BEGIN
    FOR listing_rec IN 
        SELECT l.id, l.created_by 
        FROM listings l 
        LEFT JOIN listing_versions lv ON l.id = lv.listing_id 
        WHERE lv.id IS NULL -- Only listings without any versions
    LOOP
        -- Create initial version
        SELECT create_initial_version_for_listing(listing_rec.id) INTO new_version_id;
        
        -- Update the listing to reference this version
        UPDATE listings 
        SET 
            live_version_id = new_version_id,
            current_version_id = new_version_id,
            last_edited_at = NOW()
        WHERE id = listing_rec.id;
        
        updated_count := updated_count + 1;
        
        -- Log progress every 10 listings
        IF updated_count % 10 = 0 THEN
            RAISE NOTICE 'Migrated % listings to versioning system', updated_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration complete: % listings migrated to versioning system', updated_count;
END $$;

-- Clean up the helper function
DROP FUNCTION create_initial_version_for_listing(UUID);

-- Verify the migration worked
DO $$
DECLARE
    total_listings INTEGER;
    versioned_listings INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_listings FROM listings;
    SELECT COUNT(DISTINCT listing_id) INTO versioned_listings FROM listing_versions;
    
    RAISE NOTICE 'Total listings: %, Versioned listings: %', total_listings, versioned_listings;
    
    IF total_listings != versioned_listings THEN
        RAISE WARNING 'Migration incomplete: % listings still need versioning', (total_listings - versioned_listings);
    ELSE
        RAISE NOTICE 'Migration successful: All listings now have version records';
    END IF;
END $$;

COMMIT;