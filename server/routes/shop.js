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
    const {
      is_open, banking_status, banking_message,
      recharge_airtel, recharge_vi, recharge_jio,
      printing_status, custom_message
    } = req.body;

    const result = await query(
      `UPDATE shop_status SET
        is_open = COALESCE($1, is_open),
        banking_status = COALESCE($2, banking_status),
        banking_message = COALESCE($3, banking_message),
        recharge_airtel = COALESCE($4, recharge_airtel),
        recharge_vi = COALESCE($5, recharge_vi),
        recharge_jio = COALESCE($6, recharge_jio),
        printing_status = COALESCE($7, printing_status),
        custom_message = COALESCE($8, custom_message),
        updated_at = NOW(),
        updated_by = $9
       WHERE id = (SELECT id FROM shop_status LIMIT 1)
       RETURNING *`,
      [is_open, banking_status, banking_message, recharge_airtel, recharge_vi, recharge_jio, printing_status, custom_message, req.user.id]
    );

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
