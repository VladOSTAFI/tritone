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
}

export function usePdfPreview({
  documentStatus,
}: UsePdfPreviewProps): UsePdfPreviewReturn {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const currentBlobUrlRef = useRef<string | null>(null);

  // Fetch PDF as blob when document is converted or signed
  useEffect(() => {
    const fetchPdf = async () => {
      if (documentStatus === 'converted' || documentStatus === 'signed') {
        setIsPdfLoading(true);
        setPdfError(null);

        try {
          // Add cache-busting parameter to force reload when signed
          const cacheBuster = documentStatus === 'signed' ? `&t=${Date.now()}` : '';
          const response = await fetch(`/api/download?type=preview${cacheBuster}`);
          if (!response.ok) {
            throw new Error(`Failed to load PDF: ${response.status}`);
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          // Revoke old URL before setting new one
          if (currentBlobUrlRef.current) {
            URL.revokeObjectURL(currentBlobUrlRef.current);
          }

          currentBlobUrlRef.current = url;
          setPdfBlobUrl(url);
        } catch (error) {
          console.error('PDF fetch error:', error);
          setPdfError(
            error instanceof Error ? error.message : 'Failed to load PDF'
          );
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
      }
    };

    fetchPdf();

    // Cleanup: revoke blob URL when component unmounts
    return () => {
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
  };
}
