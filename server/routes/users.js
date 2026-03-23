import express from 'express';
import path from 'path';
import { query } from '../config/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { uploadAvatar } from '../middleware/upload.js';
import { uploadToB2, getPresignedUrl } from '../config/storage.js';

const router = express.Router();

// ─── Get user profile ───
router.get('/profile', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, role, avatar_url, language_pref, phone, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    // Generate presigned URL for avatar if it's a B2 key
    if (user.avatar_url && !user.avatar_url.startsWith('http')) {
      user.avatar_url = await getPresignedUrl(user.avatar_url, 86400); // 24-hour URL for avatars
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ─── Update profile ───
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, language_pref } = req.body;
    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
       language_pref = COALESCE($3, language_pref), updated_at = NOW()
       WHERE id = $4 RETURNING id, email, name, role, avatar_url, language_pref, phone`,
      [name, phone, language_pref, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── Upload avatar ───
router.post('/avatar', authenticate, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Upload to B2
    const ext = path.extname(req.file.originalname);
    const storageKey = `users/${req.user.id}/avatars/avatar${ext}`;
    await uploadToB2(req.file.buffer, storageKey, req.file.mimetype);

    // Store the B2 key in the DB (presigned URL generated on read)
    await query('UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2', [storageKey, req.user.id]);

    const avatarUrl = await getPresignedUrl(storageKey, 86400);
    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// ─── List available admins (For sharing) ───
router.get('/admins', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, avatar_url, role 
       FROM users WHERE role = 'admin' ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// ─── List all users (admin only) ───
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, role, avatar_url, language_pref, phone, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// ─── Promote user to admin ───
router.put('/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['customer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, name, role`,
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Emit role change event
    const io = req.app.get('io');
    io.emit('user:role_changed', result.rows[0]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
