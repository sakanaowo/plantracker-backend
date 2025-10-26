/**
 * Attachment file upload limits
 * Based on Supabase Free Tier constraints
 */
export const ATTACHMENT_LIMITS = {
  /**
   * Maximum file size: 10 MB (conservative limit)
   * Supabase free tier supports up to 50MB per file,
   * but we set lower limit for better UX and bandwidth usage
   */
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB in bytes

  /**
   * Allowed MIME types for attachments
   */
  ALLOWED_TYPES: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    // Documents
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

    // Text files
    'text/plain',
    'text/csv',
    'text/markdown',

    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',

    // Other
    'application/json',
  ],

  /**
   * Maximum number of attachments per task
   */
  MAX_FILES_PER_TASK: 20,

  /**
   * File extensions mapping (for validation)
   */
  EXTENSIONS: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/svg+xml': ['.svg'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      '.docx',
    ],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
      '.xlsx',
    ],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'text/markdown': ['.md'],
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    'application/x-7z-compressed': ['.7z'],
    'application/json': ['.json'],
  } as Record<string, string[]>,
};

/**
 * Supabase Free Tier Limits (for reference)
 */
export const SUPABASE_FREE_TIER = {
  STORAGE_TOTAL: 1 * 1024 * 1024 * 1024, // 1 GB
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
  BANDWIDTH_MONTHLY: 2 * 1024 * 1024 * 1024, // 2 GB/month
  DATABASE_SIZE: 500 * 1024 * 1024, // 500 MB
};

/**
 * Helper function to format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Helper function to validate file type
 */
export function isAllowedFileType(mimeType: string): boolean {
  return ATTACHMENT_LIMITS.ALLOWED_TYPES.includes(mimeType);
}

/**
 * Helper function to validate file size
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= ATTACHMENT_LIMITS.MAX_FILE_SIZE;
}
