import express from 'express';
import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse, 
  generateAuthenticationOptions, 
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';
import { query } from '../config/db.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { issueCsrfCookie } from '../middleware/security.js';

const router = express.Router();

const rpName = 'Guru Mobile Hub';
const rpID = process.env.CLIENT_URL ? new URL(process.env.CLIENT_URL).hostname : 'localhost';
const origin = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Registration (Profile Page) ───
router.get('/register/generate-options', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const existingCreds = await query('SELECT credential_id FROM webauthn_credentials WHERE user_id = $1', [user.id]);
    
    // In @simplewebauthn/server v10, userID should be a Uint8Array. 
    // We can convert the UUID to a Buffer/Uint8Array, or just encode as utf-8 string -> bytes
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existingCreds.rows.map(c => ({
        id: c.credential_id,
        type: 'public-key',
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Save challenge
    await query('UPDATE users SET current_challenge = $1 WHERE id = $2', [options.challenge, user.id]);

    res.json(options);
  } catch (err) {
    console.error('generateRegistrationOptions err', err);
    res.status(500).json({ error: 'Failed to generate options' });
  }
});

router.post('/register/verify', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { body } = req;

    const challengeRes = await query('SELECT current_challenge FROM users WHERE id = $1', [user.id]);
    const expectedChallenge = challengeRes.rows[0]?.current_challenge;
    
    if (!expectedChallenge) return res.status(400).json({ error: 'No active challenge found' });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;
      // Depending on version, credentialID might be a Uint8Array. Convert to base64url string if so, otherwise use body.id
      const credIdString = body.id; 

      await query(
        `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, credIdString, Buffer.from(credentialPublicKey), counter, body.response.transports || []]
      );

      // Clear challenge
      await query('UPDATE users SET current_challenge = NULL WHERE id = $1', [user.id]);

      return res.json({ verified: true });
    }
    
    res.status(400).json({ error: 'Verification failed' });
  } catch (err) {
    console.error('verifyRegistrationResponse err', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Login (Authentication) ───
router.get('/login/generate-options', async (req, res) => {
  try {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });
    
    res.cookie('webauthn_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000 // 5 mins
    });

    res.json(options);
  } catch (err) {
    console.error('generateAuthOptions err', err);
    res.status(500).json({ error: 'Failed to generate logic options' });
  }
});

router.post('/login/verify', async (req, res) => {
  try {
    const { body } = req;
    const expectedChallenge = req.cookies.webauthn_challenge;
    
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Challenge expired or not found. Please try again.' });
    }

    // Look up credential by ID (body.id)
    const credResult = await query('SELECT * FROM webauthn_credentials WHERE credential_id = $1', [body.id]);
    if (credResult.rows.length === 0) {
      return res.status(404).json({ error: 'Authenticator not registered' });
    }

    const credential = credResult.rows[0];
    const userResult = await query('SELECT * FROM users WHERE id = $1', [credential.user_id]);
    const user = userResult.rows[0];

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
           credentialID: credential.credential_id, // v10 uses string natively
           credentialPublicKey: credential.public_key, // Postgres BYTEA mapped to Buffer (Uint8Array compat)
           counter: parseInt(credential.counter)
        },
        requireUserVerification: true,
      });
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update counter
      await query('UPDATE webauthn_credentials SET counter = $1 WHERE id = $2', [authenticationInfo.newCounter, credential.id]);
      
      const token = generateToken(user.id);
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      issueCsrfCookie(res);

      res.clearCookie('webauthn_challenge');

      const { password_hash, current_challenge, ...safeUser } = user;
      return res.json({ verified: true, user: safeUser });
    }

    res.status(400).json({ error: 'Verification failed' });
  } catch (err) {
    console.error('verifyAuthResponse err', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
