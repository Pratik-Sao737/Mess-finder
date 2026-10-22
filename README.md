# Mess Finder (MessMate) — Full-Stack Application

A modern, full-stack community food-tech discovery and meal subscription ecosystem designed for students and mess owners. Built on the **Google Stitch** "Fresh Table" design language, it helps university and hostel students discover nearby messes, compare meal plans, and purchase monthly subscriptions, while empowering mess owners to manage their business profiles, daily menus, and membership orders.

---

## 1. Project Overview & Architecture

- **UI & Design System**: Preserves the exact Google Stitch "Fresh Table" design specification:
  - **Color Palette**: Forest Green (`#1A5740` / `#003F2B`), Fresh Lime (`#D4E8A7`), Canvas Cream (`#F1FCF4`), Pure White (`#FFFFFF`), and Persimmon Accent (`#E86B33`).
  - **Typography**: Plus Jakarta Sans (headings, display, body) and Inter (badges, metrics, labels).
  - **Icons**: Google Material Symbols Outlined.
  - **Responsive Layout**: Mobile-first fluid viewport with desktop grid support.
- **Backend**: Node.js HTTP REST API server with zero external runtime dependencies.
- **Database**: Native SQLite engine (`node:sqlite`) with ACID transactions, foreign keys, prepared statements, and WAL journaling.
- **Security**: Cryptographic PBKDF2/scrypt password hashing with unique salt, HMAC-SHA256 bearer tokens, and server-side role and ownership enforcement.

---

## 2. User Roles & Capabilities

### A. Student
- **Authentication**: Register with name, email, password, and hostel/college details; log in and manage session.
- **Campus Discovery**: Discover messes near North Campus, South Campus, Kamla Nagar, Hudson Lane, etc.
- **Search & Filters**: Real-time search across mess names, localities, and cuisines with combined multi-filters:
  - Pure Veg, Veg & Egg, Non-Veg, Jain Food, Vegan.
  - Budget ranges (< ₹1,000, ₹1,000–₹1,500, ₹1,500–₹2,000, custom).
  - High-protein options (sprouts, paneer, boiled eggs).
  - Distance & walking time (< 1 km).
  - Minimum rating (4.0+, 4.5+).
  - Meal timings & amenities (RO water, AC, Wi-Fi, unlimited rotis).
- **Mess Details**: Dynamic view of photos, contacts (Call, WhatsApp, Directions), live meal status, 7-day weekly menu schedule (Mon–Sun), facilities bento, and reviews.
- **Comparison Engine**: Side-by-side comparative matrix of 2 or 3 messes (pricing, distance, food type, ratings, amenities).
- **Membership Ordering**: Select a plan (Weekly Trial, Monthly Standard, Full Semester), confirm order with unique ID (`#ORD-XXXX`), pending status flow, demo checkout, and idempotency protection against duplicate orders.
- **Digital Pass & QR Code**: Live tactile student meal pass, holo-verified badge, vector QR code for counter scanning, attendance tracker (e.g. 24/60 meals consumed), and check-in timeline.
- **Plan Management**:
  - **Pause Membership**: Pause meal passes up to 4 days (pushes back expiry date).
  - **Renew Subscription**: Lock early-bird student rate with discount.
  - **Tax Invoices**: Download verified GST receipts for hostel reimbursement.
- **Favorites / Bookmarks**: Save preferred messes to a dedicated bookmarked feed.
- **Ratings & Reviews**: Submit 1–5 star reviews with verified subscriber badges and live score recalculation.

### B. Mess Owner
- **Authentication & Segregation**: Dedicated owner login and dashboard portal.
- **Business Profile Editor**: Update mess name, description, address, phone, WhatsApp, food categories (Pure Veg, Egg, Non-Veg, Jain, Vegan, High-Protein), and starting prices.
- **Live Menu Editor**: Update today's lunch and dinner dishes published immediately to students.
- **Incoming Orders Queue**: View pending student membership requests with real-time **Accept** (activates pass) and **Reject** actions.
- **Active Subscriber Roster & Counter Scanner**: View all subscribed students and simulate/verify student QR pass scans to record counter attendance.
- **Dashboard Statistics**: Real-time counter of active subscribers, pending orders, revenue dues, and meals served today.

---

## 3. Quickstart & Local Setup

### Prerequisites
- Node.js v22.5+ or v24+ (Node.js 24.18.0 recommended, includes native `node:sqlite`).

### Installation
Clone or navigate to the project directory:
```bash
cd stitch_messmate_food_discovery_app
```

### Seed Initial Database
Seed initial demo messes (Annapurna, Balaji, Green Bowl, Shiv Shakti, etc.), weekly menus, plans, reviews, and test accounts:
```bash
npm run seed
```

### Start Application Server
```bash
npm start
```
The server will start at: **`http://localhost:3000`**

Open `http://localhost:3000` in your web browser.

---

## 4. Demo Login Credentials

Pre-seeded accounts are ready for instant testing:

| Role | Email | Password | Details |
|------|-------|----------|---------|
| **Student** | `student@messmate.com` | `password123` | Aarav Sharma (Active Annapurna Pass `#MM-8842-DEL`) |
| **Mess Owner** | `owner@annapurna.com` | `password123` | Rameshwar Gupta (Annapurna Student Mess) |
| **Mess Owner 2**| `owner@balaji.com` | `password123` | Suresh Balaji (Shree Balaji Executive Mess) |

*You can also use the 1-click **"Student Demo"** and **"Owner Demo"** quick-login buttons on the login screen.*

---

## 5. Automated Test Suite

Run the comprehensive automated test suite:
```bash
npm test
```

The test suite validates:
1. Password hashing (PBKDF2/scrypt with salt) and timing-safe verification.
2. JWT token generation and verification.
3. Mess listings and combined filter queries (pure veg, budget, locality, high protein).
4. Mess detail relations (plans, 7-day weekly menus, facilities, reviews).
5. Membership order creation with unique ID and duplicate prevention.
6. Mess owner order approval workflow (`pending` -> `active`).
7. Counter QR pass scanning and attendance check-in logging.
8. Membership pause logic (end-date extension).
9. Favorites bookmarking and un-bookmarking.
10. Review submission and average rating recalculation.

---

## 6. REST API Reference

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register new student or owner | No |
| `POST` | `/api/auth/login` | Log in with email & password | No |
| `GET`  | `/api/auth/me` | Fetch authenticated user profile | Bearer Token |
| `PUT`  | `/api/auth/profile` | Update user & student profile | Bearer Token |
| `GET`  | `/api/messes` | Search & filter messes | No |
| `GET`  | `/api/messes/:id` | Get full mess details, menus, plans | No |
| `GET`  | `/api/messes/compare?ids=1,2` | Side-by-side comparison data | No |
| `POST` | `/api/orders` | Purchase/request membership plan | Student |
| `GET`  | `/api/orders/my-orders` | Student's active, pending, past passes | Student |
| `POST` | `/api/orders/:id/pause` | Pause membership (2–4 days) | Student |
| `POST` | `/api/orders/:id/renew` | Renew membership subscription | Student |
| `GET`  | `/api/owner/stats` | Owner dashboard metrics | Owner |
| `GET`  | `/api/owner/orders` | Owner incoming and active orders | Owner |
| `PUT`  | `/api/owner/orders/:id/status` | Accept or reject membership order | Owner |
| `POST` | `/api/owner/verify-counter-qr` | Scan student QR code at counter | Owner |
| `PUT`  | `/api/owner/mess-profile` | Update mess profile & live menu | Owner |
| `GET`  | `/api/favorites` | List student bookmarked messes | Student |
| `POST` | `/api/favorites/:id` | Toggle bookmark on mess | Student |
| `POST` | `/api/messes/:id/reviews` | Submit star rating and comment | Student |

---

## 7. File Structure

```
stitch_messmate_food_discovery_app/
├── server.js                   # Node.js HTTP server & REST API
├── database.js                 # SQLite schema, tables, indexes, constraints
├── auth.js                     # Password hashing, PBKDF2, HMAC JWT tokens
├── seed.js                     # Initial dataset of campus messes, menus, plans
├── package.json                # Project scripts and metadata
├── .env.example                # Configuration environment variables template
├── test/
│   └── test.js                 # Automated 10-step test suite
├── public/
│   ├── index.html              # Main HTML shell with Stitch typography & layout
│   ├── app.js                  # Frontend SPA router, state manager, API handlers
│   └── styles.css              # Custom styling extensions
└── stitch_messmate_food_discovery_app/  # Original Stitch export prototypes (intact)
    ├── fidelity_dark_serif/
    ├── fresh_table/
    ├── mess_details/
    ├── my_plans_membership_card/
    ├── search_filters/
    └── student_home/
```
