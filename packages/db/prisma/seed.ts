import { PrismaClient, UserRole, BusinessStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sitematch.com' },
    update: {},
    create: {
      email: 'admin@sitematch.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
    },
  })

  // Create business owner
  const businessOwner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      name: 'Business Owner',
      role: UserRole.BUSINESS_OWNER,
    },
  })

  // Create sample business listings
  await prisma.businessListing.createMany({
    data: [
      {
        name: 'Downtown Coffee Shop',
        description: 'Cozy coffee shop in the heart of downtown',
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94102',
        phone: '(555) 123-4567',
        email: 'info@downtowncoffee.com',
        website: 'https://downtowncoffee.com',
        category: 'Restaurant',
        status: BusinessStatus.ACTIVE,
        ownerId: businessOwner.id,
      },
      {
        name: 'Tech Startup Office',
        description: 'Modern office space for tech startups',
        address: '456 Innovation Dr',
        city: 'Palo Alto',
        state: 'CA',
        zipCode: '94301',
        phone: '(555) 987-6543',
        email: 'info@techstartup.com',
        website: 'https://techstartup.com',
        category: 'Technology',
        status: BusinessStatus.ACTIVE,
        ownerId: businessOwner.id,
      },
      {
        name: 'Local Bookstore',
        description: 'Independent bookstore with rare finds',
        address: '789 Reading Ave',
        city: 'Berkeley',
        state: 'CA',
        zipCode: '94704',
        phone: '(555) 456-7890',
        email: 'info@localbookstore.com',
        category: 'Retail',
        status: BusinessStatus.PENDING,
        ownerId: businessOwner.id,
      },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Database seeded successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e)
    await prisma.$disconnect()
    process.exit(1)
  })