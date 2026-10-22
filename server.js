// server.js - Mess Finder Full-Stack Backend Server
// Built with native Node.js HTTP and SQLite for ultra-fast, zero-dependency, reliable execution

const http = require('node:http');
const url = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const { getDb, initSchema } = require('./database');
const { hashPassword, verifyPassword, createToken, verifyToken } = require('./auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const STITCH_DIR = path.join(__dirname, 'stitch_messmate_food_discovery_app');

// Initialize database schema
initSchema();
const db = getDb();

// Simple in-memory rate limiting for auth endpoints
const rateLimitMap = new Map();
function checkRateLimit(ip, limit = 50, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }
  rateLimitMap.set(ip, record);
  return record.count <= limit;
}

// Helper: parse JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) { // 2MB limit
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', err => reject(err));
  });
}

// Helper: Send JSON response
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// Helper: Extract authenticated user from header
function getAuthUser(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}

// Helper: MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Main HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const query = Object.fromEntries(reqUrl.searchParams.entries());
  const method = req.method.toUpperCase();
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // --- API ROUTING ---
  try {
    // 1. Auth: Register
    if (pathname === '/api/auth/register' && method === 'POST') {
      if (!checkRateLimit(clientIp, 15)) {
        return sendJson(res, 429, { error: 'Too many registration requests. Please wait a minute.' });
      }
      const body = await parseJsonBody(req);
      const { name, email, password, role, phone, campus_area, college_name, dietary_preference } = body;

      if (!name || !email || !password || !role) {
        return sendJson(res, 400, { error: 'Name, email, password, and role are required.' });
      }
      if (!['student', 'owner'].includes(role)) {
        return sendJson(res, 400, { error: 'Invalid role. Must be "student" or "owner".' });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: 'Password must be at least 6 characters long.' });
      }

      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return sendJson(res, 409, { error: 'An account with this email already exists.' });
      }

      const passHash = hashPassword(password);
      const userRes = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone, campus_area)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name.trim(), email.trim().toLowerCase(), passHash, role, phone || '', campus_area || 'North Campus');

      const userId = Number(userRes.lastInsertRowid);

      if (role === 'student') {
        db.prepare(`
          INSERT INTO student_profiles (user_id, college_name, student_id_number, dietary_preference)
          VALUES (?, ?, ?, ?)
        `).run(
          userId,
          college_name || 'Delhi University',
          `#MM-${Math.floor(1000 + Math.random() * 9000)}-DEL`,
          dietary_preference || 'pure_veg'
        );
      } else if (role === 'owner') {
        // Create an initial draft mess for owner
        db.prepare(`
          INSERT INTO mess_businesses (owner_id, name, description, address, locality, phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          `${name}'s Mess`,
          'Welcome to our mess. Fresh home-cooked meals every day.',
          'Campus Area, North Campus',
          'North Campus',
          phone || ''
        );
      }

      const token = createToken({ id: userId, email: email.toLowerCase(), role });
      const user = db.prepare('SELECT id, name, email, role, phone, campus_area, avatar_url FROM users WHERE id = ?').get(userId);

      return sendJson(res, 201, {
        message: 'Account created successfully',
        token,
        user
      });
    }

    // 2. Auth: Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      if (!checkRateLimit(clientIp, 30)) {
        return sendJson(res, 429, { error: 'Too many login attempts. Please wait a minute.' });
      }
      const body = await parseJsonBody(req);
      const { email, password } = body;

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Email and password are required.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (!user || !verifyPassword(password, user.password_hash)) {
        return sendJson(res, 401, { error: 'Invalid email or password.' });
      }

      const token = createToken({ id: user.id, email: user.email, role: user.role });
      delete user.password_hash;

      let profile = null;
      let mess = null;
      if (user.role === 'student') {
        profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id);
      } else if (user.role === 'owner') {
        mess = db.prepare('SELECT * FROM mess_businesses WHERE owner_id = ?').get(user.id);
      }

      return sendJson(res, 200, {
        message: 'Login successful',
        token,
        user: { ...user, profile, mess }
      });
    }

    // 3. Auth: Current User Profile (Me)
    if (pathname === '/api/auth/me' && method === 'GET') {
      const auth = getAuthUser(req);
      if (!auth) {
        return sendJson(res, 401, { error: 'Authentication required' });
      }

      const user = db.prepare('SELECT id, name, email, role, phone, campus_area, avatar_url, created_at FROM users WHERE id = ?').get(auth.id);
      if (!user) {
        return sendJson(res, 404, { error: 'User not found' });
      }

      let profile = null;
      let mess = null;
      if (user.role === 'student') {
        profile = db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(user.id);
      } else if (user.role === 'owner') {
        mess = db.prepare('SELECT * FROM mess_businesses WHERE owner_id = ?').get(user.id);
      }

      return sendJson(res, 200, { user: { ...user, profile, mess } });
    }

    // 4. Update Profile
    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });

      const body = await parseJsonBody(req);
      const { name, phone, campus_area, college_name, hostel_room, dietary_preference } = body;

      if (name) {
        db.prepare('UPDATE users SET name = ?, phone = ?, campus_area = ? WHERE id = ?')
          .run(name.trim(), phone || '', campus_area || 'North Campus', auth.id);
      }

      if (auth.role === 'student') {
        db.prepare(`
          UPDATE student_profiles
          SET college_name = COALESCE(?, college_name),
              hostel_room = COALESCE(?, hostel_room),
              dietary_preference = COALESCE(?, dietary_preference)
          WHERE user_id = ?
        `).run(college_name, hostel_room, dietary_preference, auth.id);
      }

      const user = db.prepare('SELECT id, name, email, role, phone, campus_area, avatar_url FROM users WHERE id = ?').get(auth.id);
      const profile = auth.role === 'student' ? db.prepare('SELECT * FROM student_profiles WHERE user_id = ?').get(auth.id) : null;
      return sendJson(res, 200, { message: 'Profile updated successfully', user: { ...user, profile } });
    }

    // 5. Mess Discovery / Search / Filter API
    if (pathname === '/api/messes' && method === 'GET') {
      const q = (query.q || '').trim();
      const locality = (query.locality || '').trim();
      const isPureVeg = query.is_pure_veg;
      const hasNonVeg = query.has_non_veg;
      const hasEgg = query.has_egg;
      const isJain = query.is_jain;
      const isVegan = query.is_vegan;
      const hasHighProtein = query.has_high_protein;
      const maxPrice = query.max_price ? Number(query.max_price) : null;
      const minPrice = query.min_price ? Number(query.min_price) : null;
      const minRating = query.min_rating ? Number(query.min_rating) : null;
      const maxDistance = query.max_distance ? Number(query.max_distance) : null;
      const sort = query.sort || 'rating_desc';

      let sql = 'SELECT * FROM mess_businesses WHERE 1=1';
      const params = [];

      if (q) {
        sql += ` AND (name LIKE ? OR locality LIKE ? OR address LIKE ? OR cuisines LIKE ?)`;
        const wild = `%${q}%`;
        params.push(wild, wild, wild, wild);
      }

      if (locality && locality !== 'All' && locality !== 'Campus Area') {
        sql += ` AND locality LIKE ?`;
        params.push(`%${locality}%`);
      }

      if (isPureVeg === '1' || isPureVeg === 'true') {
        sql += ` AND is_pure_veg = 1`;
      }
      if (hasNonVeg === '1' || hasNonVeg === 'true') {
        sql += ` AND has_non_veg = 1`;
      }
      if (hasEgg === '1' || hasEgg === 'true') {
        sql += ` AND has_egg = 1`;
      }
      if (isJain === '1' || isJain === 'true') {
        sql += ` AND is_jain_available = 1`;
      }
      if (isVegan === '1' || isVegan === 'true') {
        sql += ` AND is_vegan_available = 1`;
      }
      if (hasHighProtein === '1' || hasHighProtein === 'true') {
        sql += ` AND has_high_protein = 1`;
      }
      if (maxPrice !== null && !isNaN(maxPrice)) {
        sql += ` AND monthly_starting_price <= ?`;
        params.push(maxPrice);
      }
      if (minPrice !== null && !isNaN(minPrice)) {
        sql += ` AND monthly_starting_price >= ?`;
        params.push(minPrice);
      }
      if (minRating !== null && !isNaN(minRating)) {
        sql += ` AND rating >= ?`;
        params.push(minRating);
      }
      if (maxDistance !== null && !isNaN(maxDistance)) {
        sql += ` AND distance_km <= ?`;
        params.push(maxDistance);
      }

      // Sorting
      if (sort === 'price_asc') {
        sql += ' ORDER BY monthly_starting_price ASC';
      } else if (sort === 'price_desc') {
        sql += ' ORDER BY monthly_starting_price DESC';
      } else if (sort === 'distance_asc') {
        sql += ' ORDER BY distance_km ASC';
      } else {
        sql += ' ORDER BY rating DESC, review_count DESC';
      }

      const rows = db.prepare(sql).all(...params);

      // Parse JSON fields
      const results = rows.map(r => ({
        ...r,
        photos: JSON.parse(r.photos_json || '[]'),
        facilities: JSON.parse(r.facilities_json || '[]'),
        meal_timings: JSON.parse(r.meal_timings_json || '{}')
      }));

      return sendJson(res, 200, {
        count: results.length,
        messes: results
      });
    }

    // 6. Mess Details by ID
    const messDetailMatch = pathname.match(/^\/api\/messes\/(\d+)$/);
    if (messDetailMatch && method === 'GET') {
      const messId = Number(messDetailMatch[1]);
      const mess = db.prepare('SELECT * FROM mess_businesses WHERE id = ?').get(messId);
      if (!mess) {
        return sendJson(res, 404, { error: 'Mess not found' });
      }

      mess.photos = JSON.parse(mess.photos_json || '[]');
      mess.facilities = JSON.parse(mess.facilities_json || '[]');
      mess.meal_timings = JSON.parse(mess.meal_timings_json || '{}');

      // Fetch Plans
      const plans = db.prepare('SELECT * FROM membership_plans WHERE mess_id = ? AND is_active = 1 ORDER BY price ASC').all(messId)
        .map(p => ({
          ...p,
          features: JSON.parse(p.features_json || '[]')
        }));

      // Fetch Weekly Menu
      const weeklyMenus = db.prepare('SELECT * FROM weekly_menus WHERE mess_id = ?').all(messId);

      // Fetch Reviews
      const reviews = db.prepare(`
        SELECT r.*, u.name as reviewer_name, u.avatar_url as reviewer_avatar,
               sp.college_name as reviewer_college
        FROM reviews r
        JOIN users u ON r.student_id = u.id
        LEFT JOIN student_profiles sp ON u.id = sp.user_id
        WHERE r.mess_id = ?
        ORDER BY r.created_at DESC
        LIMIT 20
      `).all(messId);

      return sendJson(res, 200, {
        mess,
        plans,
        weekly_menus: weeklyMenus,
        reviews
      });
    }

    // 7. Compare Messes
    if (pathname === '/api/messes/compare' && method === 'GET') {
      const idsParam = query.ids || '';
      const ids = idsParam.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id) && id > 0);

      if (ids.length === 0) {
        return sendJson(res, 400, { error: 'Provide at least one mess ID to compare, e.g., ?ids=1,2' });
      }

      const placeholders = ids.map(() => '?').join(',');
      const rows = db.prepare(`SELECT * FROM mess_businesses WHERE id IN (${placeholders})`).all(...ids);
      const messes = rows.map(r => ({
        ...r,
        photos: JSON.parse(r.photos_json || '[]'),
        facilities: JSON.parse(r.facilities_json || '[]'),
        meal_timings: JSON.parse(r.meal_timings_json || '{}'),
        plans: db.prepare('SELECT * FROM membership_plans WHERE mess_id = ? AND is_active = 1').all(r.id)
      }));

      return sendJson(res, 200, { messes });
    }

    // 8. Membership Purchase / Orders (Create Order)
    if (pathname === '/api/orders' && method === 'POST') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'You must be logged in as a student to purchase a membership.' });
      if (auth.role !== 'student') return sendJson(res, 403, { error: 'Only students can purchase membership plans.' });

      const body = await parseJsonBody(req);
      const { plan_id, payment_method, notes } = body;

      if (!plan_id) {
        return sendJson(res, 400, { error: 'plan_id is required.' });
      }

      const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ? AND is_active = 1').get(Number(plan_id));
      if (!plan) {
        return sendJson(res, 404, { error: 'Selected membership plan does not exist or is inactive.' });
      }

      // Duplicate prevention check: Check if student already has a pending or active order for this exact plan in the same mess
      const existingOrder = db.prepare(`
        SELECT id, order_number, status FROM membership_orders
        WHERE student_id = ? AND mess_id = ? AND plan_id = ? AND status IN ('pending', 'active')
      `).get(auth.id, plan.mess_id, plan.id);

      if (existingOrder) {
        return sendJson(res, 409, {
          error: `You already have an ${existingOrder.status} membership order (${existingOrder.order_number}) for this plan.`,
          order_id: existingOrder.id
        });
      }

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
      const totalMeals = plan.duration_days * (plan.meals_per_day || 2);
      const qrPassCode = `MM-PASS-${auth.id}-${Date.now().toString().slice(-4)}`;

      // Initial status: Starts in 'pending' awaiting mess owner verification/approval, or 'active' if instant pass
      // As requested in Section 6: starts in pending, mess owner can accept or reject
      const status = 'pending';

      const orderRes = db.prepare(`
        INSERT INTO membership_orders (
          order_number, student_id, mess_id, plan_id, status, total_amount,
          duration_days, start_date, end_date, total_meals, consumed_meals,
          pause_days_used, pause_days_allowed, is_paused, qr_code_token, notes
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `).run(
        orderNumber,
        auth.id,
        plan.mess_id,
        plan.id,
        status,
        plan.price,
        plan.duration_days,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        totalMeals,
        0, // 0 consumed initially
        0,
        plan.max_pause_days || 4,
        0,
        qrPassCode,
        notes || 'Booked via Mess Finder Web'
      );

      const orderId = Number(orderRes.lastInsertRowid);

      // Create Demo Payment record
      const txnRef = `TXN-DEMO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      db.prepare(`
        INSERT INTO payments (order_id, user_id, amount, status, payment_method, transaction_ref, is_demo, paid_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        auth.id,
        plan.price,
        'completed',
        payment_method || 'demo_checkout',
        txnRef,
        1,
        new Date().toISOString()
      );

      const createdOrder = db.prepare(`
        SELECT o.*, m.name as mess_name, m.address as mess_address, m.phone as mess_phone,
               p.name as plan_name, p.meal_frequency_text
        FROM membership_orders o
        JOIN mess_businesses m ON o.mess_id = m.id
        JOIN membership_plans p ON o.plan_id = p.id
        WHERE o.id = ?
      `).get(orderId);

      return sendJson(res, 201, {
        message: 'Membership request submitted successfully! Awaiting owner confirmation.',
        order: createdOrder
      });
    }

    // 9. Student: My Orders & Digital Passes
    if (pathname === '/api/orders/my-orders' && method === 'GET') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });

      const orders = db.prepare(`
        SELECT o.*, m.name as mess_name, m.address as mess_address, m.phone as mess_phone,
               m.banner_url as mess_banner, m.meal_timings_json,
               p.name as plan_name, p.meal_frequency_text, p.description as plan_desc
        FROM membership_orders o
        JOIN mess_businesses m ON o.mess_id = m.id
        JOIN membership_plans p ON o.plan_id = p.id
        WHERE o.student_id = ?
        ORDER BY o.created_at DESC
      `).all(auth.id);

      // Attach check-ins for active plans
      const enrichedOrders = orders.map(ord => {
        const checkins = db.prepare(`
          SELECT * FROM counter_checkins WHERE order_id = ? ORDER BY checked_in_at DESC LIMIT 10
        `).all(ord.id);
        return {
          ...ord,
          checkins,
          meal_timings: JSON.parse(ord.meal_timings_json || '{}')
        };
      });

      return sendJson(res, 200, { orders: enrichedOrders });
    }

    // 10. Pause Membership Order (Student Action)
    const pauseMatch = pathname.match(/^\/api\/orders\/(\d+)\/pause$/);
    if (pauseMatch && method === 'POST') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      const orderId = Number(pauseMatch[1]);
      const body = await parseJsonBody(req);
      const pauseDays = Number(body.days || 2);

      const order = db.prepare('SELECT * FROM membership_orders WHERE id = ? AND student_id = ?').get(orderId, auth.id);
      if (!order) return sendJson(res, 404, { error: 'Order not found' });
      if (order.status !== 'active') return sendJson(res, 400, { error: 'Only active memberships can be paused.' });

      if (order.pause_days_used + pauseDays > order.pause_days_allowed) {
        return sendJson(res, 400, {
          error: `Cannot pause for ${pauseDays} days. You have ${order.pause_days_allowed - order.pause_days_used} pause days remaining.`
        });
      }

      // Push back end_date
      const currentEnd = new Date(order.end_date);
      const newEnd = new Date(currentEnd.getTime() + pauseDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      db.prepare(`
        UPDATE membership_orders
        SET end_date = ?, pause_days_used = pause_days_used + ?, is_paused = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newEnd, pauseDays, orderId);

      return sendJson(res, 200, {
        message: `Membership successfully paused for ${pauseDays} days. New expiry date is ${newEnd}.`,
        new_end_date: newEnd,
        pause_days_used: order.pause_days_used + pauseDays
      });
    }

    // 11. Renew Membership Order
    const renewMatch = pathname.match(/^\/api\/orders\/(\d+)\/renew$/);
    if (renewMatch && method === 'POST') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      const orderId = Number(renewMatch[1]);

      const oldOrder = db.prepare('SELECT * FROM membership_orders WHERE id = ? AND student_id = ?').get(orderId, auth.id);
      if (!oldOrder) return sendJson(res, 404, { error: 'Order not found' });

      const plan = db.prepare('SELECT * FROM membership_plans WHERE id = ?').get(oldOrder.plan_id);
      if (!plan) return sendJson(res, 404, { error: 'Plan is no longer available' });

      // Extend from old end date or today
      const startDate = new Date(oldOrder.end_date) > new Date() ? new Date(oldOrder.end_date) : new Date();
      const endDate = new Date(startDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
      const newOrderNum = `ORD-RNW-${Date.now().toString().slice(-6)}`;
      const qrPassCode = `MM-PASS-${auth.id}-${Date.now().toString().slice(-4)}`;

      const newOrderRes = db.prepare(`
        INSERT INTO membership_orders (
          order_number, student_id, mess_id, plan_id, status, total_amount,
          duration_days, start_date, end_date, total_meals, consumed_meals,
          pause_days_used, pause_days_allowed, is_paused, qr_code_token, notes
        ) VALUES (
          ?, ?, ?, ?, 'active', ?,
          ?, ?, ?, ?, 0,
          0, ?, 0, ?, 'Renewal Membership Order'
        )
      `).run(
        newOrderNum,
        auth.id,
        plan.mess_id,
        plan.id,
        plan.price,
        plan.duration_days,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        plan.duration_days * (plan.meals_per_day || 2),
        plan.max_pause_days || 4,
        qrPassCode
      );

      return sendJson(res, 201, {
        message: 'Subscription successfully renewed!',
        order_id: Number(newOrderRes.lastInsertRowid),
        order_number: newOrderNum
      });
    }

    // 12. Mess Owner Dashboard: Stats
    if (pathname === '/api/owner/stats' && method === 'GET') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      if (auth.role !== 'owner' && auth.role !== 'admin') {
        return sendJson(res, 403, { error: 'Only mess owners can access owner statistics.' });
      }

      const mess = db.prepare('SELECT * FROM mess_businesses WHERE owner_id = ?').get(auth.id);
      if (!mess) return sendJson(res, 404, { error: 'No mess business found for this account.' });

      const activeCount = db.prepare("SELECT count(*) as c FROM membership_orders WHERE mess_id = ? AND status = 'active'").get(mess.id).c;
      const pendingCount = db.prepare("SELECT count(*) as c FROM membership_orders WHERE mess_id = ? AND status = 'pending'").get(mess.id).c;
      const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM membership_orders WHERE mess_id = ? AND status IN ('active', 'accepted', 'expired')").get(mess.id).s;
      const todayCheckins = db.prepare("SELECT count(*) as c FROM counter_checkins WHERE mess_id = ? AND date(checked_in_at) = date('now')").get(mess.id).c;

      return sendJson(res, 200, {
        mess_id: mess.id,
        mess_name: mess.name,
        active_subscribers: activeCount,
        pending_requests: pendingCount,
        total_revenue: totalRevenue,
        today_meals_served: todayCheckins,
        spots_left: mess.spots_left
      });
    }

    // 13. Mess Owner Dashboard: Orders Queue & Subscribers
    if (pathname === '/api/owner/orders' && method === 'GET') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      if (auth.role !== 'owner' && auth.role !== 'admin') return sendJson(res, 403, { error: 'Access denied' });

      const mess = db.prepare('SELECT id FROM mess_businesses WHERE owner_id = ?').get(auth.id);
      if (!mess) return sendJson(res, 404, { error: 'No mess business found' });

      const statusFilter = query.status;
      let sql = `
        SELECT o.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
               u.avatar_url as student_avatar, sp.college_name, sp.hostel_room, sp.student_id_number,
               p.name as plan_name, p.meal_frequency_text
        FROM membership_orders o
        JOIN users u ON o.student_id = u.id
        LEFT JOIN student_profiles sp ON u.id = sp.user_id
        JOIN membership_plans p ON o.plan_id = p.id
        WHERE o.mess_id = ?
      `;
      const params = [mess.id];

      if (statusFilter) {
        sql += ' AND o.status = ?';
        params.push(statusFilter);
      }
      sql += ' ORDER BY o.created_at DESC';

      const orders = db.prepare(sql).all(...params);
      return sendJson(res, 200, { orders });
    }

    // 14. Mess Owner: Update Order Status (Accept / Reject)
    const orderStatusMatch = pathname.match(/^\/api\/owner\/orders\/(\d+)\/status$/);
    if (orderStatusMatch && method === 'PUT') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      if (auth.role !== 'owner' && auth.role !== 'admin') return sendJson(res, 403, { error: 'Access denied' });

      const orderId = Number(orderStatusMatch[1]);
      const body = await parseJsonBody(req);
      const { status } = body;

      if (!['active', 'accepted', 'rejected', 'cancelled'].includes(status)) {
        return sendJson(res, 400, { error: 'Invalid order status. Allowed: active, accepted, rejected, cancelled.' });
      }

      const mess = db.prepare('SELECT id FROM mess_businesses WHERE owner_id = ?').get(auth.id);
      if (!mess) return sendJson(res, 404, { error: 'Mess not found' });

      const order = db.prepare('SELECT * FROM membership_orders WHERE id = ? AND mess_id = ?').get(orderId, mess.id);
      if (!order) return sendJson(res, 404, { error: 'Order not found for this mess.' });

      db.prepare('UPDATE membership_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, orderId);

      return sendJson(res, 200, {
        message: `Membership order marked as ${status}.`,
        order_id: orderId,
        new_status: status
      });
    }

    // 15. Mess Owner: Counter QR Pass Scan & Check-in
    if (pathname === '/api/owner/verify-counter-qr' && method === 'POST') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      if (auth.role !== 'owner' && auth.role !== 'admin') return sendJson(res, 403, { error: 'Access denied' });

      const body = await parseJsonBody(req);
      const { qr_token, meal_type } = body;

      if (!qr_token) return sendJson(res, 400, { error: 'QR token is required' });

      const mess = db.prepare('SELECT id FROM mess_businesses WHERE owner_id = ?').get(auth.id);
      if (!mess) return sendJson(res, 404, { error: 'Mess not found' });

      const order = db.prepare(`
        SELECT o.*, u.name as student_name, sp.college_name, sp.student_id_number,
               p.name as plan_name
        FROM membership_orders o
        JOIN users u ON o.student_id = u.id
        LEFT JOIN student_profiles sp ON u.id = sp.user_id
        JOIN membership_plans p ON o.plan_id = p.id
        WHERE o.qr_code_token = ? AND o.mess_id = ?
      `).get(qr_token.trim(), mess.id);

      if (!order) {
        return sendJson(res, 404, { error: 'Invalid or unknown student QR pass for this mess.' });
      }

      if (order.status !== 'active') {
        return sendJson(res, 400, {
          error: `Membership is ${order.status}. Only active memberships can be scanned for meals.`,
          order_status: order.status
        });
      }

      if (order.consumed_meals >= order.total_meals) {
        return sendJson(res, 400, { error: 'All subscription meals for this cycle have already been utilized.' });
      }

      const mealTypeNormalized = ['breakfast', 'lunch', 'dinner'].includes(meal_type) ? meal_type : 'lunch';
      const mealTitle = `${mealTypeNormalized.toUpperCase()} Thali Served (${new Date().toLocaleTimeString()})`;

      // Record check-in
      db.prepare(`
        INSERT INTO counter_checkins (order_id, mess_id, student_id, meal_type, meal_title, verified_by)
        VALUES (?, ?, ?, ?, ?, 'Counter QR Scanner')
      `).run(order.id, mess.id, order.student_id, mealTypeNormalized, mealTitle);

      // Increment consumed meals
      db.prepare('UPDATE membership_orders SET consumed_meals = consumed_meals + 1 WHERE id = ?').run(order.id);

      return sendJson(res, 200, {
        success: true,
        message: `Meal verified! Welcome ${order.student_name}.`,
        student_name: order.student_name,
        college: order.college_name,
        consumed_meals: order.consumed_meals + 1,
        total_meals: order.total_meals,
        remaining_meals: order.total_meals - (order.consumed_meals + 1)
      });
    }

    // 16. Mess Owner: Update Business Profile & Menu
    if (pathname === '/api/owner/mess-profile' && method === 'PUT') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      if (auth.role !== 'owner' && auth.role !== 'admin') return sendJson(res, 403, { error: 'Access denied' });

      const body = await parseJsonBody(req);
      const {
        name, description, address, locality, phone, whatsapp,
        is_pure_veg, has_non_veg, has_egg, is_jain_available, is_vegan_available,
        has_high_protein, cuisines, monthly_starting_price, single_thali_price,
        spots_left, today_lunch_menu, today_dinner_menu
      } = body;

      const mess = db.prepare('SELECT id FROM mess_businesses WHERE owner_id = ?').get(auth.id);
      if (!mess) return sendJson(res, 404, { error: 'Mess not found' });

      db.prepare(`
        UPDATE mess_businesses
        SET name = COALESCE(?, name),
            description = COALESCE(?, description),
            address = COALESCE(?, address),
            locality = COALESCE(?, locality),
            phone = COALESCE(?, phone),
            whatsapp = COALESCE(?, whatsapp),
            is_pure_veg = COALESCE(?, is_pure_veg),
            has_non_veg = COALESCE(?, has_non_veg),
            has_egg = COALESCE(?, has_egg),
            is_jain_available = COALESCE(?, is_jain_available),
            is_vegan_available = COALESCE(?, is_vegan_available),
            has_high_protein = COALESCE(?, has_high_protein),
            cuisines = COALESCE(?, cuisines),
            monthly_starting_price = COALESCE(?, monthly_starting_price),
            single_thali_price = COALESCE(?, single_thali_price),
            spots_left = COALESCE(?, spots_left),
            today_lunch_menu = COALESCE(?, today_lunch_menu),
            today_dinner_menu = COALESCE(?, today_dinner_menu),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name, description, address, locality, phone, whatsapp,
        is_pure_veg, has_non_veg, has_egg, is_jain_available, is_vegan_available,
        has_high_protein, cuisines, monthly_starting_price, single_thali_price,
        spots_left, today_lunch_menu, today_dinner_menu, mess.id
      );

      const updated = db.prepare('SELECT * FROM mess_businesses WHERE id = ?').get(mess.id);
      return sendJson(res, 200, { message: 'Mess business details updated successfully', mess: updated });
    }

    // 17. Favorites / Bookmarks
    if (pathname === '/api/favorites' && method === 'GET') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });

      const favs = db.prepare(`
        SELECT m.*
        FROM favorites f
        JOIN mess_businesses m ON f.mess_id = m.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
      `).all(auth.id);

      const parsed = favs.map(f => ({
        ...f,
        photos: JSON.parse(f.photos_json || '[]'),
        facilities: JSON.parse(f.facilities_json || '[]')
      }));

      return sendJson(res, 200, { favorites: parsed });
    }

    const favToggleMatch = pathname.match(/^\/api\/favorites\/(\d+)$/);
    if (favToggleMatch && method === 'POST') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      const messId = Number(favToggleMatch[1]);

      const existing = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND mess_id = ?').get(auth.id, messId);
      if (existing) {
        db.prepare('DELETE FROM favorites WHERE id = ?').run(existing.id);
        return sendJson(res, 200, { favorited: false, message: 'Removed from bookmarks' });
      } else {
        db.prepare('INSERT INTO favorites (user_id, mess_id) VALUES (?, ?)').run(auth.id, messId);
        return sendJson(res, 201, { favorited: true, message: 'Saved to bookmarks' });
      }
    }

    // 18. Reviews: Submit a review
    const reviewSubmitMatch = pathname.match(/^\/api\/messes\/(\d+)\/reviews$/);
    if (reviewSubmitMatch && method === 'POST') {
      const auth = getAuthUser(req);
      if (!auth) return sendJson(res, 401, { error: 'Authentication required' });
      const messId = Number(reviewSubmitMatch[1]);

      const body = await parseJsonBody(req);
      const { rating, comment } = body;

      if (!rating || rating < 1 || rating > 5) {
        return sendJson(res, 400, { error: 'Rating must be an integer between 1 and 5' });
      }
      if (!comment || comment.trim().length < 5) {
        return sendJson(res, 400, { error: 'Comment must be at least 5 characters long' });
      }

      // Check if student has active or past order with this mess
      const hasOrder = db.prepare(`
        SELECT id FROM membership_orders WHERE student_id = ? AND mess_id = ?
      `).get(auth.id, messId);

      db.prepare(`
        INSERT INTO reviews (mess_id, student_id, rating, comment, is_verified_subscriber)
        VALUES (?, ?, ?, ?, ?)
      `).run(messId, auth.id, Math.round(rating), comment.trim(), hasOrder ? 1 : 0);

      // Recalculate average rating
      const stat = db.prepare(`
        SELECT count(*) as count, AVG(rating) as avg_rating FROM reviews WHERE mess_id = ?
      `).get(messId);

      const newRating = Number(stat.avg_rating.toFixed(1));
      db.prepare('UPDATE mess_businesses SET rating = ?, review_count = ? WHERE id = ?')
        .run(newRating, stat.count, messId);

      return sendJson(res, 201, {
        message: 'Review submitted successfully',
        new_rating: newRating,
        review_count: stat.count
      });
    }

    // --- STATIC FILES & SPA FALLBACK ---
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // If file exists in public/
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Check if requesting an asset from stitch_messmate_food_discovery_app
    const stitchPath = path.join(STITCH_DIR, pathname);
    if (fs.existsSync(stitchPath) && fs.statSync(stitchPath).isFile()) {
      const ext = path.extname(stitchPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(stitchPath).pipe(res);
    }

    // SPA Fallback: If route is not an /api call, serve public/index.html
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexPath).pipe(res);
    }

    return sendJson(res, 404, { error: 'Not Found' });

  } catch (err) {
    console.error('Server error on', method, pathname, err);
    return sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Mess Finder Server running on http://localhost:${PORT}`);
});

module.exports = { server };
