import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const run = async () => {
  try {
    // Add current_challenge to users if it doesn't exist
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS current_challenge TEXT');
    console.log('Added current_challenge to users');

    // Create webauthn_credentials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          credential_id TEXT UNIQUE NOT NULL,
          public_key BYTEA NOT NULL,
          counter BIGINT NOT NULL,
          transports VARCHAR(255)[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Created webauthn_credentials table');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    pool.end();
  }
};

run();
