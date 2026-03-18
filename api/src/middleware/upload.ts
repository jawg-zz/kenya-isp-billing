import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeTypeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const extensionAllowed = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeTypeAllowed && extensionAllowed) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files per request
  },
  fileFilter,
});

export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS };
