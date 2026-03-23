import express from 'express';
import { query } from '../config/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── Get current shop status ───
router.get('/status', async (req, res) => {
  try {
    const result = await query('SELECT * FROM shop_status ORDER BY id LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to get shop status' });
  }
});

// ─── Update shop status (admin only) ───
router.put('/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const allowedFields = [
      'is_open', 'banking_status', 'banking_message',
      'recharge_airtel', 'recharge_vi', 'recharge_jio',
      'printing_status', 'custom_message'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex}`);
    values.push(req.user.id);

    const queryText = `
      UPDATE shop_status SET
        ${updates.join(',\n        ')}
      WHERE id = (SELECT id FROM shop_status LIMIT 1)
      RETURNING *
    `;

    const result = await query(queryText, values);

    const status = result.rows[0];

    // Broadcast to all connected clients
    const io = req.app.get('io');
    io.emit('shop:status_updated', status);

    res.json(status);
  } catch (err) {
    console.error('Shop status update error:', err);
    res.status(500).json({ error: 'Failed to update shop status' });
  }
});

export default router;
