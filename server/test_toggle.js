import fs from 'fs';
import { query } from './config/db.js';

async function testToggle() {
  try {
    const current = await query('SELECT * FROM shop_status ORDER BY id');
    let out = { current: current.rows, result: null };

    const body = { recharge_vi: true };

    const allowedFields = [
      'is_open', 'banking_status', 'banking_message',
      'recharge_airtel', 'recharge_vi', 'recharge_jio',
      'printing_status', 'custom_message'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    updates.push(`updated_at = NOW()`);

    const queryText = `
      UPDATE shop_status SET
        ${updates.join(',\n        ')}
      WHERE id = (SELECT id FROM shop_status ORDER BY id LIMIT 1)
      RETURNING *
    `;

    const result = await query(queryText, values);
    out.result = result.rows;
    
    fs.writeFileSync('test_output.json', JSON.stringify(out, null, 2));    
  } catch(e) {
    fs.writeFileSync('test_output.json', JSON.stringify({error: e.message}));
  }
  process.exit();
}

testToggle();
