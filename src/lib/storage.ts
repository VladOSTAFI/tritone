import { put, head, del, list } from '@vercel/blob';
import { DocumentMeta, DEFAULT_META } from './types';

// Blob storage keys (paths)
export const META_KEY = 'active/meta.json';
export const DOCX_KEY = 'active/original.docx';
export const PREVIEW_PDF_KEY = 'active/preview.pdf';
export const SIGNED_PDF_KEY = 'active/signed.pdf';

// For backward compatibility with existing code
export const ACTIVE_DIR = 'active';
export const META_PATH = META_KEY;
export const DOCX_PATH = DOCX_KEY;
export const PREVIEW_PDF_PATH = PREVIEW_PDF_KEY;
export const SIGNED_PDF_PATH = SIGNED_PDF_KEY;

/**
 * Ensures the active directory exists (no-op for blob storage)
 * Kept for backward compatibility
 */
export async function ensureActiveDir(): Promise<void> {
  // No-op for blob storage - blobs are automatically stored
  return Promise.resolve();
}

/**
 * Reads meta.json from blob storage, returns default if doesn't exist
 */
export async function readMeta(): Promise<DocumentMeta> {
  try {
    // Check if meta blob exists
    const metaBlob = await head(META_KEY);

    // Fetch and parse the meta.json content
    const response = await fetch(metaBlob.url);
    const content = await response.text();
    return JSON.parse(content) as DocumentMeta;
  } catch (error) {
    // If blob doesn't exist or any error occurs, return default
    console.log('Meta not found or error reading, returning default:', error);
    return DEFAULT_META;
  }
}

/**
 * Writes meta.json to blob storage
 */
export async function writeMeta(meta: DocumentMeta): Promise<void> {
  try {
    const content = JSON.stringify(meta, null, 2);

    // Upload to blob storage (overwrites if exists)
    await put(META_KEY, content, {
      access: 'public',
      contentType: 'application/json',
    });
  } catch (error) {
    console.error('Failed to write meta.json:', error);
    throw new Error('Failed to save document metadata');
  }
}

/**
 * Saves the uploaded DOCX file to blob storage
 * Overwrites existing file (only one active document)
 * @returns Blob URL (used as identifier instead of file path)
 */
export async function saveOriginalDocx(
  fileBuffer: Buffer,
  _originalName: string
): Promise<string> {
  try {
    // Upload DOCX to blob storage
    const blob = await put(DOCX_KEY, fileBuffer, {
      access: 'public',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Return the blob URL as the "path"
    return blob.url;
  } catch (error) {
    console.error('Failed to save DOCX file:', error);
    throw new Error('Failed to save uploaded document');
  }
}

/**
 * Reads a file from blob storage
 * @param key - The blob key (e.g., 'active/original.docx')
 * @returns Buffer containing the file data
 */
export async function readBlobFile(key: string): Promise<Buffer> {
  try {
    // Get blob metadata to get URL
    const blobMeta = await head(key);

    // Fetch the blob content
    const response = await fetch(blobMeta.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Failed to read blob file ${key}:`, error);
    throw new Error(`Failed to read file from storage: ${key}`);
  }
}

/**
 * Writes a file to blob storage
 * @param key - The blob key (e.g., 'active/preview.pdf')
 * @param data - Buffer or string to write
 * @param contentType - MIME type of the file
 * @returns Blob URL of the uploaded file
 */
export async function writeBlobFile(
  key: string,
  data: Buffer | string,
  contentType: string
): Promise<string> {
  try {
    const blob = await put(key, data, {
      access: 'public',
      contentType,
    });

    return blob.url;
  } catch (error) {
    console.error(`Failed to write blob file ${key}:`, error);
    throw new Error(`Failed to write file to storage: ${key}`);
  }
}

/**
 * Gets the URL for a blob file
 * @param key - The blob key (e.g., 'active/preview.pdf')
 * @returns Blob URL or null if doesn't exist
 */
export async function getBlobUrl(key: string): Promise<string | null> {
  try {
    const blobMeta = await head(key);
    return blobMeta.url;
  } catch {
    // Blob doesn't exist
    return null;
  }
}

/**
 * Checks if a blob exists
 * @param key - The blob key
 * @returns true if blob exists, false otherwise
 */
export async function blobExists(key: string): Promise<boolean> {
  try {
    await head(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all files in active directory and resets meta
 */
export async function clearActiveDocument(): Promise<void> {
  try {
    // List all blobs with 'active/' prefix
    const { blobs } = await list({ prefix: 'active/' });

    // Delete all blobs in the active directory
    await Promise.all(blobs.map((blob) => del(blob.url).catch(() => {})));

    // Reset meta (will create a new meta.json blob)
    await writeMeta(DEFAULT_META);
  } catch (error) {
    console.error('Failed to clear active document:', error);
    throw new Error('Failed to clear document');
  }
}
