

## Media Sync — Phase 1: Foundation + Landing

### 1. Design System Setup
- Update Tailwind config and CSS variables with Media Sync's dark theme colors (indigo primary, cyan accent, dark backgrounds)
- Add Outfit font from Google Fonts
- Configure custom border radius, glow effects, and gradient utilities

### 2. Landing Page
- **Navigation bar** with Media Sync logo, nav links, Login/Get Started buttons
- **Hero section** with gradient text, tagline "Your AI finds clients. You close deals.", two CTAs (Start Free Trial, Watch Demo), and animated glow orbs
- **How It Works** — 3-step cards (Tell AI → Hunt Leads → Autopilot Outreach)
- **Pricing section** — Starter (€750/mo), Growth (€1,250/mo), Enterprise (Custom) with feature lists and "Most Popular" badge on Growth
- **Footer** with links

### 3. Pricing Page
- Dedicated `/pricing` route with expanded pricing details matching the spec

### 4. Supabase Cloud Setup
- Enable Lovable Cloud for database, auth, and edge functions
- Create initial database tables: `profiles`, `companies`, `user_roles` (for admin/client roles)
- Set up Row-Level Security policies for data isolation
- Create trigger to auto-create profile on signup

### 5. Authentication
- `/login` page — email + password sign in with dark theme styling
- `/signup` page — registration flow
- Password reset flow with `/reset-password` page
- Auth state management and protected route wrapper
- Redirect unauthenticated users; redirect to `/onboarding` if `onboarding_completed` is false

### 6. App Shell & Routing
- Set up all routes (public: `/`, `/pricing`, `/login`, `/signup`; protected: `/onboarding`, `/dashboard`)
- Authenticated layout with sidebar navigation (Dashboard, Campaigns, Leads, Inbox, Calls, Settings)
- Placeholder pages for Phase 2+ screens
- Basic onboarding and dashboard placeholder pages

