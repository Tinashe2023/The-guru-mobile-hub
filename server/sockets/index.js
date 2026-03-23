import jwt from "jsonwebtoken";
import { query } from "../config/db.js";

export const setupSocketHandlers = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        "SELECT id, email, name, role, avatar_url FROM users WHERE id = $1",
        [decoded.userId],
      );

      if (result.rows.length === 0) {
        return next(new Error("User not found"));
      }

      socket.user = result.rows[0];
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.user.name} (${socket.user.role})`);

    // Join personal room
    socket.join(`user:${socket.user.id}`);

    // Admins join admin room
    if (socket.user.role === "admin") {
      socket.join("admins");
    }

    // Join conversation rooms
    socket.on("conversation:join", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on("typing:start", (data) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
        userId: socket.user.id,
        userName: socket.user.name,
        conversationId: data.conversationId,
      });
    });

    socket.on("typing:stop", (data) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        userId: socket.user.id,
        conversationId: data.conversationId,
      });
    });

    // Message reactions
    socket.on("reaction:add", async (data) => {
      try {
        const { messageId, emoji } = data;

        // Verify access to conversation
        const msg = await query(
          `SELECT m.conversation_id, c.customer_id, c.admin_id
           FROM messages m
           JOIN conversations c ON m.conversation_id = c.id
           WHERE m.id = $1`,
          [messageId],
        );

        if (msg.rows.length === 0) return;

        const conv = msg.rows[0];
        if (
          socket.user.role !== "admin" &&
          conv.customer_id !== socket.user.id
        ) {
          return;
        }

        // Add reaction to database
        const result = await query(
          `INSERT INTO message_reactions (message_id, user_id, emoji)
           VALUES ($1, $2, $3)
           ON CONFLICT (message_id, user_id, emoji) DO NOTHING
           RETURNING *`,
          [messageId, socket.user.id, emoji],
        );

        if (result.rows.length > 0) {
          // Emit to conversation
          socket
            .to(`conversation:${conv.conversation_id}`)
            .emit("reaction:added", {
              messageId,
              reaction: result.rows[0],
              userName: socket.user.name,
            });
        }
      } catch (err) {
        console.error("Reaction add error:", err);
      }
    });

    socket.on("reaction:remove", async (data) => {
      try {
        const { messageId, emoji } = data;

        // Remove reaction from database
        const result = await query(
          "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 RETURNING *",
          [messageId, socket.user.id, emoji],
        );

        if (result.rows.length > 0) {
          // Get conversation ID and emit
          const msg = await query(
            "SELECT conversation_id FROM messages WHERE id = $1",
            [messageId],
          );
          socket
            .to(`conversation:${msg.rows[0].conversation_id}`)
            .emit("reaction:removed", {
              messageId,
              reaction: result.rows[0],
              userName: socket.user.name,
            });
        }
      } catch (err) {
        console.error("Reaction remove error:", err);
      }
    });

    // Message editing
    socket.on("message:edit", async (data) => {
      try {
        const { messageId, content } = data;

        // Verify ownership
        const msg = await query("SELECT * FROM messages WHERE id = $1", [
          messageId,
        ]);
        if (msg.rows.length === 0 || msg.rows[0].sender_id !== socket.user.id) {
          return;
        }

        // Check if message is too old (24 hours limit)
        const messageAge =
          Date.now() - new Date(msg.rows[0].created_at).getTime();
        if (messageAge > 24 * 60 * 60 * 1000) {
          return;
        }

        // Update message
        const result = await query(
          `UPDATE messages
           SET content = $1, is_edited = true, edited_at = NOW(), original_content = COALESCE(original_content, content)
           WHERE id = $2 RETURNING *`,
          [content.trim(), messageId],
        );

        if (result.rows.length > 0) {
          // Emit updated message
          socket
            .to(`conversation:${msg.rows[0].conversation_id}`)
            .emit("message:updated", {
              id: result.rows[0].id,
              content: result.rows[0].content,
              is_edited: true,
              edited_at: result.rows[0].edited_at,
            });
        }
      } catch (err) {
        console.error("Message edit error:", err);
      }
    });

    // Message deletion
    socket.on("message:delete", async (data) => {
      try {
        const { messageId } = data;

        // Verify ownership
        const msg = await query("SELECT * FROM messages WHERE id = $1", [
          messageId,
        ]);
        if (msg.rows.length === 0 || msg.rows[0].sender_id !== socket.user.id) {
          return;
        }

        // Delete message
        await query("DELETE FROM messages WHERE id = $1", [messageId]);

        // Emit deletion
        socket
          .to(`conversation:${msg.rows[0].conversation_id}`)
          .emit("message:deleted", messageId);
      } catch (err) {
        console.error("Message delete error:", err);
      }
    });

    // Read receipts
    socket.on("messages:mark_read", async (data) => {
      try {
        const { conversationId } = data;

        // Verify access
        const conv = await query("SELECT * FROM conversations WHERE id = $1", [
          conversationId,
        ]);
        if (conv.rows.length === 0) return;

        const conversation = conv.rows[0];
        if (
          socket.user.role !== "admin" &&
          conversation.customer_id !== socket.user.id
        ) {
          return;
        }

        // Mark messages as read
        const result = await query(
          `UPDATE messages
           SET is_read = true, read_at = NOW()
           WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
           RETURNING id`,
          [conversationId, socket.user.id],
        );

        if (result.rows.length > 0) {
          // Emit read receipts
          socket.to(`conversation:${conversationId}`).emit("messages:read", {
            conversationId,
            userId: socket.user.id,
            messageIds: result.rows.map((r) => r.id),
          });
        }
      } catch (err) {
        console.error("Mark read error:", err);
      }
    });

    // Online status
    io.emit("user:online", {
      userId: socket.user.id,
      name: socket.user.name,
      role: socket.user.role,
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
      io.emit("user:offline", { userId: socket.user.id });
    });
  });
};
