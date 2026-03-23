import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { authenticate, generateToken } from '../middleware/auth.js';

const router = express.Router();

// ─── Register ───
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, name, phone, is_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar_url, language_pref`,
      [email, hashedPassword, name, phone || null, true]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── Login ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, email, name, password_hash, role, avatar_url, language_pref FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google login. Please sign in with Google.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    const { password_hash, ...safeUser } = user;

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── Google OAuth (redirect-based) ───
router.get('/google', (req, res) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL)}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&access_type=offline`;
  res.redirect(googleAuthUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=no_code`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();
    if (!tokens.access_token) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=token_failed`);
    }

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userInfoRes.json();

    // Find or create user
    let result = await query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleUser.id, googleUser.email]);
    let user;

    if (result.rows.length > 0) {
      user = result.rows[0];
      // Update google_id if not set
      if (!user.google_id) {
        await query('UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3', [googleUser.id, googleUser.picture, user.id]);
      }
    } else {
      const insertResult = await query(
        `INSERT INTO users (email, name, google_id, avatar_url, is_verified)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [googleUser.email, googleUser.name, googleUser.id, googleUser.picture]
      );
      user = insertResult.rows[0];
    }

    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.CLIENT_URL}/dashboard?token=${token}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
  }
});

// ─── Get Current User ───
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, avatar_url, language_pref FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (user.avatar_url && !user.avatar_url.startsWith('http')) {
      const { getPresignedUrl } = await import('../config/storage.js');
      user.avatar_url = await getPresignedUrl(user.avatar_url, 86400); // 24 hours
    }
    res.json({ user });
  } catch (err) {
    console.error('Fetch /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── Logout ───
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

export default router;
