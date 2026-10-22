// database.js - Mess Finder / MessMate SQLite Database Layer
// Uses Node.js 24 native node:sqlite DatabaseSync for zero external dependencies

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'mess_finder.sqlite');

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_FILE);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  return dbInstance;
}

function initSchema() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'owner', 'admin')),
      phone TEXT,
      campus_area TEXT DEFAULT 'North Campus',
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      college_name TEXT DEFAULT 'Faculty of Arts, North Campus',
      student_id_number TEXT DEFAULT '#MM-8842-DEL',
      hostel_room TEXT DEFAULT 'Hostel 4, Room 204',
      dietary_preference TEXT DEFAULT 'pure_veg',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mess_businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT NOT NULL,
      locality TEXT NOT NULL,
      distance_km REAL DEFAULT 0.5,
      walking_minutes INTEGER DEFAULT 6,
      phone TEXT,
      whatsapp TEXT,
      is_pure_veg INTEGER DEFAULT 1,
      has_non_veg INTEGER DEFAULT 0,
      has_egg INTEGER DEFAULT 0,
      is_jain_available INTEGER DEFAULT 0,
      is_vegan_available INTEGER DEFAULT 0,
      has_high_protein INTEGER DEFAULT 0,
      cuisines TEXT DEFAULT 'North Indian, Thali',
      rating REAL DEFAULT 4.8,
      review_count INTEGER DEFAULT 0,
      monthly_starting_price INTEGER DEFAULT 1499,
      single_thali_price INTEGER DEFAULT 80,
      spots_left INTEGER DEFAULT 10,
      is_open_now INTEGER DEFAULT 1,
      is_verified INTEGER DEFAULT 1,
      is_fssai_certified INTEGER DEFAULT 1,
      banner_url TEXT,
      photos_json TEXT DEFAULT '[]',
      facilities_json TEXT DEFAULT '["Pure RO Water", "Unlimited Chapatis", "Home Style Cooked", "Clean Dining"]',
      meal_timings_json TEXT DEFAULT '{"breakfast": "7:30 - 9:30 AM", "lunch": "12:30 - 2:30 PM", "dinner": "7:30 - 10:00 PM"}',
      today_lunch_menu TEXT,
      today_dinner_menu TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weekly_menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mess_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
      lunch_menu TEXT NOT NULL,
      dinner_menu TEXT NOT NULL,
      special_item TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mess_id) REFERENCES mess_businesses(id) ON DELETE CASCADE,
      UNIQUE(mess_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS membership_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mess_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      plan_type TEXT NOT NULL CHECK(plan_type IN ('trial', 'weekly', 'monthly', 'semester')),
      duration_days INTEGER NOT NULL,
      price INTEGER NOT NULL,
      original_price INTEGER,
      meals_per_day INTEGER DEFAULT 2,
      meal_frequency_text TEXT DEFAULT 'Lunch + Dinner',
      description TEXT,
      features_json TEXT DEFAULT '["Full thali with sweet", "Unlimited roti & rice refills", "Free RO mineral water"]',
      max_pause_days INTEGER DEFAULT 4,
      is_popular INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mess_id) REFERENCES mess_businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS membership_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL,
      mess_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'rejected', 'active', 'expired', 'cancelled')),
      total_amount INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_meals INTEGER NOT NULL,
      consumed_meals INTEGER DEFAULT 0,
      pause_days_used INTEGER DEFAULT 0,
      pause_days_allowed INTEGER DEFAULT 4,
      is_paused INTEGER DEFAULT 0,
      qr_code_token TEXT UNIQUE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (mess_id) REFERENCES mess_businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'INR',
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'refunded', 'failed')),
      payment_method TEXT DEFAULT 'demo_checkout',
      transaction_ref TEXT UNIQUE NOT NULL,
      is_demo INTEGER DEFAULT 1,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES membership_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS counter_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      mess_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
      meal_title TEXT NOT NULL,
      verified_by TEXT DEFAULT 'Counter QR',
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES membership_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (mess_id) REFERENCES mess_businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mess_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (mess_id) REFERENCES mess_businesses(id) ON DELETE CASCADE,
      UNIQUE(user_id, mess_id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mess_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      is_verified_subscriber INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mess_id) REFERENCES mess_businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mess_locality ON mess_businesses(locality);
    CREATE INDEX IF NOT EXISTS idx_mess_price ON mess_businesses(monthly_starting_price);
    CREATE INDEX IF NOT EXISTS idx_orders_student ON membership_orders(student_id);
    CREATE INDEX IF NOT EXISTS idx_orders_mess ON membership_orders(mess_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON membership_orders(status);
  `);

  console.log('Database schema verified successfully.');
}

module.exports = {
  getDb,
  initSchema,
  DB_FILE
};
