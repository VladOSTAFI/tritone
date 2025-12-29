import fs from 'fs/promises';
import path from 'path';
import { DocumentMeta, DEFAULT_META } from './types';

// Get absolute path to data directory (relative to project root)
export const DATA_DIR = path.join(process.cwd(), 'data');
export const ACTIVE_DIR = path.join(DATA_DIR, 'active');
export const META_PATH = path.join(ACTIVE_DIR, 'meta.json');
export const DOCX_PATH = path.join(ACTIVE_DIR, 'original.docx');
export const PREVIEW_PDF_PATH = path.join(ACTIVE_DIR, 'preview.pdf');
export const SIGNED_PDF_PATH = path.join(ACTIVE_DIR, 'signed.pdf');

/**
 * Ensures the active directory exists
 */
export async function ensureActiveDir(): Promise<void> {
  try {
    await fs.mkdir(ACTIVE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create active directory:', error);
    throw new Error('Failed to initialize storage directory');
  }
}

/**
 * Reads meta.json, returns default if doesn't exist
 */
export async function readMeta(): Promise<DocumentMeta> {
  try {
    const content = await fs.readFile(META_PATH, 'utf-8');
    return JSON.parse(content) as DocumentMeta;
  } catch (error) {
    // If file doesn't exist, return default
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_META;
    }
    console.error('Failed to read meta.json:', error);
    throw new Error('Failed to read document metadata');
  }
}

/**
 * Writes meta.json atomically
 */
export async function writeMeta(meta: DocumentMeta): Promise<void> {
  try {
    await ensureActiveDir();
    const content = JSON.stringify(meta, null, 2);

    // Write to temp file first, then rename (atomic operation)
    const tempPath = META_PATH + '.tmp';
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, META_PATH);
  } catch (error) {
    console.error('Failed to write meta.json:', error);
    throw new Error('Failed to save document metadata');
  }
}

/**
 * Saves the uploaded DOCX file
 * Overwrites existing file (only one active document)
 */
export async function saveOriginalDocx(fileBuffer: Buffer, originalName: string): Promise<string> {
  try {
    await ensureActiveDir();

    // Write to temp file first
    const tempPath = path.join(ACTIVE_DIR, `temp-${Date.now()}.docx`);
    await fs.writeFile(tempPath, fileBuffer);

    // Verify file was written correctly
    const stats = await fs.stat(tempPath);
    if (stats.size !== fileBuffer.length) {
      await fs.unlink(tempPath).catch(() => {});
      throw new Error('File write verification failed');
    }

    // Move to final location (atomic, overwrites existing)
    await fs.rename(tempPath, DOCX_PATH);

    return DOCX_PATH;
  } catch (error) {
    console.error('Failed to save DOCX file:', error);
    throw new Error('Failed to save uploaded document');
  }
}

/**
 * Clears all files in active directory and resets meta
 */
export async function clearActiveDocument(): Promise<void> {
  try {
    // Remove files
    const files = ['original.docx', 'preview.pdf', 'signed.pdf'];
    await Promise.all(
      files.map(file =>
        fs.unlink(path.join(ACTIVE_DIR, file)).catch(() => {})
      )
    );

    // Reset meta
    await writeMeta(DEFAULT_META);
  } catch (error) {
    console.error('Failed to clear active document:', error);
    throw new Error('Failed to clear document');
  }
}
