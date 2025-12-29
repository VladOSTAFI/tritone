import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface ConversionResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
}

const CONVERSION_TIMEOUT_MS = parseInt(
  process.env.PDF_CONVERSION_TIMEOUT_MS || '60000'
);

/**
 * Converts a DOCX file to PDF using LibreOffice headless
 * @param docxPath - Full path to the DOCX file
 * @param activeDir - Directory where the PDF should be output
 * @returns ConversionResult with success status and PDF path or error message
 */
export async function convertDocxToPdf(
  docxPath: string,
  activeDir: string
): Promise<ConversionResult> {
  try {
    // Execute LibreOffice conversion
    await executeLibreOfficeCommand(docxPath, activeDir, CONVERSION_TIMEOUT_MS);

    // Check if output file was created (LibreOffice names it original.pdf)
    const outputPath = path.join(activeDir, 'original.pdf');
    const previewPath = path.join(activeDir, 'preview.pdf');

    try {
      await fs.access(outputPath);
    } catch {
      return {
        success: false,
        error: 'PDF file was not created. Conversion may have failed silently.',
      };
    }

    // Rename to preview.pdf for clarity
    await fs.rename(outputPath, previewPath);

    return {
      success: true,
      pdfPath: previewPath,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: 'Unknown conversion error',
    };
  }
}

/**
 * Executes LibreOffice command with timeout
 * @param docxPath - Full path to the DOCX file
 * @param outDir - Output directory for the PDF
 * @param timeoutMs - Timeout in milliseconds
 */
function executeLibreOfficeCommand(
  docxPath: string,
  outDir: string,
  timeoutMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      docxPath,
    ];

    const process = spawn('libreoffice', args);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timeout = setTimeout(() => {
      timedOut = true;
      process.kill('SIGTERM');

      // Force kill if it doesn't respond to SIGTERM
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    }, timeoutMs);

    // Collect stdout
    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process exit
    process.on('close', (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        reject(
          new Error(
            'PDF conversion timed out. The document may be too complex or large.'
          )
        );
        return;
      }

      if (code === 0) {
        resolve();
      } else {
        // Parse error message from stderr
        const errorMessage = parseLibreOfficeError(stderr, stdout);
        reject(new Error(errorMessage));
      }
    });

    // Handle spawn errors (e.g., LibreOffice not found)
    process.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);

      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'LibreOffice not found. Please ensure LibreOffice is installed and in PATH.'
          )
        );
      } else {
        reject(new Error(`Failed to start LibreOffice: ${err.message}`));
      }
    });
  });
}

/**
 * Parses LibreOffice error output to provide meaningful error messages
 */
function parseLibreOfficeError(stderr: string, stdout: string): string {
  const combined = stderr + stdout;

  // Check for common error patterns
  if (combined.includes('Permission denied')) {
    return 'Permission denied. Unable to write PDF file.';
  }

  if (combined.includes('format')) {
    return 'Invalid document format. The file may be corrupted.';
  }

  if (combined.includes('Error')) {
    // Try to extract the specific error message
    const errorMatch = combined.match(/Error:?\s*(.+?)(?:\n|$)/i);
    if (errorMatch && errorMatch[1]) {
      return `LibreOffice error: ${errorMatch[1].trim()}`;
    }
  }

  // Default error message
  if (stderr.trim()) {
    return `PDF conversion failed: ${stderr.trim().split('\n')[0]}`;
  }

  return 'PDF conversion failed. Please check the document and try again.';
}
