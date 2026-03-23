import { query } from './config/db.js';

async function cleanup() {
  try {
    console.log("Cleaning up shop_status...");
    // keep the lowest id
    await query(`
      DELETE FROM shop_status 
      WHERE id > (SELECT MIN(id) FROM shop_status)
    `);
    console.log("Cleanup complete.");
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
cleanup();
