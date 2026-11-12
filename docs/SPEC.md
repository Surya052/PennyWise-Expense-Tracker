# PennyWise specification

Source of truth for the unfinished app. Stack and name below replace the original Laravel / SpendWise brief. Features are unchanged.

## Product

- Name: PennyWise
- Tagline: Track every rupee: expenses, income and investments in one calm place.
- Type: multi-user SaaS, mobile-first, installable PWA
- Default currency: INR
- Formatting: Indian digit grouping, for example ₹1,25,000.50
- Money storage: integer paise as BigInt (or DECIMAL(14,2) on MySQL). Never floating point.

## Stack

- Backend: NestJS (current stable), TypeScript, Node 20+
- Database: Prisma. Local provider SQLite because MySQL and Docker are not installed here. Production note in the README may add MySQL 8 by changing the Prisma provider and migrations only.
- Frontend: React + Vite + TypeScript, Tailwind CSS, Chart.js
- PWA: web app manifest + service worker. Cache the app shell only. Do not cache API responses (financial data).
- Auth: server session in an httpOnly, SameSite cookie. Role checks on admin routes. Logout and password change revoke sessions.
- Validation on every write. Authorization so one user cannot read or change another user's financial rows. Every financial query filters by the signed-in user id.
- Scheduled job for recurring transactions, plus a secret-protected HTTP trigger so a single VPS cron can call it. Claim each due row with a conditional update so two runners cannot double-post.

## Roles and access

Roles: `admin`, `user`.

There is no public registration page. Only an admin can create accounts.

Admin is created by a seeder from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`. Never hardcode or commit them. Store the password hashed (bcrypt). Reject a weak admin password instead of seeding it.

Admin can create, edit, deactivate, reactivate, and delete users, and reset a user's password.

New users get a temporary password chosen by the admin and must change it on first login.

Admin can see the user list, status, created date, last login, and basic usage counts only.

Admin cannot view a user's transactions, balances, or investments. Financial data is private to each user. There is no admin API that accepts another user's id for financial records. Loading a financial row always includes `userId` of the session user and returns not found otherwise.

Do not delete the last active admin. Deleting a user removes their financial data. Audit rows keep a copy of the email in metadata so the log still reads after a delete.

## Modules

### Authentication

- Login with email and password, remember me, logout
- Forgot and reset password. Same response whether the email exists. In development, log the reset link on the server. In tests only, the raw token may be returned. In production, never return it.
- Force password change on first login. All other API routes stay blocked until it is done. Logout and change-password stay available.
- Rate limit login and password reset. Lock out after repeated failures for a single email.
- Deactivated users cannot log in.
- Password rules: at least 8 characters, at most 72, with a lowercase letter, an uppercase letter, and a digit.

### Accounts

- Multiple accounts per user: cash, bank, credit card, UPI wallet, demat
- Fields: name, type, opening balance, colour, icon, archived flag
- Current balance is computed, not stored: opening balance plus income, minus expenses, minus investment buys, plus sells, dividends, and interest, minus transfers out, plus transfers in. Soft-deleted rows are ignored.
- Credit card debt is a negative balance and reduces net worth.
- Transfers between the user's own accounts are not income or expense.

### Transactions

Types: expense, income, investment, transfer.

Fields: date, amount, type, account, optional transfer account, optional category, optional holding, optional investment action (`buy`, `sell`, `dividend`, `interest`), optional units, payee or note, tags, payment method, optional receipt image.

Behaviour:

- Add, edit, delete, duplicate
- Fast add: floating action button opens a bottom sheet with a large amount keypad, type toggle, category chips, and date shortcuts (today, yesterday, pick)
- Search, filter by date range, type, category, account, tag, and amount range
- Pagination, grouped by day in the UI
- Swipe actions on mobile for edit and delete, with undo
- Soft delete, and restore for undo
- Receipt upload: jpeg, png, or webp, max 2 MB, check magic bytes, store outside the public web root, serve only through an authenticated route for that owner

Use a database transaction for transfers and for any write that also updates a holding.

Holdings are recomputed from non-deleted investment rows (units and invested amount). A manual current value is kept once the user has set one.

### Categories

Seed these for every new user, including the admin's own books:

Expense: Food, Rent, Transport, Bills, Shopping, Health, Education, Entertainment, Other.

Income: Salary, Freelance, Interest, Gifts, Other.

Users can add, rename, recolour, reorder, and archive categories and one level of subcategories. Reorder with up and down controls so it stays keyboard accessible.

### Investments

Asset types: stocks, mutual funds, SIP, fixed deposit, recurring deposit, PPF/EPF, gold, crypto, real estate, other.

Record buy, sell, dividend, and interest per holding. Those rows also appear in the main transaction list with type investment.

Holdings page: invested amount, current value (manual update), absolute gain or loss, percentage gain or loss, XIRR or CAGR when dates exist.

Allocation donut by asset type.

Net worth = account balances + investment current value.

XIRR may use floating point only inside the rate solver. Stored money stays integer paise. Units stay exact (scaled integers or decimal strings), not binary floats.

### Budgets and goals

- Monthly budget per category. Progress bar. Soft warning at 80 percent and at 100 percent.
- Savings goals with target amount, amount saved, target date, and progress.

Month boundaries respect the user's "first day of month" setting (1–28).

### Recurring

- Daily, weekly, monthly, yearly templates (rent, salary, SIP, and similar)
- Hourly job creates due entries, including a short backfill if the server was off (cap the catch-up)
- User can pause or edit. Edits affect future runs only.
- Monthly dates that do not exist (31 January to February) clamp to the last day of the month.

"Today" for the scheduler is Asia/Kolkata.

### Dashboard

- Greeting and month selector
- Cards: total income, total expense, total invested, net savings, net worth
- Net savings = income − expense − amount invested (buys) for that month
- Charts: expense by category (donut), income vs expense (bar, last 6 to 12 months), cash-flow trend (line)
- Recent transactions and budget progress
- Skeleton loaders and subtle transitions
- Cache dashboard aggregates per user and month, and drop that cache on any write for that user

### Reports

- Monthly, yearly, and custom range
- Category breakdown, top expenses, savings rate
- Export CSV and PDF
- CSV import with column mapping
- PDF uses "Rs." rather than the rupee glyph so the built-in font still renders

### Settings

- Profile, change password, currency, date format, first day of month
- Currencies with 2 decimal minor units: INR, USD, EUR, GBP, AED. INR uses Indian grouping.
- Light, dark, and system theme
- Export all of my data as JSON (no password hash, no server file paths)
- Delete my account after the current password and the email are confirmed

### Admin panel

- Counts: total users, active users, new users this month
- User table with search, create, edit, activate or deactivate, reset password, delete
- Audit log of admin actions: who, what, when, target, IP. Metadata must not contain passwords.

## Interface

Calm, generous whitespace, cards with a 16–20px radius, soft shadows. Design at 360px first, then 390, 768, and 1280. It should feel like a native app: bottom navigation on mobile, sidebar on desktop. One primary action per screen. Touch targets at least 44×44. Respect safe-area insets.

Bottom navigation: Home, Transactions, Add (centre floating button), Investments, More.

Also: bottom sheets, pill filters, category chips, empty states, toasts with undo, inline validation, pull-to-refresh, skeleton loading.

Semantic HTML, a label on every input, keyboard use on desktop, visible focus, and `prefers-reduced-motion`.

Do not rely on colour alone. Pair amounts with a plus, a minus, or an icon. Amount text uses the primary text colour and tabular numerals. Coloured text on these pastels often fails contrast.

### Colour

Define CSS variables. Theme toggle plus `prefers-color-scheme`. No pure white or pure black page backgrounds. No neon.

Light:

- background `#F5F3EE`
- surface `#FBFAF7`
- text `#2B2F36`
- secondary text: use `#5E6670` instead of `#6B7280`, because `#6B7280` on `#F5F3EE` is about 4.36:1 and misses WCAG AA
- primary `#5B8DB8` for accents and charts
- filled buttons need a darker blue, `#3E6F96`, with `#FBFAF7` text. `#5B8DB8` does not pass AA with either black or white label text
- income `#6BA58A`
- expense `#D4846F`
- investment `#8F7CC0`
- border `#E6E2D9`

Dark:

- background `#16191F`
- surface `#1E222A`
- text `#E3E6EB`
- secondary `#9AA3AF` (passes on both dark surfaces)
- primary `#7FA6CC`
- button fill `#7FA6CC` with text `#1E222A` (about 6.25:1)
- income `#7FB99C`
- expense `#E09A86`
- investment `#A596D1`
- border `#2B303A`

Font: Inter bundled with the app (so the PWA works offline), system fonts as fallback. Body text at least 16px.

## Data model

Tables:

- users: id, name, email unique, password, role, isActive, mustChangePassword, lastLoginAt, createdBy, currency, dateFormat, monthStartDay, theme, timestamps
- sessions: hashed id, userId, expiresAt
- accounts: userId, name, type, openingBalance, color, icon, isArchived, timestamps
- categories: userId, parentId nullable, name, type, color, icon, sortOrder, isArchived, timestamps
- transactions: userId, accountId, toAccountId nullable, categoryId nullable, holdingId nullable, recurringId nullable, type, action nullable, units nullable, amount, date, note, paymentMethod, attachmentPath, soft delete, timestamps
- tags and transaction_tag
- holdings: userId, assetType, name, symbol nullable, units, avgCost, investedAmount, currentValue, lastValuedAt, timestamps
- budgets: userId, categoryId, month, amount
- goals: userId, name, targetAmount, savedAmount, targetDate
- recurring_transactions: userId, template fields, frequency, nextRunDate, isActive
- admin_audit_logs: adminId, action, targetUserId, meta json, ip, timestamps
- password_reset_tokens: email, token hash, expiresAt

Foreign keys and indexes on userId, date, type, and categoryId.

Seed admin and default categories. Provide a demo seed that reads `DEMO_EMAIL` and `DEMO_PASSWORD` from the environment and does nothing if they are missing. No hardcoded demo password.

## Security

- bcrypt passwords, strength rules above
- CSRF resistance via SameSite cookies and same-origin `/api` (Vite proxy in dev, Nest static hosting in production)
- XSS-safe rendering, parameterized queries only
- Rate limits on login and reset
- httpOnly session cookie. `Secure` in production. Redirect HTTP to HTTPS in production when `x-forwarded-proto` is http and the host is not localhost.
- Validate uploads. Store them outside the web root.
- Secrets only in `.env`
- Do not log passwords, reset tokens, or session ids
- Helmet, no `x-powered-by`

`.env.example` must list `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, `JWT` is not used; use `SESSION` cookie only, plus `CRON_SECRET`, `APP_URL`, `WEB_ORIGIN`, `TRUST_PROXY`.

## Quality

- Eager-load transaction lists (account, category, tags, holding)
- Paginate large lists
- Feature tests: auth, role access, deactivated login, forced password change, data isolation between two users, transaction create, balance maths for income, expense, and transfer
- Unit tests for paise formatting and XIRR (a −10000 to +11000 cash flow one year later is about 10 percent)
- Services hold business logic. React components stay reusable.
- Check the UI at 360, 390, 768, and 1280 once it runs

## Environment sketch

```
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:5173"
WEB_ORIGIN="http://localhost:5173"
CRON_SECRET=
TRUST_PROXY=false
```

## Out of scope unless asked

Public signup, viewing another user's finances, Laravel, and storing money in floating point.
