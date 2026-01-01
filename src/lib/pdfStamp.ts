import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import type { SignatureField } from './types';

/**
 * Stamps a signature image onto a PDF at the specified field location
 *
 * @param inputPdfPath - Path to the source PDF (preview.pdf)
 * @param outputPdfPath - Path where signed PDF will be saved (signed.pdf)
 * @param signatureDataUrl - Data URL of signature image (PNG format)
 * @param field - Signature field with normalized coordinates
 */
export async function stampSignatureOnPdf(
  inputPdfPath: string,
  outputPdfPath: string,
  signatureDataUrl: string,
  field: SignatureField
): Promise<void> {
  try {
    // Load the existing PDF
    const existingPdfBytes = await fs.readFile(inputPdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get the target page (1-indexed to 0-indexed)
    const pages = pdfDoc.getPages();
    const pageIndex = field.page - 1;

    if (pageIndex < 0 || pageIndex >= pages.length) {
      throw new Error(`Invalid page number: ${field.page}. PDF has ${pages.length} pages.`);
    }

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert normalized coordinates to PDF points
    // PDF coordinate system: origin at bottom-left
    const wPt = field.wN * pageWidth;
    const hPt = field.hN * pageHeight;
    const xPt = field.xN * pageWidth;
    // Flip Y-axis: PDF uses bottom-left origin, browser uses top-left
    const yPt = (1 - field.yN) * pageHeight;

    // Calculate position to center the signature in the field
    const drawX = xPt - wPt / 2;
    const drawY = yPt - hPt / 2;

    // Embed the signature image
    const signatureImage = await embedSignatureImage(pdfDoc, signatureDataUrl);

    // Draw the signature on the page
    page.drawImage(signatureImage, {
      x: drawX,
      y: drawY,
      width: wPt,
      height: hPt,
    });

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPdfPath, pdfBytes);
  } catch (error) {
    console.error('Error stamping signature on PDF:', error);
    throw new Error(
      error instanceof Error ? `PDF stamping failed: ${error.message}` : 'Failed to stamp signature on PDF'
    );
  }
}

/**
 * Embeds a signature image from a data URL into a PDF document
 *
 * @param pdfDoc - The PDF document to embed the image into
 * @param dataUrl - Data URL of the signature image
 * @returns The embedded image object
 */
async function embedSignatureImage(pdfDoc: PDFDocument, dataUrl: string): Promise<any> {
  try {
    // Extract base64 data from data URL
    // Format: data:image/png;base64,iVBORw0KG...
    const base64Data = dataUrl.split(',')[1];

    if (!base64Data) {
      throw new Error('Invalid data URL format');
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Embed PNG image
    // pdf-lib supports PNG and JPG
    const image = await pdfDoc.embedPng(imageBuffer);

    return image;
  } catch (error) {
    console.error('Error embedding signature image:', error);
    throw new Error(
      error instanceof Error ? `Failed to embed signature image: ${error.message}` : 'Failed to embed signature image'
    );
  }
}
