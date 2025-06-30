# Source Tree Structure

## Repository Layout

```
commercial_directory/
├── apps/
│   └── web/                    # Next.js frontend application
│       ├── src/
│       │   ├── app/           # Next.js App Router pages
│       │   ├── components/    # React components
│       │   ├── lib/          # Utility functions
│       │   └── types/        # TypeScript type definitions
│       ├── public/           # Static assets
│       ├── package.json
│       └── next.config.js
├── packages/
│   └── db/                    # Database package
│       ├── prisma/
│       │   ├── schema.prisma # Database schema
│       │   └── migrations/   # Database migrations
│       ├── src/
│       │   ├── client.ts     # Prisma client
│       │   └── types.ts      # Database types
│       └── package.json
├── supabase/
│   ├── config.toml           # Supabase configuration
│   ├── functions/            # Edge Functions
│   │   ├── search-listings/
│   │   ├── admin-moderation/
│   │   └── lead-capture/
│   └── migrations/           # Database migrations
├── docs/                     # Documentation
│   ├── prd/                 # Sharded PRD sections
│   ├── architecture/        # Sharded architecture sections
│   └── stories/             # Development stories
├── .bmad-core/              # BMAD framework files
├── package.json             # Root package.json (Turborepo)
├── turbo.json              # Turborepo configuration
└── README.md
```

## Key Directories

### `/apps/web` - Frontend Application
- **Next.js 14** with App Router
- **shadcn/ui** components in `/src/components/ui/`
- **Page components** in `/src/app/`
- **API routes** in `/src/app/api/`

### `/packages/db` - Database Layer
- **Prisma schema** defining all models
- **Type generation** for TypeScript
- **Migration files** for schema changes

### `/supabase` - Backend Services
- **Edge Functions** for serverless compute
- **Database migrations** 
- **RLS policies** for security
- **Storage buckets** configuration

### `/docs` - Project Documentation
- **Sharded PRD** in `/docs/prd/`
- **Sharded Architecture** in `/docs/architecture/`
- **Development Stories** in `/docs/stories/`

## File Naming Conventions

### Components
- **PascalCase** for React components: `ListingCard.tsx`
- **kebab-case** for component files: `listing-card.tsx`
- **Index files** for barrel exports: `index.ts`

### Pages (App Router)
- **lowercase** for route segments: `listings/`
- **parentheses** for route groups: `(dashboard)/`
- **brackets** for dynamic routes: `[id]/`

### Database
- **snake_case** for table names: `listing_locations`
- **camelCase** for Prisma model names: `ListingLocation`
- **UPPERCASE** for constants: `USER_ROLES`

### Utilities
- **camelCase** for function names: `formatCurrency`
- **kebab-case** for utility files: `date-utils.ts`
- **PascalCase** for classes: `ApiClient`

## Import Structure

### Absolute Imports
```typescript
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import type { Listing } from '@/types/database'
```

### Relative Imports
- Use for closely related files
- Avoid deep nesting: `../../../` 
- Prefer absolute imports for clarity

## Build System

### Turborepo Configuration
- **Parallel builds** for packages
- **Incremental builds** with caching
- **Dependency management** between packages
- **Shared scripts** via root package.json