const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://nunvbolbcekvtlwuacul.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bnZib2xiY2VrdnRsd3VhY3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTI5MTU2NCwiZXhwIjoyMDY2ODY3NTY0fQ.70iWlz51R6-OHAcNwMVqGapMG8Z7Tq2CIRJ9q1e21lY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addCompanyDomainColumn() {
  try {
    // Add column using SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS company_domain TEXT;
        
        UPDATE listings SET company_domain = 'tesco.com' WHERE company_name = 'Tesco';
        UPDATE listings SET company_domain = 'waitrose.com' WHERE company_name = 'Waitrose';
        UPDATE listings SET company_domain = 'lidl.co.uk' WHERE company_name = 'Lidl';
      `
    });

    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Successfully added company_domain column and updated existing records');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

addCompanyDomainColumn();