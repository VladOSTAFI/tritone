/**
 * IN-MEMORY STORAGE MODULE
 *
 * ⚠️ WARNING: FOR MVP USE ONLY
 *
 * This storage implementation keeps metadata in process memory.
 * Limitations:
 * - Data lost on server restart
 * - Not shared across multiple server instances (serverless)
 * - Only suitable for MVP/demo purposes with accepted data loss
 *
 * Benefits:
 * - Instant, synchronous metadata access
 * - No retry/polling logic needed
 * - Eliminates eventual consistency issues
 */

import { put, head, del, list } from '@vercel/blob';
import { DocumentMeta, DEFAULT_META } from './types';

// Blob storage keys (paths) for files
export const META_KEY = 'active/meta.json';
export const DOCX_KEY = 'active/original.docx';
export const PREVIEW_PDF_KEY = 'active/preview.pdf';
export const SIGNED_PDF_KEY = 'active/signed.pdf';

// In-memory metadata storage
let metadataStore: DocumentMeta = { ...DEFAULT_META };

/**
 * Reads document metadata from memory
 * Returns a deep copy to prevent accidental mutations
 * @returns Document metadata
 */
export async function readMeta(): Promise<DocumentMeta> {
  // Return deep copy to prevent external mutations
  return JSON.parse(JSON.stringify(metadataStore));
}

/**
 * Writes document metadata to memory
 * Stores a deep copy to prevent external mutations
 * @param meta - The metadata to write
 * @returns The written metadata
 */
export async function writeMeta(meta: DocumentMeta): Promise<DocumentMeta> {
  // Store deep copy to prevent external mutations
  metadataStore = JSON.parse(JSON.stringify(meta));
  return metadataStore;
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
    // Delete existing blob if it exists
    try {
      const existing = await head(DOCX_KEY);
      await del(existing.url);
    } catch {
      // Blob doesn't exist, that's fine
    }

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
 * @param keyOrUrl - The blob key (e.g., 'active/original.docx') or direct URL
 * @returns Buffer containing the file data
 */
export async function readBlobFile(keyOrUrl: string): Promise<Buffer> {
  try {
    let url: string;

    // If it's a full URL, use it directly; otherwise, look up by key
    if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
      url = keyOrUrl;
    } else {
      // Get blob metadata to get URL
      const blobMeta = await head(keyOrUrl);
      url = blobMeta.url;
    }

    // Fetch the blob content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Failed to read blob file ${keyOrUrl}:`, error);
    throw new Error(`Failed to read file from storage: ${keyOrUrl}`);
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
    // Delete existing blob if it exists
    try {
      const existing = await head(key);
      await del(existing.url);
    } catch {
      // Blob doesn't exist, that's fine
    }

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
 * Clears all files in active directory and resets metadata
 */
export async function clearActiveDocument(): Promise<void> {
  try {
    // List all blobs with 'active/' prefix
    const { blobs } = await list({ prefix: 'active/' });

    // Delete all blobs in the active directory
    await Promise.all(blobs.map((blob) => del(blob.url).catch(() => {})));

    // Reset in-memory metadata
    metadataStore = { ...DEFAULT_META };
  } catch (error) {
    console.error('Failed to clear active document:', error);
    throw new Error('Failed to clear document');
  }
}
