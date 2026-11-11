# Commerce Storefront + Admin Portal

## Local setup

Requirements: Node.js 24.x and npm.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the Supabase project publishable key:

   ```env
   VITE_SUPABASE_URL=https://jhjebhpzzjbtsmflwnzf.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_project_publishable_key
   ```

   Only the Supabase publishable key belongs in browser environment variables. Never put a service-role or secret key in `VITE_*` variables.

3. Start the local development server:

   ```bash
   npm run dev
   ```

   - Customer storefront: `http://localhost:5173/`
   - Separate Admin entry: `http://localhost:5173/admin.html`

4. Create the first customer account from the storefront and confirm the email.

## One-time Owner bootstrap

The Supabase database is prepared, but no Auth user or Owner principal exists yet.

After the intended Owner has registered and confirmed their email, run this **once** in the Supabase SQL Editor, replacing the example address:

```sql
select app_private.bootstrap_first_owner('owner@example.com');
```

This one-time function creates the Owner principal, activates the Admin account, assigns the protected Owner role and seeds its permissions. It cannot be run again after an Owner exists. Do not give the Owner role to another account.

Then sign in at `/admin.html`. On the Admin Overview, set a separate Owner Recovery Secret of at least 16 characters. The database stores only a salted password hash.

**Important:** the Owner recovery Edge Function source is present under `supabase/functions/owner-recovery/`, but deployment has not completed. Setting the recovery secret does not yet activate password recovery.

## Current implementation notes

- Storefront and Admin use separate HTML entry points and separate sign-in/access checks, sharing the same Supabase project.
- Customer checkout requires authentication, a selected cart, a valid shipping quote and a payment-proof upload.
- Orders, payments, inventory, cancellation, shipping and completion use protected database functions; cancellation and stock release are never automatic.
- Vercel deployment has not been performed.
- A successful CI build is not a substitute for end-to-end tests with real customer and Admin accounts. Complete those tests before production use.
