import express from 'express';
import { query } from '../config/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── Get all products ───
router.get('/', async (req, res) => {
  try {
    const category = req.query.category;
    let result;
    if (category) {
      result = await query('SELECT * FROM products WHERE category = $1 ORDER BY created_at DESC', [category]);
    } else {
      result = await query('SELECT * FROM products ORDER BY created_at DESC');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// ─── Add product (admin only) ───
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, name_hi, name_pa, description, category, price, original_price, image_url, stock_quantity } = req.body;

    const result = await query(
      `INSERT INTO products (name, name_hi, name_pa, description, category, price, original_price, image_url, stock_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, name_hi, name_pa, description, category, price, original_price, image_url, stock_quantity || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ─── Update product (admin only) ───
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, original_price, image_url, is_available, stock_quantity } = req.body;
    const result = await query(
      `UPDATE products SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price), original_price = COALESCE($4, original_price),
        image_url = COALESCE($5, image_url), is_available = COALESCE($6, is_available),
        stock_quantity = COALESCE($7, stock_quantity), updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [name, description, price, original_price, image_url, is_available, stock_quantity, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ─── Delete product (admin only) ───
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
