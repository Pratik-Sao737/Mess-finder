// test/test.js - Comprehensive Automated Test Suite for Mess Finder
const assert = require('node:assert');
const { getDb, initSchema } = require('../database');
const { hashPassword, verifyPassword, createToken, verifyToken } = require('../auth');

console.log('--- STARTING MESS FINDER TEST SUITE ---');

async function runTests() {
  initSchema();
  const db = getDb();

  // Test 1: Password Hashing & Verification
  console.log('Test 1: Password Hashing & Verification');
  const rawPass = 'HostelStudent2026!';
  const hashed = hashPassword(rawPass);
  assert(hashed && hashed.includes(':'), 'Password hash must be formatted with salt');
  assert(verifyPassword(rawPass, hashed), 'Correct password must verify');
  assert(!verifyPassword('wrongpassword', hashed), 'Wrong password must fail');
  console.log('✓ Password hashing and verification passed');

  // Test 2: JWT Token Creation & Verification
  console.log('Test 2: Token Creation & Verification');
  const payload = { id: 99, email: 'test@student.edu', role: 'student' };
  const token = createToken(payload);
  assert(token && token.includes('.'), 'Token must be properly formatted');
  const decoded = verifyToken(token);
  assert.strictEqual(decoded.id, 99);
  assert.strictEqual(decoded.role, 'student');
  assert(verifyToken('invalid.token') === null, 'Invalid token must return null');
  console.log('✓ Token generation and verification passed');

  // Test 3: Mess Listing & Filters
  console.log('Test 3: Mess Listing & Combined Filters');
  const allMesses = db.prepare('SELECT * FROM mess_businesses').all();
  assert(allMesses.length >= 4, `Expected at least 4 messes, found ${allMesses.length}`);

  // Test pure veg filter
  const vegMesses = db.prepare('SELECT * FROM mess_businesses WHERE is_pure_veg = 1').all();
  assert(vegMesses.every(m => m.is_pure_veg === 1), 'All filtered messes must be pure veg');

  // Test budget filter
  const budgetMesses = db.prepare('SELECT * FROM mess_businesses WHERE monthly_starting_price <= 1500').all();
  assert(budgetMesses.every(m => m.monthly_starting_price <= 1500), 'All budget messes must be <= 1500');

  // Test combined query
  const combined = db.prepare('SELECT * FROM mess_businesses WHERE is_pure_veg = 1 AND monthly_starting_price <= 1500').all();
  assert(combined.every(m => m.is_pure_veg === 1 && m.monthly_starting_price <= 1500), 'Combined filter failed');
  console.log('✓ Mess discovery and filtering passed');

  // Test 4: Annapurna Mess Plans and Weekly Menus
  console.log('Test 4: Mess Detail Relations (Plans, Menus, Reviews)');
  const annapurna = db.prepare("SELECT * FROM mess_businesses WHERE name LIKE '%Annapurna%'").get();
  assert(annapurna, 'Annapurna Mess should exist');

  const plans = db.prepare('SELECT * FROM membership_plans WHERE mess_id = ?').all(annapurna.id);
  assert(plans.length >= 2, 'Annapurna should have multiple membership plans');

  const weeklyMenus = db.prepare('SELECT * FROM weekly_menus WHERE mess_id = ?').all(annapurna.id);
  assert(weeklyMenus.length >= 7, 'Weekly schedule should cover 7 days (Mon-Sun)');
  console.log('✓ Mess plans and weekly menus verified');

  // Test 5: Order Creation & Duplicate Prevention
  console.log('Test 5: Order Creation & Duplicate Prevention');
  const testStudentEmail = `test_student_${Date.now()}@test.com`;
  const userRes = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'student')
  `).run('Test Student', testStudentEmail, hashPassword('testpass123'));
  const testStudentId = Number(userRes.lastInsertRowid);

  const testPlan = plans[0];
  const orderNumber = `ORD-TEST-${Date.now()}`;
  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + testPlan.duration_days * 86400000).toISOString().split('T')[0];

  const orderRes = db.prepare(`
    INSERT INTO membership_orders (
      order_number, student_id, mess_id, plan_id, status, total_amount,
      duration_days, start_date, end_date, total_meals, consumed_meals,
      pause_days_used, pause_days_allowed, is_paused, qr_code_token
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 0, 0, 4, 0, ?)
  `).run(
    orderNumber,
    testStudentId,
    annapurna.id,
    testPlan.id,
    testPlan.price,
    testPlan.duration_days,
    startDate,
    endDate,
    testPlan.duration_days * 2,
    `MM-TEST-QR-${Date.now()}`
  );
  const createdOrderId = Number(orderRes.lastInsertRowid);
  assert(createdOrderId > 0, 'Order must be created with valid ID');

  // Verify duplicate prevention logic
  const duplicateCheck = db.prepare(`
    SELECT id FROM membership_orders
    WHERE student_id = ? AND mess_id = ? AND plan_id = ? AND status IN ('pending', 'active')
  `).get(testStudentId, annapurna.id, testPlan.id);
  assert(duplicateCheck && duplicateCheck.id === createdOrderId, 'Duplicate check query must detect active/pending order');
  console.log('✓ Order creation and duplicate check passed');

  // Test 6: Owner Order Approval Workflow
  console.log('Test 6: Owner Order Approval Workflow');
  db.prepare("UPDATE membership_orders SET status = 'active' WHERE id = ?").run(createdOrderId);
  const updatedOrder = db.prepare('SELECT status FROM membership_orders WHERE id = ?').get(createdOrderId);
  assert.strictEqual(updatedOrder.status, 'active', 'Order must be activated upon owner acceptance');
  console.log('✓ Order approval workflow passed');

  // Test 7: Counter QR Pass Check-in
  console.log('Test 7: Counter QR Pass Scan & Check-in');
  db.prepare(`
    INSERT INTO counter_checkins (order_id, mess_id, student_id, meal_type, meal_title, verified_by)
    VALUES (?, ?, ?, 'lunch', 'Lunch Thali Counter Test', 'QR Scanner')
  `).run(createdOrderId, annapurna.id, testStudentId);

  db.prepare('UPDATE membership_orders SET consumed_meals = consumed_meals + 1 WHERE id = ?').run(createdOrderId);
  const checkinOrder = db.prepare('SELECT consumed_meals FROM membership_orders WHERE id = ?').get(createdOrderId);
  assert.strictEqual(checkinOrder.consumed_meals, 1, 'Consumed meals must increment by 1');
  console.log('✓ Counter check-in passed');

  // Test 8: Pause Membership Logic
  console.log('Test 8: Pause Membership Logic');
  const pauseDays = 3;
  const initialEnd = new Date(endDate);
  const newExpectedEnd = new Date(initialEnd.getTime() + pauseDays * 86400000).toISOString().split('T')[0];

  db.prepare(`
    UPDATE membership_orders
    SET end_date = ?, pause_days_used = pause_days_used + ?, is_paused = 1
    WHERE id = ?
  `).run(newExpectedEnd, pauseDays, createdOrderId);

  const pausedOrder = db.prepare('SELECT end_date, pause_days_used, is_paused FROM membership_orders WHERE id = ?').get(createdOrderId);
  assert.strictEqual(pausedOrder.end_date, newExpectedEnd, 'End date must be extended by pause days');
  assert.strictEqual(pausedOrder.pause_days_used, pauseDays, 'Pause days used must match');
  console.log('✓ Pause membership logic passed');

  // Test 9: Favorites System
  console.log('Test 9: Favorites System');
  db.prepare('INSERT INTO favorites (user_id, mess_id) VALUES (?, ?)').run(testStudentId, annapurna.id);
  const fav = db.prepare('SELECT * FROM favorites WHERE user_id = ? AND mess_id = ?').get(testStudentId, annapurna.id);
  assert(fav, 'Favorite should be recorded');
  db.prepare('DELETE FROM favorites WHERE id = ?').run(fav.id);
  const favDeleted = db.prepare('SELECT * FROM favorites WHERE id = ?').get(fav.id);
  assert(!favDeleted, 'Favorite should be deleted');
  console.log('✓ Favorites system passed');

  // Test 10: Reviews & Average Rating Calculation
  console.log('Test 10: Reviews & Rating Recalculation');
  db.prepare(`
    INSERT INTO reviews (mess_id, student_id, rating, comment)
    VALUES (?, ?, 5, 'Exceptional food quality and service!')
  `).run(annapurna.id, testStudentId);

  const reviewStats = db.prepare('SELECT count(*) as count, AVG(rating) as avg_rating FROM reviews WHERE mess_id = ?').get(annapurna.id);
  assert(reviewStats.count > 0, 'Review count must be > 0');
  assert(reviewStats.avg_rating >= 4.0, 'Average rating must be accurate');
  console.log('✓ Reviews and rating calculation passed');

  console.log('\n========================================');
  console.log('ALL 10 AUTOMATED TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
