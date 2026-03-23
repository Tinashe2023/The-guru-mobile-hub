import express from 'express';
import { query } from '../config/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── Get all services ───
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM services ORDER BY sort_order ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get services' });
  }
});

// ─── Update service availability (admin only) ───
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { is_available, price } = req.body;
    const result = await query(
      `UPDATE services SET is_available = COALESCE($1, is_available), price = COALESCE($2, price)
       WHERE id = $3 RETURNING *`,
      [is_available, price, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update service' });
  }
});

export default router;
