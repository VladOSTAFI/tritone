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

const CONVERSION_SERVICE_URL =
  process.env.CONVERSION_SERVICE_URL ||
  'https://docx-to-pdf-service-146273646876.europe-west1.run.app/convert';

interface ServiceResponse {
  success: boolean;
  data?: {
    pdf: string; // base64 encoded
    originalFilename: string;
    fileSize: number;
    conversionTimeMs: number;
  };
  error?: string;
  code?: string;
}

/**
 * Converts a DOCX file to PDF using external conversion service
 * @param docxPath - Full path to the DOCX file
 * @param activeDir - Directory where the PDF should be output
 * @returns ConversionResult with success status and PDF path or error message
 */
export async function convertDocxToPdf(
  docxPath: string,
  activeDir: string
): Promise<ConversionResult> {
  try {
    // 1. Read DOCX file into buffer
    const fileBuffer = await fs.readFile(docxPath);
    const filename = path.basename(docxPath);

    // 2. Call external conversion service
    const serviceResponse = await callConversionService(
      fileBuffer,
      filename,
      CONVERSION_TIMEOUT_MS
    );

    // 3. Write PDF directly to preview.pdf
    const outputPath = path.join(activeDir, 'preview.pdf');
    await writeBase64ToPdf(serviceResponse.pdf, outputPath);

    return {
      success: true,
      pdfPath: outputPath,
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
 * Calls the external conversion service with the DOCX file
 * @param fileBuffer - Buffer containing the DOCX file data
 * @param filename - Original filename
 * @param timeoutMs - Timeout in milliseconds
 * @returns Service response data with base64 PDF
 */
async function callConversionService(
  fileBuffer: Buffer,
  filename: string,
  timeoutMs: number
): Promise<NonNullable<ServiceResponse['data']>> {
  // 1. Create FormData
  const formData = new FormData();
  // Convert Buffer to Uint8Array for Blob compatibility
  const uint8Array = new Uint8Array(fileBuffer);
  const blob = new Blob([uint8Array], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  formData.append('file', blob, filename);

  // 2. Setup timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 3. Make HTTP request
    const response = await fetch(CONVERSION_SERVICE_URL, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 4. Parse response
    const result: ServiceResponse = await response.json();

    // 5. Handle errors
    if (!response.ok || !result.success) {
      const errorCode = result.code || 'UNKNOWN_ERROR';
      const errorMessage = parseServiceError(errorCode);
      throw new Error(errorMessage);
    }

    if (!result.data?.pdf) {
      throw new Error('PDF data not found in response');
    }

    return result.data;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle specific error types
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'PDF conversion timed out. The document may be too complex or large.'
      );
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        'Failed to connect to conversion service. Please check your network connection.'
      );
    }

    throw error;
  }
}

/**
 * Maps service error codes to user-friendly error messages
 * @param errorCode - Error code from the conversion service
 * @returns User-friendly error message
 */
function parseServiceError(errorCode: string): string {
  const errorMap: Record<string, string> = {
    MISSING_FILE: 'File upload failed. Please try again.',
    INVALID_FILE_TYPE: 'Invalid document format. Only .docx files are supported.',
    FILE_TOO_LARGE: 'File too large. Maximum size is 15MB.',
    CONVERSION_TIMEOUT:
      'PDF conversion timed out. The document may be too complex or large.',
    CONVERSION_FAILED:
      'PDF conversion failed. The document may be corrupted or incompatible.',
    PROCESS_ERROR: 'PDF conversion process error. Please try again.',
    PDF_NOT_FOUND:
      'PDF file was not created. Conversion may have failed silently.',
  };

  return (
    errorMap[errorCode] ||
    'PDF conversion failed. Please check the document and try again.'
  );
}

/**
 * Writes base64-encoded PDF data to a file
 * @param base64Data - Base64-encoded PDF content
 * @param outputPath - Path where the PDF should be saved
 */
async function writeBase64ToPdf(
  base64Data: string,
  outputPath: string
): Promise<void> {
  try {
    // Decode base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    // Verify it's a valid PDF (check magic bytes)
    if (!pdfBuffer.slice(0, 4).toString('ascii').startsWith('%PDF')) {
      throw new Error('Invalid PDF data received from conversion service');
    }

    // Write to file atomically (temp file + rename)
    const tempPath = outputPath + '.tmp';
    await fs.writeFile(tempPath, pdfBuffer);
    await fs.rename(tempPath, outputPath);
  } catch (error) {
    console.error('Error writing PDF file:', error);
    throw new Error(
      error instanceof Error
        ? `Failed to save PDF: ${error.message}`
        : 'Failed to save converted PDF'
    );
  }
}
