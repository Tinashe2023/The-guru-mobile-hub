import express from 'express';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { uploadDocument, generateStorageKey } from '../middleware/upload.js';
import { uploadToB2, getPresignedUrl, deleteFromB2 } from '../config/storage.js';

const router = express.Router();

// ─── Get user's documents ───
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Generate presigned URLs for each document
    const docs = await Promise.all(
      result.rows.map(async (doc) => ({
        ...doc,
        download_url: await getPresignedUrl(doc.file_path, 3600),
      }))
    );

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get documents' });
  }
});

// ─── Upload document ───
router.post('/', authenticate, uploadDocument.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Check user storage quota
    const storageResult = await query(
      `SELECT COALESCE(SUM(file_size), 0) as total_size FROM documents WHERE user_id = $1`,
      [req.user.id]
    );
    const currentUsage = parseInt(storageResult.rows[0].total_size);
    const quota = parseInt(process.env.USER_STORAGE_QUOTA) || 50 * 1024 * 1024;

    if (currentUsage + req.file.size > quota) {
      return res.status(413).json({
        error: 'Storage quota exceeded',
        current: currentUsage,
        quota,
      });
    }

    const docType = req.body.doc_type || (req.query.type === 'print' ? 'print_job' : 'personal');
    const category = docType === 'print_job' ? 'print-jobs' : 'documents';
    const retentionDays = docType === 'print_job'
      ? parseInt(process.env.PRINT_JOB_RETENTION_DAYS) || 7
      : parseInt(process.env.PERSONAL_DOC_RETENTION_DAYS) || 30;

    const autoDeleteAt = new Date();
    autoDeleteAt.setDate(autoDeleteAt.getDate() + retentionDays);

    // Upload to Backblaze B2
    const storageKey = generateStorageKey(req.user.id, category, req.file.originalname);
    await uploadToB2(req.file.buffer, storageKey, req.file.mimetype);

    const result = await query(
      `INSERT INTO documents (user_id, file_name, original_name, file_path, file_size, mime_type, doc_type, auto_delete_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, req.file.originalname, req.file.originalname, storageKey, req.file.size, req.file.mimetype, docType, autoDeleteAt]
    );

    // Include a presigned download URL in the response
    const doc = result.rows[0];
    doc.download_url = await getPresignedUrl(storageKey, 3600);

    res.status(201).json(doc);
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// ─── Get download URL for a document ───
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM documents WHERE id = $1 AND (user_id = $2 OR (shared_with_admin = true AND $3 = 'admin') OR shared_admin_id = $2)`,
      [req.params.id, req.user.id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const url = await getPresignedUrl(result.rows[0].file_path, 3600);
    res.json({ download_url: url, expires_in: 3600 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate download link' });
  }
});

// ─── Share/unshare document with admin ───
router.put('/:id/share', authenticate, async (req, res) => {
  try {
    const { shared, admin_id } = req.body;
    let queryStr = '';
    let queryParams = [];

    // If "shared" is true, we must have an admin_id. If false, we set it to NULL and return false.
    if (shared && admin_id) {
      queryStr = `UPDATE documents SET shared_admin_id = $1, shared_with_admin = false WHERE id = $2 AND user_id = $3 RETURNING *`;
      queryParams = [admin_id, req.params.id, req.user.id];
    } else {
      queryStr = `UPDATE documents SET shared_admin_id = NULL, shared_with_admin = false WHERE id = $1 AND user_id = $2 RETURNING *`;
      queryParams = [req.params.id, req.user.id];
    }

    const result = await query(queryStr, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update document sharing' });
  }
});

// ─── Delete document ───
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from B2
    await deleteFromB2(result.rows[0].file_path);

    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ─── Get admin-shared documents (admin only) ───
router.get('/shared', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await query(
      `SELECT d.*, u.name as owner_name 
       FROM documents d
       JOIN users u ON d.user_id = u.id
       WHERE d.shared_with_admin = true OR d.shared_admin_id = $1
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );

    // Generate presigned download URLs for admin
    const docs = await Promise.all(
      result.rows.map(async (doc) => ({
        ...doc,
        download_url: await getPresignedUrl(doc.file_path, 3600),
      }))
    );

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get shared documents' });
  }
});

export default router;
