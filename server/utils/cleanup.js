import cron from 'node-cron';
import { query } from '../config/db.js';
import { deleteFromB2 } from '../config/storage.js';

export const startCleanupCron = () => {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running document cleanup...');
    try {
      // Find expired documents
      const result = await query(
        `SELECT * FROM documents WHERE auto_delete_at <= NOW()`
      );

      // Delete each file from Backblaze B2
      for (const doc of result.rows) {
        await deleteFromB2(doc.file_path);
      }

      // Delete from DB
      const deleted = await query(
        `DELETE FROM documents WHERE auto_delete_at <= NOW() RETURNING id`
      );

      console.log(`🧹 Cleaned up ${deleted.rowCount} expired documents from B2`);
    } catch (err) {
      console.error('Document cleanup error:', err);
    }
  });

  console.log('📅 Document cleanup cron scheduled (daily at 2:00 AM)');
};
