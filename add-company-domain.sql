-- Add company_domain column to listings table
ALTER TABLE listings ADD COLUMN IF NOT EXISTS company_domain TEXT;

-- Update existing records with test domains
UPDATE listings SET company_domain = 'tesco.com' WHERE company_name = 'Tesco';
UPDATE listings SET company_domain = 'waitrose.com' WHERE company_name = 'Waitrose';
UPDATE listings SET company_domain = 'lidl.co.uk' WHERE company_name = 'Lidl';