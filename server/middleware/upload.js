import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Use memory storage — files are buffered then uploaded to Backblaze B2
const memStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

export const uploadDocument = multer({
  storage: memStorage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

export const uploadAvatar = multer({
  storage: memStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed for avatars'), false);
    }
  },
  limits: { fileSize: parseInt(process.env.MAX_AVATAR_SIZE) || 2 * 1024 * 1024 },
});

/**
 * Generate a B2 storage key for a file
 * @param {string} userId - The user's UUID
 * @param {string} category - 'documents', 'print-jobs', 'avatars', 'tickets'
 * @param {string} originalName - Original filename
 * @returns {string} B2 object key
 */
export const generateStorageKey = (userId, category, originalName) => {
  const ext = path.extname(originalName);
  const uniqueId = uuidv4();
  return `users/${userId}/${category}/${uniqueId}${ext}`;
};
