import express from "express";
import path from "path";
import { query } from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { uploadDocument, generateStorageKey } from "../middleware/upload.js";
import { uploadToB2, getPresignedUrl } from "../config/storage.js";

const router = express.Router();

// ─── Get conversations (for current user, or all for admin) ───
router.get("/conversations", authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await query(
        `SELECT c.*, u.name as customer_name, u.avatar_url as customer_avatar,
         a.name as admin_name, a.avatar_url as admin_avatar,
         (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_read = false AND sender_id != $1) as unread_count
         FROM conversations c
         JOIN users u ON c.customer_id = u.id
         LEFT JOIN users a ON c.admin_id = a.id
         ORDER BY c.last_message_at DESC`,
        [req.user.id],
      );
    } else {
      result = await query(
        `SELECT c.*,
         a.name as admin_name, a.avatar_url as admin_avatar,
         (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
         (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND is_read = false AND sender_id != $1) as unread_count
         FROM conversations c
         LEFT JOIN users a ON c.admin_id = a.id
         WHERE c.customer_id = $1
         ORDER BY c.last_message_at DESC`,
        [req.user.id],
      );
    }

    const conversations = await Promise.all(
      result.rows.map(async (c) => {
        if (c.customer_avatar && !c.customer_avatar.startsWith("http")) {
          c.customer_avatar = await getPresignedUrl(c.customer_avatar, 86400);
        }
        if (c.admin_avatar && !c.admin_avatar.startsWith("http")) {
          c.admin_avatar = await getPresignedUrl(c.admin_avatar, 86400);
        }
        return c;
      }),
    );

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

// ─── Create conversation ───
router.post("/conversations", authenticate, async (req, res) => {
  try {
    const { subject, admin_id } = req.body;

    // Check if customer already has an active conversation with this specific admin (or general if null)
    if (req.user.role !== "admin") {
      const existing = await query(
        `SELECT id FROM conversations WHERE customer_id = $1 AND (($2::uuid IS NULL AND admin_id IS NULL) OR admin_id = $2) AND status = 'active'`,
        [req.user.id, admin_id || null],
      );
      if (existing.rows.length > 0) {
        return res.json(existing.rows[0]);
      }
    }

    const result = await query(
      `INSERT INTO conversations (customer_id, admin_id, subject)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, admin_id || null, subject || "Direct Support"],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ─── Get messages for a conversation ───
router.get("/conversations/:id/messages", authenticate, async (req, res) => {
  try {
    const convId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Verify access
    const conv = await query("SELECT * FROM conversations WHERE id = $1", [
      convId,
    ]);
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (req.user.role !== "admin" && conv.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await query(
      `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role,
       r.id as reply_to_id, ru.name as reply_sender_name, r.content as reply_content,
       (SELECT json_agg(json_build_object('emoji', mr.emoji, 'user_id', mr.user_id, 'user_name', mu.name))
        FROM message_reactions mr JOIN users mu ON mr.user_id = mu.id
        WHERE mr.message_id = m.id) as reactions
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages r ON m.reply_to_id = r.id
       LEFT JOIN users ru ON r.sender_id = ru.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [convId, limit, offset],
    );

    // Mark messages as read
    await query(
      `UPDATE messages SET is_read = true
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [convId, req.user.id],
    );

    // Generate presigned URLs for file messages and avatars
    const messages = await Promise.all(
      result.rows.map(async (msg) => {
        if (msg.message_type === "file" && msg.file_url) {
          msg.download_url = await getPresignedUrl(msg.file_url, 3600);
        }
        if (msg.sender_avatar && !msg.sender_avatar.startsWith("http")) {
          msg.sender_avatar = await getPresignedUrl(msg.sender_avatar, 86400);
        }
        return msg;
      }),
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// ─── Send a message ───
router.post("/conversations/:id/messages", authenticate, async (req, res) => {
  try {
    const convId = req.params.id;
    const { content, message_type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Verify access
    const conv = await query("SELECT * FROM conversations WHERE id = $1", [
      convId,
    ]);
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (req.user.role !== "admin" && conv.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [convId, req.user.id, content.trim(), message_type || "text"],
    );

    // Update conversation timestamp
    await query(
      "UPDATE conversations SET last_message_at = NOW() WHERE id = $1",
      [convId],
    );

    // Fetch with sender info
    const full = await query(
      `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role
       FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = $1`,
      [result.rows[0].id],
    );

    const message = full.rows[0];
    if (message.sender_avatar && !message.sender_avatar.startsWith("http")) {
      message.sender_avatar = await getPresignedUrl(
        message.sender_avatar,
        86400,
      );
    }

    // Socket.IO emit
    const io = req.app.get("io");
    io.to(`conversation:${convId}`).emit("message:new", message);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ─── Send a file message ───
router.post(
  "/conversations/:id/messages/file",
  authenticate,
  uploadDocument.single("file"),
  async (req, res) => {
    try {
      const convId = req.params.id;
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      // Verify access
      const conv = await query("SELECT * FROM conversations WHERE id = $1", [
        convId,
      ]);
      if (conv.rows.length === 0)
        return res.status(404).json({ error: "Conversation not found" });
      if (req.user.role !== "admin" && conv.rows[0].customer_id !== req.user.id)
        return res.status(403).json({ error: "Access denied" });

      // Upload to B2
      const category = "documents";
      const storageKey = generateStorageKey(
        req.user.id,
        category,
        req.file.originalname,
      );
      await uploadToB2(req.file.buffer, storageKey, req.file.mimetype);

      const result = await query(
        `INSERT INTO messages (conversation_id, sender_id, message_type, file_url, file_name, file_size)
       VALUES ($1, $2, 'file', $3, $4, $5) RETURNING *`,
        [convId, req.user.id, storageKey, req.file.originalname, req.file.size],
      );

      await query(
        "UPDATE conversations SET last_message_at = NOW() WHERE id = $1",
        [convId],
      );

      const full = await query(
        `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role
       FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = $1`,
        [result.rows[0].id],
      );

      const message = full.rows[0];
      message.download_url = await getPresignedUrl(message.file_url, 3600);
      if (message.sender_avatar && !message.sender_avatar.startsWith("http")) {
        message.sender_avatar = await getPresignedUrl(
          message.sender_avatar,
          86400,
        );
      }

      const io = req.app.get("io");
      io.to(`conversation:${convId}`).emit("message:new", message);

      res.status(201).json(message);
    } catch (err) {
      console.error("Chat file upload err:", err);
      res.status(500).json({ error: "Failed to send file" });
    }
  },
);

// ─── Edit message ───
router.put("/messages/:id", authenticate, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Verify ownership
    const msg = await query("SELECT * FROM messages WHERE id = $1", [
      messageId,
    ]);
    if (msg.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (msg.rows[0].sender_id !== req.user.id) {
      return res.status(403).json({ error: "Can only edit your own messages" });
    }

    // Check if message is too old (24 hours limit)
    const messageAge = Date.now() - new Date(msg.rows[0].created_at).getTime();
    if (messageAge > 24 * 60 * 60 * 1000) {
      return res
        .status(400)
        .json({ error: "Cannot edit messages older than 24 hours" });
    }

    const result = await query(
      `UPDATE messages
       SET content = $1, is_edited = true, edited_at = NOW(), original_content = COALESCE(original_content, content)
       WHERE id = $2 RETURNING *`,
      [content.trim(), messageId],
    );

    const full = await query(
      `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar, u.role as sender_role
       FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = $1`,
      [result.rows[0].id],
    );

    const message = full.rows[0];
    if (message.sender_avatar && !message.sender_avatar.startsWith("http")) {
      message.sender_avatar = await getPresignedUrl(
        message.sender_avatar,
        86400,
      );
    }

    // Socket.IO emit
    const io = req.app.get("io");
    io.to(`conversation:${msg.rows[0].conversation_id}`).emit(
      "message:updated",
      message,
    );

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// ─── Delete message ───
router.delete("/messages/:id", authenticate, async (req, res) => {
  try {
    const messageId = req.params.id;

    // Verify ownership
    const msg = await query("SELECT * FROM messages WHERE id = $1", [
      messageId,
    ]);
    if (msg.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (msg.rows[0].sender_id !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Can only delete your own messages" });
    }

    await query("DELETE FROM messages WHERE id = $1", [messageId]);

    // Socket.IO emit
    const io = req.app.get("io");
    io.to(`conversation:${msg.rows[0].conversation_id}`).emit(
      "message:deleted",
      messageId,
    );

    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// ─── Add reaction ───
router.post("/messages/:id/reactions", authenticate, async (req, res) => {
  try {
    const messageId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    // Verify message exists and user has access
    const msg = await query(
      `SELECT m.*, c.customer_id, c.admin_id
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1`,
      [messageId],
    );
    if (msg.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    const conv = msg.rows[0];
    if (req.user.role !== "admin" && conv.customer_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await query(
      `INSERT INTO message_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING
       RETURNING *`,
      [messageId, req.user.id, emoji],
    );

    if (result.rows.length > 0) {
      // Socket.IO emit
      const io = req.app.get("io");
      io.to(`conversation:${conv.conversation_id}`).emit("reaction:added", {
        messageId,
        reaction: result.rows[0],
        userName: req.user.name,
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to add reaction" });
  }
});

// ─── Remove reaction ───
router.delete(
  "/messages/:id/reactions/:emoji",
  authenticate,
  async (req, res) => {
    try {
      const messageId = req.params.id;
      const emoji = decodeURIComponent(req.params.emoji);

      const result = await query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING *",
        [messageId, req.user.id, emoji],
      );

      if (result.rows.length > 0) {
        // Get conversation ID for socket emit
        const msg = await query(
          "SELECT conversation_id FROM messages WHERE id = $1",
          [messageId],
        );
        const io = req.app.get("io");
        io.to(`conversation:${msg.rows[0].conversation_id}`).emit(
          "reaction:removed",
          {
            messageId,
            reaction: result.rows[0],
            userName: req.user.name,
          },
        );
      }

      res.json({ message: "Reaction removed" });
    } catch (err) {
      res.status(500).json({ error: "Failed to remove reaction" });
    }
  },
);

// ─── Mark messages as read ───
router.post("/conversations/:id/read", authenticate, async (req, res) => {
  try {
    const convId = req.params.id;

    // Verify access
    const conv = await query("SELECT * FROM conversations WHERE id = $1", [
      convId,
    ]);
    if (conv.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (req.user.role !== "admin" && conv.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await query(
      `UPDATE messages
       SET is_read = true, read_at = NOW()
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
       RETURNING id`,
      [convId, req.user.id],
    );

    // Socket.IO emit read receipts
    if (result.rows.length > 0) {
      const io = req.app.get("io");
      io.to(`conversation:${convId}`).emit("messages:read", {
        conversationId: convId,
        userId: req.user.id,
        messageIds: result.rows.map((r) => r.id),
      });
    }

    res.json({ readCount: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

export default router;
