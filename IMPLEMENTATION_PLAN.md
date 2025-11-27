# Login + JWT + Role-Based Access Control Implementation Plan

## Current State
- Nuxt 4 fullstack app (single project)
- MinIO file storage
- Frontend pages and server API in same project

## Architecture: Frontend + API + Backend (Separated concerns)

### 1. Authentication Flow
```
Browser → Login Form (Frontend) → POST /api/auth/login → Backend (JWT generation)
                                  ← JWT Token + Refresh Token
                                  
Auth: Bearer {JWT} → API Requests → Backend (verify JWT, check role)
                                   ← Protected Data
```

---

## Files to Create

### Backend Authentication Module
- **`server/utils/auth.ts`** — JWT generation, verification, role checking
- **`server/db/users.ts`** — Mock/in-memory user store (or future DB integration)
- **`server/middleware/auth.ts`** — Middleware to verify JWT on protected routes

### API Endpoints (Auth)
- **`server/api/auth/login.post.ts`** — POST login, return JWT + refresh token
- **`server/api/auth/refresh.post.ts`** — POST refresh token, return new JWT
- **`server/api/auth/logout.post.ts`** — POST logout (optional, frontend clears token)
- **`server/api/auth/me.get.ts`** — GET current user info (protected)

### API Endpoints (Protected Bucket Operations)
- Update existing `server/api/bucket/` endpoints to check auth + roles
  - `files.get.ts`, `files.post.ts`, `index.get.ts`, etc.

### Frontend Composables
- **`composables/useAuth.ts`** — Composable to manage auth state (token, user, login/logout)
- **`composables/useApi.ts`** — Composable to auto-attach JWT to API requests

### Frontend Pages & Components
- **`pages/login.vue`** — Login form (username/password)
- **`pages/dashboard.vue`** or update `pages/index.vue` — Protected dashboard
- **`middleware/auth.ts`** — Nuxt middleware to protect routes (redirect to login if not authenticated)
- **`components/AuthGuard.vue`** — Component to check user role before rendering content

### Frontend Stores (Optional, if using Pinia)
- **`stores/auth.ts`** — Pinia store for auth state (token, user, roles)

### Utilities
- **`utils/jwt.ts`** (client-side) — decode JWT (no verification needed on client)
- **`server/utils/jwt.ts`** (server-side) — sign/verify JWT using `jsonwebtoken` lib

---

## Files to Modify

### Dependencies (package.json)
Add:
- `jsonwebtoken` — JWT generation/verification (server)
- `@nuxtjs/pinia` (optional) — state management (client)

### Nuxt Config (nuxt.config.ts)
```typescript
export default defineNuxtConfig({
  // ... existing
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
    jwtExpiry: process.env.JWT_EXPIRY || '1h',
  },
  modules: [
    '@nuxtjs/pinia' // optional
  ]
})
```

### Environment Variables (.env)
Add:
```
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
```

### Protected API Routes
- Add `auth` middleware check to bucket operations
- Example: `server/api/bucket/index.get.ts` — list buckets (require `admin` role)

### App Layout (app.vue)
- Add route guard / redirect logic for unauthenticated users
- Show login page if no token

---

## User Model & Roles

### User Structure
```typescript
interface User {
  id: string
  username: string
  password: string (hashed) // use bcryptjs
  email: string
  role: 'admin' | 'user'
  createdAt: Date
}

interface TokenPayload {
  sub: string  // user ID
  username: string
  role: 'admin' | 'user'
  iat: number
  exp: number
}
```

### Roles & Permissions
```
Admin:
  - List all buckets ✓
  - Create/delete buckets ✓
  - Upload/delete files anywhere ✓
  - View all users (future)

User:
  - List assigned buckets only ✓
  - Upload/delete own files ✓
  - Cannot delete buckets ✓
```

---

## Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `jsonwebtoken`, `bcryptjs` |
| `nuxt.config.ts` | Modify | Add `runtimeConfig`, modules |
| `.env` | Modify | Add `JWT_SECRET`, `JWT_EXPIRY` |
| `server/utils/auth.ts` | Create | JWT sign/verify, role check |
| `server/db/users.ts` | Create | User data store (mock or DB) |
| `server/middleware/auth.ts` | Create | Verify JWT on protected routes |
| `server/api/auth/login.post.ts` | Create | Login endpoint |
| `server/api/auth/refresh.post.ts` | Create | Refresh token endpoint |
| `server/api/auth/me.get.ts` | Create | Get current user (protected) |
| `server/api/bucket/index.get.ts` | Modify | Add auth check + role-based filtering |
| `pages/login.vue` | Create | Login form UI |
| `pages/dashboard.vue` | Create | Protected dashboard (or update index.vue) |
| `middleware/auth.ts` | Create | Route protection (client-side) |
| `composables/useAuth.ts` | Create | Auth composable |
| `composables/useApi.ts` | Create | Auto-attach JWT to requests |
| `utils/jwt.ts` | Create | Decode JWT (client-side helper) |

---

## Implementation Order

1. ✅ Install dependencies (`jsonwebtoken`, `bcryptjs`)
2. ✅ Create backend auth utils + DB
3. ✅ Create login/refresh/me endpoints
4. ✅ Add auth middleware to Nuxt config
5. ✅ Protect existing bucket endpoints
6. ✅ Create login page + forms
7. ✅ Create composables (useAuth, useApi)
8. ✅ Add route middleware for protection
9. ✅ Update app.vue to check auth
10. ✅ Test login flow end-to-end

---

## Want me to implement?

Pick your preference:
- **Option A:** Full implementation (all files at once)
- **Option B:** Step-by-step (build piece by piece, test each)
- **Option C:** Minimal MVP (just login + JWT, no DB, simple in-memory users)

**Recommendation:** Option C first (fast MVP), then extend with DB layer later.

