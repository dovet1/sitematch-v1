// Script to create test listings for moderation queue
// Run with: node create-test-listing.js

const testListings = [
  {
    title: "Flagship Retail Store - High Street Location",
    company_name: "Premium Fashion Co",
    description: "Seeking high-visibility retail space for flagship fashion store. Requires premium fit-out with large windows and street frontage.",
    contact_name: "Sarah Johnson",
    contact_title: "Property Director", 
    contact_email: "sarah.johnson@premiumfashion.co.uk",
    contact_phone: "+44 20 7123 4567",
    site_size_min: 2000,
    site_size_max: 5000,
    sector_id: "retail",
    use_class_id: "e_a_retail"
  },
  {
    title: "Restaurant Chain Expansion",
    company_name: "Gourmet Burger Ltd",
    description: "Expanding successful burger chain. Need ground floor location with kitchen facilities and outdoor seating potential.",
    contact_name: "Marcus Chen",
    contact_title: "Development Manager",
    contact_email: "marcus.chen@gourmetburger.co.uk", 
    contact_phone: "+44 161 555 9876",
    site_size_min: 1500,
    site_size_max: 3000,
    sector_id: "food_beverage",
    use_class_id: "e_b_cafe_restaurant"
  },
  {
    title: "Tech Startup Office Space",
    company_name: "InnovateTech Solutions",
    description: "Fast-growing fintech startup requires modern office space with high-speed connectivity and flexible layout options.",
    contact_name: "Alex Thompson",
    contact_title: "COO",
    contact_email: "alex.thompson@innovatetech.io",
    contact_phone: "+44 117 234 5678",
    site_size_min: 3000,
    site_size_max: 8000, 
    sector_id: "technology",
    use_class_id: "b1_office"
  }
];

console.log('Test listings data prepared:');
console.log(JSON.stringify(testListings, null, 2));
console.log('\nTo create these listings, you can:');
console.log('1. Use the /occupier/create-listing wizard in the browser');
console.log('2. Post directly to /api/listings endpoint');
console.log('3. Use SQL INSERT statements');