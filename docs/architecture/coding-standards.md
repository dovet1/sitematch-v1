# Coding Standards

## General Guidelines

### Repository Structure
- **Monorepo**: Turborepo with `/apps/web` (Next.js) + `/packages/db` (Prisma schema) + `/supabase` (migrations & edge functions)
- **Single repo approach** for speed to market ≤ 3 weeks

### Technology Standards

#### Frontend (Next.js)
- **Next.js 14** with App Router
- **React 18** functional components with hooks
- **TypeScript** for all code
- **shadcn/ui** component library
- **TailwindCSS** for styling
- **Framer Motion** for animations

#### Backend/Database
- **Supabase** for backend services
- **Postgres 16** with RLS (Row Level Security)
- **Prisma** as ORM
- **Edge Functions** for serverless compute

#### Code Quality
- **TypeScript strict mode** enabled
- **ESLint** + **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **Jest** for unit testing
- **Playwright** for E2E testing

## Security Standards

### Authentication & Authorization
- **Supabase Auth** with magic links + OAuth
- **JWT role claims** for admin actions
- **Row-level security** for all database operations
- **Multi-tenant isolation** at database level

### Data Protection
- All user data protected by RLS policies
- Public search limited to approved listings only
- Service role access minimal and audited

## Development Workflow

### Branch Strategy
- `main` branch protected
- Feature branches: `feature/description`
- Hotfix branches: `hotfix/description`

### Code Review
- All changes require PR review
- Automated testing must pass
- Security review for auth/RLS changes

### Deployment
- **Vercel** for frontend hosting
- **Supabase** for backend services
- Automated CI/CD pipeline
- Preview deployments for all PRs