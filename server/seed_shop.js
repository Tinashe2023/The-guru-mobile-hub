import dotenv from 'dotenv';
dotenv.config();

import { query } from './config/db.js';

async function seedShopStatus() {
  try {
    const result = await query('SELECT * FROM shop_status LIMIT 1');
    if (result.rows.length > 0) {
      console.log('✅ shop_status already has data:', JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('⚠️ No shop_status rows found. Inserting seed...');
      const ins = await query(
        `INSERT INTO shop_status (is_open, open_time, close_time, banking_status, recharge_airtel, recharge_vi, recharge_jio, printing_status)
         VALUES (true, '11:00:00', '21:30:00', 'available', true, true, true, 'available')
         RETURNING *`
      );
      console.log('✅ Inserted:', JSON.stringify(ins.rows[0], null, 2));
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

seedShopStatus();
