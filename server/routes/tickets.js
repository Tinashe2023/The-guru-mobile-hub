import express from 'express';
import { query } from '../config/db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Generate ticket number
const generateTicketNumber = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `GHUB-${num}`;
};

// ─── Get tickets ───
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await query(
        `SELECT t.*, u.name as customer_name, u.avatar_url as customer_avatar,
         a.name as assignee_name
         FROM repair_tickets t
         JOIN users u ON t.customer_id = u.id
         LEFT JOIN users a ON t.assigned_to = a.id
         ORDER BY t.created_at DESC`
      );
    } else {
      result = await query(
        `SELECT t.*, a.name as assignee_name
         FROM repair_tickets t
         LEFT JOIN users a ON t.assigned_to = a.id
         WHERE t.customer_id = $1
         ORDER BY t.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get tickets' });
  }
});

// ─── Get single ticket with updates ───
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticketResult = await query(
      `SELECT t.*, u.name as customer_name, u.email as customer_email, u.avatar_url as customer_avatar,
       a.name as assignee_name
       FROM repair_tickets t
       JOIN users u ON t.customer_id = u.id
       LEFT JOIN users a ON t.assigned_to = a.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];

    // Check access
    if (req.user.role !== 'admin' && ticket.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get updates
    const updatesResult = await query(
      `SELECT ru.*, u.name as author_name, u.role as author_role
       FROM repair_updates ru
       JOIN users u ON ru.author_id = u.id
       WHERE ru.ticket_id = $1 AND (ru.is_customer_visible = true OR $2 = 'admin')
       ORDER BY ru.created_at ASC`,
      [req.params.id, req.user.role]
    );

    res.json({ ...ticket, updates: updatesResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get ticket' });
  }
});

// ─── Create ticket ───
router.post('/', authenticate, async (req, res) => {
  try {
    const { device_type, device_brand, device_model, issue_description } = req.body;

    if (!device_type || !issue_description) {
      return res.status(400).json({ error: 'Device type and issue description are required' });
    }

    const ticketNumber = generateTicketNumber();

    const result = await query(
      `INSERT INTO repair_tickets (ticket_number, customer_id, device_type, device_brand, device_model, issue_description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [ticketNumber, req.user.id, device_type, device_brand || null, device_model || null, issue_description]
    );

    // Log the creation
    await query(
      `INSERT INTO repair_updates (ticket_id, author_id, new_status, note, is_customer_visible)
       VALUES ($1, $2, 'received', 'Ticket created', true)`,
      [result.rows[0].id, req.user.id]
    );

    // Notify admins
    const io = req.app.get('io');
    io.to('admins').emit('ticket:new', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// ─── Update ticket status (admin only) ───
router.put('/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, note, estimated_cost, estimated_completion, is_customer_visible, assigned_to } = req.body;

    const validStatuses = ['received', 'diagnosing', 'waiting_parts', 'repairing', 'testing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get current status
    const current = await query('SELECT status FROM repair_tickets WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const oldStatus = current.rows[0].status;

    // Update ticket
    const result = await query(
      `UPDATE repair_tickets SET
        status = $1, estimated_cost = COALESCE($2, estimated_cost),
        estimated_completion = COALESCE($3, estimated_completion),
        assigned_to = COALESCE($4, assigned_to),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, estimated_cost, estimated_completion, assigned_to, req.params.id]
    );

    // Log update
    await query(
      `INSERT INTO repair_updates (ticket_id, author_id, old_status, new_status, note, is_customer_visible)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.params.id, req.user.id, oldStatus, status, note || null, is_customer_visible !== false]
    );

    const ticket = result.rows[0];

    // Notify customer via socket
    const io = req.app.get('io');
    io.to(`user:${ticket.customer_id}`).emit('ticket:updated', ticket);

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

export default router;
