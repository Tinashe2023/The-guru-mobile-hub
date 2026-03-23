import express from 'express';
import { query } from '../config/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// ─── Get announcements ───
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(
      `SELECT a.*, u.name as author_name, u.avatar_url as author_avatar, u.role as author_role
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       ORDER BY a.is_pinned DESC, a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query('SELECT COUNT(*) FROM announcements');

    const { getPresignedUrl } = await import('../config/storage.js');
    const announcements = await Promise.all(
      result.rows.map(async (ann) => {
        if (ann.author_avatar && !ann.author_avatar.startsWith('http')) {
          ann.author_avatar = await getPresignedUrl(ann.author_avatar, 86400); // 24 hours
        }
        return ann;
      })
    );

    res.json({
      announcements,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get announcements' });
  }
});

// ─── Create announcement (admin only) ───
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { content, type, is_pinned } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await query(
      `INSERT INTO announcements (author_id, content, type, is_pinned)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, content.trim(), type || 'general', is_pinned || false]
    );

    // Fetch with author info
    const full = await query(
      `SELECT a.*, u.name as author_name, u.avatar_url as author_avatar
       FROM announcements a JOIN users u ON a.author_id = u.id
       WHERE a.id = $1`,
      [result.rows[0].id]
    );

    const announcement = full.rows[0];

    if (announcement.author_avatar && !announcement.author_avatar.startsWith('http')) {
      const { getPresignedUrl } = await import('../config/storage.js');
      announcement.author_avatar = await getPresignedUrl(announcement.author_avatar, 86400);
    }

    // Broadcast to all clients
    const io = req.app.get('io');
    io.emit('announcement:new', announcement);

    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// ─── Update announcement (admin only) ───
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await query(
      `UPDATE announcements
       SET content = $1
       WHERE id = $2 
       RETURNING *`,
      [content.trim(), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Fetch with author info to emit
    const full = await query(
      `SELECT a.*, u.name as author_name, u.avatar_url as author_avatar
       FROM announcements a JOIN users u ON a.author_id = u.id
       WHERE a.id = $1`,
      [result.rows[0].id]
    );

    const announcement = full.rows[0];

    // Ensure avatar is a valid URL if it's stored in B2
    if (announcement.author_avatar && !announcement.author_avatar.startsWith('http')) {
      const { getPresignedUrl } = await import('../config/storage.js');
      announcement.author_avatar = await getPresignedUrl(announcement.author_avatar, 86400);
    }

    // Broadcast update
    const io = req.app.get('io');
    io.emit('announcement:updated', announcement);

    res.json(announcement);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// ─── Delete announcement (admin only) ───
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM announcements WHERE id = $1 RETURNING id', [req.params.id]);
    
    if (result.rows.length > 0) {
      const io = req.app.get('io');
      io.emit('announcement:deleted', req.params.id);
    }
    
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
