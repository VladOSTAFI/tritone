'use client';

import { useState, useEffect, useRef } from 'react';
import type { DocumentStatus } from '@/lib/types';

interface UsePdfPreviewProps {
  documentStatus: DocumentStatus | null;
}

interface UsePdfPreviewReturn {
  pdfBlobUrl: string | null;
  isPdfLoading: boolean;
  pdfError: string | null;
  numPages: number;
  pageNumber: number;
  setPageNumber: (page: number) => void;
  handleLoadSuccess: (numPages: number) => void;
  handleLoadError: (error: Error) => void;
  retryAttempt: number;
  maxRetries: number;
}

/**
 * Utility function to wait for a specified duration
 */
const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch PDF with retry mechanism and exponential backoff
 * @param type - The type of PDF to fetch ('preview' or 'signed')
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @param onRetry - Callback for retry attempts
 * @returns Blob of the PDF
 */
async function fetchPdfWithRetry(
  type: 'preview' | 'signed',
  maxRetries: number = 5,
  onRetry?: (attempt: number, delay: number) => void
): Promise<Blob> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`/api/download?type=${type}`);

      if (!response.ok) {
        throw new Error(`Failed to load PDF: ${response.status}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Failed to load PDF');

      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delayMs = Math.pow(2, attempt - 1) * 1000;

        console.log(
          `PDF fetch attempt ${attempt} failed. Retrying in ${delayMs / 1000}s...`,
          error
        );

        if (onRetry) {
          onRetry(attempt, delayMs);
        }

        await delay(delayMs);
      }
    }
  }

  // If all retries failed, throw the last error
  throw lastError || new Error('Failed to load PDF after multiple attempts');
}

export function usePdfPreview({
  documentStatus,
}: UsePdfPreviewProps): UsePdfPreviewReturn {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const currentBlobUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const maxRetries = 10;

  // Fetch PDF as blob when document is converted or signed
  useEffect(() => {
    const fetchPdf = async () => {
      if (documentStatus === 'converted' || documentStatus === 'signed') {
        // Cancel any ongoing fetch
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        setIsPdfLoading(true);
        setPdfError(null);
        setRetryAttempt(0);

        try {
          // Fetch the appropriate PDF (signed if available, otherwise preview)
          const type = documentStatus === 'signed' ? 'signed' : 'preview';

          const blob = await fetchPdfWithRetry(
            type,
            maxRetries,
            (attempt, delayMs) => {
              setRetryAttempt(attempt);
            }
          );

          // Check if this fetch was aborted
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          const url = URL.createObjectURL(blob);

          // Revoke old URL before setting new one
          if (currentBlobUrlRef.current) {
            URL.revokeObjectURL(currentBlobUrlRef.current);
          }

          currentBlobUrlRef.current = url;
          setPdfBlobUrl(url);
          setRetryAttempt(0); // Reset retry count on success
        } catch (error) {
          // Check if this fetch was aborted
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          console.error('PDF fetch error:', error);
          setPdfError(
            error instanceof Error ? error.message : 'Failed to load PDF'
          );
          setRetryAttempt(0); // Reset retry count on final failure
        } finally {
          setIsPdfLoading(false);
        }
      } else {
        // Reset PDF state if document status changes to non-converted
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
          setPdfBlobUrl(null);
        }
        setPdfError(null);
        setPageNumber(1);
        setNumPages(0);
        setRetryAttempt(0);
      }
    };

    fetchPdf();

    // Cleanup: revoke blob URL and abort fetch when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, [documentStatus]);

  const handleLoadSuccess = (pages: number) => {
    setNumPages(pages);
  };

  const handleLoadError = (error: Error) => {
    setPdfError(error.message);
  };

  return {
    pdfBlobUrl,
    isPdfLoading,
    pdfError,
    numPages,
    pageNumber,
    setPageNumber,
    handleLoadSuccess,
    handleLoadError,
    retryAttempt,
    maxRetries,
  };
}
