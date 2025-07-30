const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.nunvbolbcekvtlwuacul:mysupabasepassword@aws-0-eu-west-2.pooler.supabase.com:6543/postgres'
});

async function addColumn() {
  try {
    await client.connect();
    
    // Add the column
    await client.query('ALTER TABLE listings ADD COLUMN IF NOT EXISTS company_domain TEXT;');
    console.log('Column added successfully');
    
    // Update existing records
    await client.query("UPDATE listings SET company_domain = 'tesco.com' WHERE company_name = 'Tesco';");
    await client.query("UPDATE listings SET company_domain = 'waitrose.com' WHERE company_name = 'Waitrose';");
    await client.query("UPDATE listings SET company_domain = 'lidl.co.uk' WHERE company_name = 'Lidl';");
    console.log('Updated existing records');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

addColumn();