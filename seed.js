// seed.js - Seed data for Mess Finder
const { getDb, initSchema } = require('./database');
const { hashPassword } = require('./auth');

function seedDatabase() {
  initSchema();
  const db = getDb();

  // Check if users already seeded
  const existingUsers = db.prepare('SELECT count(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    console.log('Database already has records. Skipping seed.');
    return;
  }

  console.log('Seeding Mess Finder database with initial campus data...');

  const passwordHash = hashPassword('password123');

  // 1. Create Student User: Aarav Sharma
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone, campus_area, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const studentUserResult = insertUser.run(
    'Aarav Sharma',
    'student@messmate.com',
    passwordHash,
    'student',
    '+919876543210',
    'North Campus',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBbaJ7I5OqiTs1_g7YwUUmCGSiFSZrWFUt_pz0mrjt81rTiaa4mcVB7kD7b47XLHBnwC2j6TGlVybt2XEEQXyGaU7sBL_N3b3TOdFAPl1WO0xv5kzSg3eJ67RQwgsLLIEfTUUtjZG2-nniQRC2KuvEDKHulcYtqs-DDXj_Tk8usmoxauIM7H2aoYl0z6c7YPXfhQTxtvkYQuVr7ouztsLm4mir8IJn48FZIXIDCndRhZlOtJQNw1KI1'
  );
  const studentId = Number(studentUserResult.lastInsertRowid);

  // Student Profile
  db.prepare(`
    INSERT INTO student_profiles (user_id, college_name, student_id_number, hostel_room, dietary_preference)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    studentId,
    'Faculty of Arts, North Campus',
    '#MM-8842-DEL',
    'Hostel 4, Room 204',
    'pure_veg'
  );

  // 2. Create Mess Owners
  const annapurnaOwnerResult = insertUser.run(
    'Rameshwar Gupta',
    'owner@annapurna.com',
    passwordHash,
    'owner',
    '+919876543210',
    'North Campus',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  );
  const annapurnaOwnerId = Number(annapurnaOwnerResult.lastInsertRowid);

  const balajiOwnerResult = insertUser.run(
    'Suresh Balaji',
    'owner@balaji.com',
    passwordHash,
    'owner',
    '+919811223344',
    'North Campus',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
  );
  const balajiOwnerId = Number(balajiOwnerResult.lastInsertRowid);

  // 3. Insert Mess Businesses
  const insertMess = db.prepare(`
    INSERT INTO mess_businesses (
      owner_id, name, description, address, locality, distance_km, walking_minutes,
      phone, whatsapp, is_pure_veg, has_non_veg, has_egg, is_jain_available, is_vegan_available,
      has_high_protein, cuisines, rating, review_count, monthly_starting_price, single_thali_price,
      spots_left, is_open_now, is_verified, is_fssai_certified, banner_url, photos_json,
      facilities_json, meal_timings_json, today_lunch_menu, today_dinner_menu
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  // Annapurna Student Mess
  const annapurnaPhotos = JSON.stringify([
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDoPgvXAHH_xueNmX2jabV8-iyvSoogGIh0_VNeWGnpGmF5gzRzk-Acj6gTJ28IQnwDLTLeGH5bNAV5Pl20Z9xsW3DEm_kyq1vxgkvkaYYSHqX1NyULOwEjpuOpvc9o74KQownTind0cbcUJKmaJoGJ3G1ux1eZ1hJW6cn8yNPYOlEVTWQC6J_8HY205S0mhHOe5BwImzEN8MOuZWA-1gW7Lj-TA00hhCY1-7YSbvVe-GgviIDz4QI2",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDaY4ziy-4It3Y8mQff2byx7_5mL_ruwMcc4p1fFUz6SkTDC8j7NUpWPLWPX956mTHQE_SuAHDJyjkt7I_O6NPqEXsgf1to3j9uPhGoyYSB9zIw1sYwPSJWB5KX0O2C1JkhVpsWFxO1DZTqL2czLKtmFrVSJbanSp_Fo-YZVYZEZKW8uy14808blb3Q0SF1gfwV2Z6_YS_G2xQQr-w-FTM5uaqafhPVpY7iE1gY_zM1aIDqiNjO_lq5",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDdFV16-abNA-EOPHaqHgnO6EUA7ooWdjXmm0JjAR08SMJ3L1aVo_SozNM1y7gE4UuJQmkU-RAsVeTEnf1EMSDCwV_HsjBUHew6-4hyix6STDbi21uzbRcAbu2ZNnVQsRNyEc7rFNKck7hz-EqUR7ncSP7NpgRD7sIwb52NhCTMPuIrSv0W5cKL90l0wL7TAPW6iwq3wAZW30cW4XsuVaJUTA6v8Y5OQq8pt4UiqckWJNwEnMuSsV-e",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuATpQYD0v5Ycti5hZ0G6IHyi5_77i3f_d09bvL7RM49TKMfeZFq1Lpq_RC0svneFeXoDyGredTXXTJQ-d_Qz1BvKoTg4AKpvBNljrHRngwA2POZkFvq0-hTSj2NsmWdPImn20OSa--VbZAX5winKt858D_1ZClVgmoyPtHfH_33G78efkeUEacQSIMGGXKGbUNYIGFmv5CiYGUPTrR8I_EbrW0CoAxRq0Q-RqMgUz2i0E-n8qE6VhUz",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC8f2TS-BICVmCfFGwAK_HNem4O7fTOd5kd5TtLJII8rdgQ9KtlU53zzIeBNm_wUlSyUppWuQ4i1X7uLOK6GHuDmb15NfFI4QnLZbb3hfQEnDq7i49mX9NNHSfDElRyiveZIrC2SaH0866pF4F4od-L4Tj12TwGbx6SPbT0FIXnYqMUI-9xmiGX_w9LTG_gYq-vp1IclppZQ0if0ua8CzB1dIZ2myiHaA5PG5IiyhurLMyigDzCYyJN"
  ]);

  const annapurnaFacilities = JSON.stringify([
    "Pure RO Water",
    "Kitchen Inspected",
    "Unlimited Chapatis",
    "Weekend Feasts",
    "Leave Deductions",
    "High-speed Wi-Fi"
  ]);

  const annapurnaRes = insertMess.run(
    annapurnaOwnerId,
    'Annapurna Student Mess',
    'Best mess in North Campus for university and hostel students. Famous for hot phulkas with desi ghee, rich dal tadka, fresh seasonal paneer curries, and Sunday special feasts.',
    'Building No. 14-B, University Enclave, Opp. Central Library Cycle Stand',
    'Near Gate No. 3, North Campus',
    0.4,
    5,
    '+919876543210',
    '919876543210',
    1, // is_pure_veg
    0, // has_non_veg
    1, // has_egg
    1, // is_jain_available
    1, // is_vegan_available
    1, // has_high_protein
    'North Indian, Thali, Desi Ghee Phulka',
    4.8,
    210,
    1799,
    80,
    8,
    1, // open now
    1, // verified
    1, // fssai
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA2ahk2Ybv3snnH1EWS8C3famJ2uNZjUS2aj_ZWQbw6f0nplKOW44mOkYpylxuHg9JM7gqBtbGy7BELyPPBq2TChR-Re8Qvz_oF2RooNZa0A1ZLQPenkzAOUd5cTnwvsFFRUYieZ2d9hXBcaEZ-aG7aEH6eJbSmnmrGsM7GREXGLNDhKIKSNAzk4HKBqEZY4FS9eAmffPndi8tfedrXg2j4IbYXwlEyTkff_enMNnePUoNMcbKwsqOD',
    annapurnaPhotos,
    annapurnaFacilities,
    JSON.stringify({ breakfast: "7:30 - 9:30 AM", lunch: "12:30 - 2:30 PM", dinner: "7:30 - 10:00 PM" }),
    'Dal Tadka, Paneer Butter Masala, Tawa Roti w/ Desi Ghee, Basmati Rice, Fresh Kachumber, Hot Gulab Jamun (1 pc)',
    'Aloo Gobi Adraki, Mixed Dal Makhani, Phulka Rotis, Steam Rice, Curd & Rice Kheer'
  );
  const annapurnaId = Number(annapurnaRes.lastInsertRowid);

  // Shree Balaji Executive Mess
  const balajiRes = insertMess.run(
    balajiOwnerId,
    'Shree Balaji Executive Mess',
    'Premium pure veg dining experience for students and competitive exam aspirants. Featuring unlimited hot ghee rotis and daily changes of North Indian thali specialties.',
    'Plot 42, Hudson Lane, Kingsway Camp, North Campus',
    'Hudson Lane, North Campus',
    0.5,
    6,
    '+919811223344',
    '919811223344',
    1,
    0,
    0,
    1,
    0,
    1,
    'North Indian, Executive Thali',
    4.9,
    340,
    1650,
    75,
    5,
    1,
    1,
    1,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA0WDMj8TLoNRnX5pNS60pRBuUWL8KZML80X2oo2q2JVQK4AsUqVjZJ4Aufp0RQaV5BpkjlhG4pmqnoDHVwqQ7PuLp05iFj22Mz2YINo1WzH_GusdfCt7wBFhws8KiaWbSswvmxSrpXHNsY--9kiV2siSMNOqFzdDHj1teJJbDBCbagiar9OR5tIG4yUoS30WaXgJFwIONL4N6owHfn-JAJq42NiSz2V4us9KEBOQP9sbuekp5kpVo2',
    JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuA0WDMj8TLoNRnX5pNS60pRBuUWL8KZML80X2oo2q2JVQK4AsUqVjZJ4Aufp0RQaV5BpkjlhG4pmqnoDHVwqQ7PuLp05iFj22Mz2YINo1WzH_GusdfCt7wBFhws8KiaWbSswvmxSrpXHNsY--9kiV2siSMNOqFzdDHj1teJJbDBCbagiar9OR5tIG4yUoS30WaXgJFwIONL4N6owHfn-JAJq42NiSz2V4us9KEBOQP9sbuekp5kpVo2"]),
    JSON.stringify(["Unlimited rotis included", "Pure RO Water", "AC Dining Hall", "Student Wi-Fi"]),
    JSON.stringify({ breakfast: "8:00 - 10:00 AM", lunch: "12:00 - 3:00 PM", dinner: "7:30 - 10:30 PM" }),
    'Dal Tadka, Shahi Paneer, Jeera Rice, Tawa Roti, Salad & Boondi Raita',
    'Sev Tamatar, Yellow Dal, Phulka, Steamed Rice, Papad & Sooji Halwa'
  );
  const balajiId = Number(balajiRes.lastInsertRowid);

  // Campus Kitchen & Tiffins
  insertMess.run(
    balajiOwnerId,
    'Campus Kitchen & Tiffins',
    'Modern hostel mess and tiffin service offering fresh Veg & Egg meals with doorstep delivery directly to campus hostels.',
    'Shop 18, Chhatra Marg, Near Arts Faculty',
    'Chhatra Marg, North Campus',
    0.7,
    8,
    '+919822334455',
    '919822334455',
    0,
    0,
    1,
    0,
    0,
    1,
    'North & South Fusion, Egg Curry, Tiffins',
    4.6,
    95,
    1450,
    70,
    12,
    1,
    1,
    1,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCMg-kQokkO20oH43MQRuwVE2dPpnlmNn8ZFzitMEUI4jYlPVMs_RmW0uQiqoIIoXkOh7GehjItHgbxvruHnj524VIBvHcrKOYH4Jmrq_MojFQLUbqFngz5CvtDaJOU3CRqk4xGJ8me9LhnjFNaiADfGfxb3ATPat4ba_-oo2if_ASZ8bdG6p7UleGozO3vEIxaJ5FnUoWzQ3568LcHWeW8m3-TzqMwV9SYhDFUV2c4O9q6t3HZt7y1',
    JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuCMg-kQokkO20oH43MQRuwVE2dPpnlmNn8ZFzitMEUI4jYlPVMs_RmW0uQiqoIIoXkOh7GehjItHgbxvruHnj524VIBvHcrKOYH4Jmrq_MojFQLUbqFngz5CvtDaJOU3CRqk4xGJ8me9LhnjFNaiADfGfxb3ATPat4ba_-oo2if_ASZ8bdG6p7UleGozO3vEIxaJ5FnUoWzQ3568LcHWeW8m3-TzqMwV9SYhDFUV2c4O9q6t3HZt7y1"]),
    JSON.stringify(["Doorstep Hostel Delivery", "Breakfast + Lunch + Dinner", "RO Water", "Custom Tiffin Dabbas"]),
    JSON.stringify({ breakfast: "7:00 - 9:30 AM", lunch: "12:00 - 2:30 PM", dinner: "7:00 - 10:00 PM" }),
    'Egg Curry / Paneer Curry, Yellow Dal, Chapati, Steamed Rice, Cucumber Salad',
    'Mix Veg, Dal Makhani, 4 Phulkas, Rice, Pickle'
  );

  // Satvik Bhojanalaya
  insertMess.run(
    annapurnaOwnerId,
    'Satvik Bhojanalaya',
    'Pure satvik traditional dining with authentic Gujarati & Rajasthani flavors. 100% no onion, no garlic meal options with pure desi ghee.',
    'Lane 3, Bungalow Road, Kamla Nagar',
    'Kamla Nagar, North Campus',
    1.2,
    14,
    '+919833445566',
    '919833445566',
    1,
    0,
    0,
    1,
    1,
    0,
    'Gujarati, Rajasthani, Satvik, Jain',
    4.8,
    180,
    1800,
    90,
    7,
    1,
    1,
    1,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBuhBZlsVsywCKaXDHRfSWiMJZo-_2jvMVkCmWT7gmnmUWhbFTWjM434cDVXxPoC4xkk7XP2IP-zwnIJYcBJQ1aszGLEjVT4Lv2pX3U_zOeWh5JgdqIAIemQmUvY_uLH2LAwhg-7oWIgoSj9b1D1tT-vw5mtSbD1C9IfBL2R6_AJ5pf0C7g_ufnMTn1VrVoewSB24RKsXruUFokQnqEhGyf4fOJpmmLxKNyFqPvttCodFmTYiVd0fFQ',
    JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuBuhBZlsVsywCKaXDHRfSWiMJZo-_2jvMVkCmWT7gmnmUWhbFTWjM434cDVXxPoC4xkk7XP2IP-zwnIJYcBJQ1aszGLEjVT4Lv2pX3U_zOeWh5JgdqIAIemQmUvY_uLH2LAwhg-7oWIgoSj9b1D1tT-vw5mtSbD1C9IfBL2R6_AJ5pf0C7g_ufnMTn1VrVoewSB24RKsXruUFokQnqEhGyf4fOJpmmLxKNyFqPvttCodFmTYiVd0fFQ"]),
    JSON.stringify(["Jain Friendly", "Pure Desi Ghee", "No Onion/Garlic", "Spacious Seating"]),
    JSON.stringify({ lunch: "12:00 - 3:00 PM", dinner: "7:00 - 9:30 PM" }),
    'Gujarati Kadi, Moong Dal Khichdi, Desi Ghee Phulka, Crispy Puris, Sweet Halwa',
    'Gatte ki Sabzi, Dal Baati Churma Special, Green Chutney, Chaas'
  );

  // Green Bowl Healthy Mess
  insertMess.run(
    annapurnaOwnerId,
    'Green Bowl Healthy Mess',
    'Fitness and nutrition focused student kitchen offering high protein options, sprouts, boiled eggs, fresh salads and low-oil homestyle cooking.',
    'Patel Nagar Road, Gate 4 Entrance',
    'Patel Nagar Gate, North Campus',
    0.8,
    9,
    '+919844556677',
    '919844556677',
    0,
    1,
    1,
    0,
    1,
    1,
    'South & North Fusion, Fitness Diet, High Protein',
    4.7,
    128,
    1899,
    85,
    9,
    1,
    1,
    1,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBX_1XrbheFRGVkz1T28FEnu5TL-TUj2m9tfvdpfsqdoOa2mZuD2dghfqivCFsv_MJm-Q8lOnsfDHYczv4v5rHTzh1o7QU6NTw61_OSRulfvCmOpmLQBoYBvW5vFvwx1iu8d_dV-K_a1kpe8flQdhap8guBkzdcnoR7S-TbdqOccnwNfRkinykNOUv_c23NeCsaxHcBKcUnIgvu45dRARPfHbSQkcEwTqNLc15oxVeRD3zX7yg3kZmA',
    JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuBX_1XrbheFRGVkz1T28FEnu5TL-TUj2m9tfvdpfsqdoOa2mZuD2dghfqivCFsv_MJm-Q8lOnsfDHYczv4v5rHTzh1o7QU6NTw61_OSRulfvCmOpmLQBoYBvW5vFvwx1iu8d_dV-K_a1kpe8flQdhap8guBkzdcnoR7S-TbdqOccnwNfRkinykNOUv_c23NeCsaxHcBKcUnIgvu45dRARPfHbSQkcEwTqNLc15oxVeRD3zX7yg3kZmA"]),
    JSON.stringify(["High Protein (Sprouts & Eggs)", "Fitness Friendly", "Sunday Breakfast Included", "RO Water"]),
    JSON.stringify({ breakfast: "7:00 - 9:30 AM", lunch: "12:30 - 3:00 PM", dinner: "7:30 - 10:00 PM" }),
    'Steamed Idli Sambar, Sprouts Salad, Paneer/Egg Bhurji, Brown Rice, Coconut Chutney',
    'Grilled Paneer / Chicken Salad, Yellow Moong Dal, 3 Multi-grain Rotis, Curd'
  );

  // Shiv Shakti Kitchen
  insertMess.run(
    balajiOwnerId,
    'Shiv Shakti Kitchen',
    'Homely, pocket-friendly budget tiffin and mess service tailored for university hostellers. Daily fresh rotis and authentic lentils.',
    'Near Post Office, Roop Nagar',
    'Roop Nagar, North Campus',
    0.6,
    7,
    '+919855667788',
    '919855667788',
    1,
    0,
    0,
    1,
    0,
    0,
    'North Indian, Homestyle Budget Tiffin',
    4.6,
    82,
    1299,
    60,
    15,
    1,
    1,
    0,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD0ShlJHyOYhoVBB8wZ_duzr9iqqvcDYL1pcM8K-jzHM9PPsYMBHPSNc9OXCCyAdhX7BFG5hlrzOaUTEo2kOTy90AJkdNFcnDGA5qWVAlj3t_WFjzHelY74fkvWm7kHz9b0ulo939EoSQFMDtsEyvBYY44EEmFd1gqeLlTiGN7Veqs8K1SsD1swP6sj3FkgIOJYw3hXv7WKMxrQQEytHAhP-EYgLvlWrsOrahKLb_R-FSHdmR78mAfV',
    JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuD0ShlJHyOYhoVBB8wZ_duzr9iqqvcDYL1pcM8K-jzHM9PPsYMBHPSNc9OXCCyAdhX7BFG5hlrzOaUTEo2kOTy90AJkdNFcnDGA5qWVAlj3t_WFjzHelY74fkvWm7kHz9b0ulo939EoSQFMDtsEyvBYY44EEmFd1gqeLlTiGN7Veqs8K1SsD1swP6sj3FkgIOJYw3hXv7WKMxrQQEytHAhP-EYgLvlWrsOrahKLb_R-FSHdmR78mAfV"]),
    JSON.stringify(["Free Wi-Fi", "RO Mineral Water", "AC Dining Hall", "Budget Friendly"]),
    JSON.stringify({ lunch: "12:00 - 3:00 PM", dinner: "7:30 - 10:00 PM" }),
    'Arhar Dal Fry, Aloo Matar Sabzi, 4 Tawa Roti, Rice, Pickle',
    'Black Chana Masala, Jeera Rice, Soft Phulkas, Fresh Salad'
  );

  // Maa Ki Rasoi Tiffin
  insertMess.run(
    balajiOwnerId,
    'Maa Ki Rasoi Tiffin',
    'Warm, nourishing home food with unlimited dal and rotis. Very popular among first-year hostellers looking for home taste.',
    'Main Market, Malkaganj',
    'Malka Ganj, North Campus',
    0.3,
    4,
    '+919866778899',
    '919866778899',
    1,
    0,
    0,
    0,
    0,
    0,
    'North Indian, Homestyle Dal & Roti',
    4.5,
    64,
    1450,
    65,
    11,
    1,
    1,
    0,
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDVhwBzVNI_YQGnKF-Ty4Pfy1K7jeoFJBVWIo569-o6WAJqLVaOrLZ3f6H8VkSrXH64Bx7BJlf3fIHjm9zuqa653N3wAwgZM5uOJYcjzVH3QBKS1sFPcRaZk3sRU8G9aU3E6Y0YyG5gUaupT7-3adbFYuGlI1Igf-bpT5YbYZILpa6loG_lLgvbAHpFTCTJ05YtV0WTahxfBMjARzjvJQig6CBq3TlGtJHreHhpvDWiFoq4kNvAfiF3',
    JSON.stringify(["https://lh3.googleusercontent.com/aida-public/AB6AXuDVhwBzVNI_YQGnKF-Ty4Pfy1K7jeoFJBVWIo569-o6WAJqLVaOrLZ3f6H8VkSrXH64Bx7BJlf3fIHjm9zuqa653N3wAwgZM5uOJYcjzVH3QBKS1sFPcRaZk3sRU8G9aU3E6Y0YyG5gUaupT7-3adbFYuGlI1Igf-bpT5YbYZILpa6loG_lLgvbAHpFTCTJ05YtV0WTahxfBMjARzjvJQig6CBq3TlGtJHreHhpvDWiFoq4kNvAfiF3"]),
    JSON.stringify(["Unlimited Roti", "Purified Water", "Flexible Timings", "Student Friendly"]),
    JSON.stringify({ lunch: "12:15 - 3:15 PM", dinner: "7:15 - 10:15 PM" }),
    'Dal Tadka, Bhindi Masala, Unlimited Hot Rotis, Jeera Rice & Papad',
    'Rajma Masala, Steamed Rice, Butter Roti, Curd'
  );

  // 4. Seed Weekly Menus for Annapurna Student Mess
  const insertMenu = db.prepare(`
    INSERT INTO weekly_menus (mess_id, day_of_week, lunch_menu, dinner_menu, special_item)
    VALUES (?, ?, ?, ?, ?)
  `);

  const annapurnaSchedule = [
    { day: 'Mon', lunch: "Dal Tadka, Paneer Butter Masala, Tawa Roti with Desi Ghee, Basmati Jeera Rice, Fresh Salad & Gulab Jamun.", dinner: "Aloo Gobi Adraki, Mixed Dal Makhani, Phulka Rotis, Steam Rice, Curd & Rice Kheer.", special: "Unlimited Chapati" },
    { day: 'Tue', lunch: "Rajma Masala (Punjabi Style), Boondi Raita, Jeera Rice, Soft Tawa Rotis, Green Salad & Achar.", dinner: "Baingan Bharta, Arhar Dal Tadka, Fulkas, Rice, Papad & Shahi Tukda.", special: "Special Rajma Chawal" },
    { day: 'Wed', lunch: "Chole Bhature / Poori Thali, Mixed Veg Sabzi, Coriander Pulao, Curd, and Sweet Lassi Glass.", dinner: "Bhindi Do Pyaza, Moong Dal Fry, Fresh Chapatis, Steamed Rice & Fruit Custard.", special: "Chole Special Lunch" },
    { day: 'Thu', lunch: "Kadhi Pakoda, Zeera Rice, Dry Aloo Jeera, Tawa Rotis, Onion Rings & Mint Chutney.", dinner: "Kadai Paneer, Yellow Dal, Phulka with butter, Fragrant Rice & Halwa.", special: "Amritsari Kadhi" },
    { day: 'Fri', lunch: "Dum Aloo Kashmiri, Dal Fry, Fresh Rotis with Butter, Vegetable Pulao, Kachumber Salad & Rasgulla.", dinner: "Egg Curry / Malai Kofta (choice), Mixed Dal, Hot Rotis, Steamed Rice & Sevaiyan.", special: "Egg / Kofta Choice" },
    { day: 'Sat', lunch: "Panchmel Dal, Aloo Shimla Mirch, Multigrain Roti, Brown/White Rice, Cucumber Salad & Papad.", dinner: "Khichdi with Desi Ghee / Pav Bhaji Feast, Roasted Papad, Garlic Chutney & Buttermilk.", special: "Comfort Food Night" },
    { day: 'Sun', lunch: "Grand Sunday Feast: Matar Paneer, Special Dal Makhani, Masala Poori, Gulab Jamun, Veg Pulao & Raita.", dinner: "Light Veg Pulao, Curd, Tomato Soup, Garlic Toast & Ice Cream Cup.", special: "Sunday Grand Feast" }
  ];

  for (const item of annapurnaSchedule) {
    insertMenu.run(annapurnaId, item.day, item.lunch, item.dinner, item.special);
    insertMenu.run(balajiId, item.day, item.lunch, item.dinner, item.special);
  }

  // 5. Seed Membership Plans
  const insertPlan = db.prepare(`
    INSERT INTO membership_plans (
      mess_id, name, plan_type, duration_days, price, original_price,
      meals_per_day, meal_frequency_text, description, features_json, max_pause_days, is_popular
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  // Annapurna Plans
  const planWeekly = insertPlan.run(
    annapurnaId,
    'Weekly Trial Plan',
    'weekly',
    7,
    499,
    599,
    1,
    'Lunch only (7 meals)',
    '7 Days · Lunch only (Try before subscribing)',
    JSON.stringify(["Full thali with sweet", "Unlimited roti & rice refills", "Free mineral water"]),
    1,
    0
  );

  const planMonthly = insertPlan.run(
    annapurnaId,
    'Monthly Standard Plan',
    'monthly',
    30,
    1799,
    2149,
    2,
    'Lunch + Dinner (60 meals)',
    '30 Days · Lunch + Dinner (60 meals) · Most Popular with hostelers',
    JSON.stringify(["Unlimited Roti & Rice Refills Included", "Leave Pause Option (Up to 4 days)", "Sunday Special Sweet Treat", "Free RO water"]),
    4,
    1 // popular
  );
  const monthlyPlanId = Number(planMonthly.lastInsertRowid);

  const planSemester = insertPlan.run(
    annapurnaId,
    'Full Semester 3-Meals Plan',
    'semester',
    90,
    4999,
    5999,
    3,
    'Breakfast + Lunch + Dinner (270 meals)',
    '90 Days · Breakfast + Lunch + Dinner · Maximum campus savings',
    JSON.stringify(["Exam & vacation pauses supported (up to 12 days)", "Sunday feast included", "Morning tea & breakfast included"]),
    12,
    0
  );

  // Balaji Plans
  insertPlan.run(
    balajiId,
    'Balaji Executive Monthly Plan',
    'monthly',
    30,
    1650,
    1950,
    2,
    'Lunch + Dinner (60 meals)',
    'Unlimited hot ghee rotis and full executive thalis for 30 days',
    JSON.stringify(["Unlimited rotis", "AC seating", "Free RO water"]),
    4,
    1
  );

  // 6. Seed Active Student Membership for Aarav Sharma
  const now = new Date();
  const startDate = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const orderResult = db.prepare(`
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
    'ORD-2024-8842',
    studentId,
    annapurnaId,
    monthlyPlanId,
    'active',
    1799,
    30,
    startDate,
    endDate,
    60,
    24, // 24 consumed out of 60
    0,
    4,
    0,
    'MM-PASS-8842-AARAV-ANNAPURNA',
    'Monthly Standard Plan with Sunday special sweets'
  );
  const activeOrderId = Number(orderResult.lastInsertRowid);

  // Payment record for active order
  db.prepare(`
    INSERT INTO payments (order_id, user_id, amount, status, payment_method, transaction_ref, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    activeOrderId,
    studentId,
    1799,
    'completed',
    'demo_upi',
    'TXN-UPI-8842-SUCCESS',
    new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString()
  );

  // Seed Counter Check-ins for active order
  const insertCheckin = db.prepare(`
    INSERT INTO counter_checkins (order_id, mess_id, student_id, meal_type, meal_title, verified_by, checked_in_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCheckin.run(
    activeOrderId,
    annapurnaId,
    studentId,
    'lunch',
    'Thali Served: Dal Makhani, Paneer Butter, 3 Roti',
    'Counter QR',
    new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
  );

  insertCheckin.run(
    activeOrderId,
    annapurnaId,
    studentId,
    'dinner',
    'Thali Served: Rajma Rasila, Jeera Rice, Curd',
    'Counter QR',
    new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString() // yesterday evening
  );

  // 7. Seed Past Membership for Aarav Sharma
  const pastStartDate = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const pastEndDate = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const pastOrderResult = db.prepare(`
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
    'ORD-2024-7711',
    studentId,
    annapurnaId,
    monthlyPlanId,
    'expired',
    1799,
    30,
    pastStartDate,
    pastEndDate,
    60,
    58,
    2,
    4,
    0,
    'MM-PASS-7711-EXPIRED',
    'Previous month plan successfully fulfilled'
  );

  // 8. Seed Favorites
  db.prepare(`
    INSERT INTO favorites (user_id, mess_id)
    VALUES (?, ?)
  `).run(studentId, annapurnaId);

  db.prepare(`
    INSERT INTO favorites (user_id, mess_id)
    VALUES (?, ?)
  `).run(studentId, balajiId);

  // 9. Seed Reviews for Annapurna
  const insertReview = db.prepare(`
    INSERT INTO reviews (mess_id, student_id, rating, comment, is_verified_subscriber)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertReview.run(
    annapurnaId,
    studentId,
    5,
    'Best mess in North Campus hands down! The rotis are soft and piping hot, just like home. Dal tadka on Mondays is something I look forward to after lab classes.',
    1
  );

  console.log('Seed completed successfully!');
  console.log('Demo Credentials:');
  console.log('Student: student@messmate.com / password123');
  console.log('Mess Owner: owner@annapurna.com / password123');
  console.log('Mess Owner 2: owner@balaji.com / password123');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
