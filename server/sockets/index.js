import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const setupSocketHandlers = (io) => {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, email, name, role, avatar_url FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = result.rows[0];
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.user.name} (${socket.user.role})`);

    // Join personal room
    socket.join(`user:${socket.user.id}`);

    // Admins join admin room
    if (socket.user.role === 'admin') {
      socket.join('admins');
    }

    // Join conversation rooms
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        userId: socket.user.id,
        userName: socket.user.name,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        userId: socket.user.id,
        conversationId: data.conversationId,
      });
    });

    // Online status
    io.emit('user:online', {
      userId: socket.user.id,
      name: socket.user.name,
      role: socket.user.role,
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.user.name}`);
      io.emit('user:offline', { userId: socket.user.id });
    });
  });
};
