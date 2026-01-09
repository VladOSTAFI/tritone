import { put, head, del, list } from '@vercel/blob';
import { DocumentMeta, DEFAULT_META } from './types';

// Blob storage keys (paths)
export const META_KEY = 'active/meta.json';
export const DOCX_KEY = 'active/original.docx';
export const PREVIEW_PDF_KEY = 'active/preview.pdf';
export const SIGNED_PDF_KEY = 'active/signed.pdf';

/**
 * Reads meta.json from blob storage with retry logic to handle eventual consistency
 * @param options - Optional configuration for retry behavior
 * @param options.maxRetries - Maximum number of retry attempts (default: 5)
 * @param options.initialDelayMs - Initial delay between retries in milliseconds (default: 100)
 * @param options.maxDelayMs - Maximum delay between retries in milliseconds (default: 2000)
 * @param options.expectedContent - If provided, will retry until content matches this value
 * @returns Document metadata or default if doesn't exist
 */
export async function readMeta(options?: {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  expectedContent?: string;
}): Promise<DocumentMeta> {
  const {
    maxRetries = 5,
    initialDelayMs = 100,
    maxDelayMs = 2000,
    expectedContent,
  } = options || {};

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const metaBlob = await head(META_KEY);

      // Add cache-busting query parameter to avoid CDN/browser caching
      const url = new URL(metaBlob.url);
      url.searchParams.set('t', Date.now().toString());

      const response = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();

      // If we're verifying specific content and it doesn't match, retry
      if (expectedContent && content !== expectedContent) {
        if (attempt < maxRetries) {
          const delay = Math.min(
            initialDelayMs * Math.pow(2, attempt),
            maxDelayMs
          );
          console.log(
            `Content mismatch on attempt ${attempt + 1}, retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        // On final attempt, log warning but return what we got
        console.warn(
          'Content verification failed after all retries, returning latest content'
        );
      }

      return JSON.parse(content) as DocumentMeta;
    } catch (error) {
      lastError = error;

      // If it's a "not found" error on the last attempt, return default
      if (attempt === maxRetries) {
        console.log(
          'Meta not found or error reading after retries, returning default:',
          error
        );
        return DEFAULT_META;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
      const totalDelay = delay + jitter;

      console.log(
        `Read attempt ${attempt + 1} failed, retrying in ${Math.round(totalDelay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  // Fallback (should not reach here, but TypeScript needs it)
  console.error('Unexpected: exhausted all retries, returning default meta');
  return DEFAULT_META;
}

/**
 * Writes meta.json to blob storage with verification
 * Returns the written metadata to eliminate need for immediate readMeta() calls
 * @param meta - The metadata to write
 * @param options - Optional configuration
 * @param options.verify - Whether to verify the write succeeded (default: true)
 * @param options.maxVerifyRetries - Maximum verification attempts (default: 3)
 * @returns The written metadata
 */
export async function writeMeta(
  meta: DocumentMeta,
  options?: {
    verify?: boolean;
    maxVerifyRetries?: number;
  }
): Promise<DocumentMeta> {
  const { verify = true, maxVerifyRetries = 3 } = options || {};

  try {
    const content = JSON.stringify(meta, null, 2);

    // Delete existing blob if it exists
    try {
      const existing = await head(META_KEY);
      await del(existing.url);
    } catch {
      // Blob doesn't exist, that's fine
    }

    // Upload to blob storage
    await put(META_KEY, content, {
      access: 'public',
      contentType: 'application/json',
    });

    // Verify the write succeeded by reading back and comparing
    if (verify) {
      try {
        const verified = await readMeta({
          maxRetries: maxVerifyRetries,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          expectedContent: content,
        });

        // Double-check the parsed content matches
        const verifiedContent = JSON.stringify(verified, null, 2);
        if (verifiedContent !== content) {
          console.warn(
            'Write verification warning: content mismatch after retries'
          );
          // Still return the written data since we wrote it successfully
        }
      } catch (verifyError) {
        console.warn('Write verification failed:', verifyError);
        // Don't throw - the write succeeded, verification just failed
      }
    }

    // Return the written data for immediate use
    return meta;
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
