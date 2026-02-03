'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { TemporarySignature } from '@/lib/types';
import { SignatureImageOverlay } from './SignatureImageOverlay';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentPreviewProps {
  pdfBlobUrl: string | null;
  isPdfLoading: boolean;
  pdfError: string | null;
  temporarySignature: TemporarySignature | null;
  pageNumber: number;
  numPages: number;
  onPageNumberChange: (page: number) => void;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: (error: Error) => void;
  onDocumentClick: (coords: {
    xN: number;
    yN: number;
    pageWidth: number;
    pageHeight: number;
    page: number;
  }) => void;
  onSignatureUpdate: (signature: TemporarySignature) => void;
  retryAttempt?: number;
  maxRetries?: number;
}

export function DocumentPreview({
  pdfBlobUrl,
  isPdfLoading,
  pdfError,
  temporarySignature,
  pageNumber,
  numPages,
  onPageNumberChange,
  onLoadSuccess,
  onLoadError,
  onDocumentClick,
  onSignatureUpdate,
  retryAttempt = 0,
  maxRetries = 10,
}: DocumentPreviewProps) {
  // PDF page dimensions for overlay rendering
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);

  // Resize state
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    signature: TemporarySignature;
  } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    signature: TemporarySignature;
  } | null>(null);

  // Local temporary signature state for real-time updates
  const [localTemporarySignature, setLocalTemporarySignature] =
    useState<TemporarySignature | null>(temporarySignature);

  // Sync local state with prop
  useEffect(() => {
    setLocalTemporarySignature(temporarySignature);
  }, [temporarySignature]);

  // Update dimensions on window resize to maintain correct positioning
  useEffect(() => {
    const updateDimensions = () => {
      const canvasElement = document.querySelector(
        '.react-pdf__Page__canvas'
      ) as HTMLCanvasElement;
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        setPageWidth(canvasRect.width);
        setPageHeight(canvasRect.height);
      }
    };

    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [pageNumber]);

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't open modal if resizing or dragging
    if (isResizing || isDragging) return;

    // Don't open modal if signature already exists
    if (localTemporarySignature) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    // Get rendered page canvas to extract dimensions
    const pageElement = e.currentTarget.querySelector(
      '.react-pdf__Page__canvas'
    ) as HTMLCanvasElement;
    if (!pageElement) return;

    // Use displayed dimensions (what user sees) instead of canvas internal resolution
    const canvasRect = pageElement.getBoundingClientRect();
    const pageWidthPx = canvasRect.width;
    const pageHeightPx = canvasRect.height;

    // Calculate normalized coordinates (0-1)
    const xN = xPx / pageWidthPx;
    const yN = yPx / pageHeightPx;

    setPageWidth(pageWidthPx);
    setPageHeight(pageHeightPx);

    // Notify parent with click coordinates
    onDocumentClick({
      xN,
      yN,
      pageWidth: pageWidthPx,
      pageHeight: pageHeightPx,
      page: pageNumber,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (!localTemporarySignature) return;

    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      signature: { ...localTemporarySignature },
    });
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!localTemporarySignature) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      signature: { ...localTemporarySignature },
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle resize
    if (isResizing && resizeStart && localTemporarySignature && resizeHandle) {
      const deltaXPx = e.clientX - resizeStart.x;
      const deltaYPx = e.clientY - resizeStart.y;

      // Convert pixel deltas to normalized deltas
      const deltaXN = deltaXPx / pageWidth;
      const deltaYN = deltaYPx / pageHeight;

      const newPosition = { ...resizeStart.signature.position };

      // Handle different resize corners
      switch (resizeHandle) {
        case 'top-left':
          newPosition.xN = resizeStart.signature.position.xN + deltaXN;
          newPosition.yN = resizeStart.signature.position.yN + deltaYN;
          newPosition.wN = resizeStart.signature.position.wN - deltaXN;
          newPosition.hN = resizeStart.signature.position.hN - deltaYN;
          break;
        case 'top-right':
          newPosition.yN = resizeStart.signature.position.yN + deltaYN;
          newPosition.wN = resizeStart.signature.position.wN + deltaXN;
          newPosition.hN = resizeStart.signature.position.hN - deltaYN;
          break;
        case 'bottom-left':
          newPosition.xN = resizeStart.signature.position.xN + deltaXN;
          newPosition.wN = resizeStart.signature.position.wN - deltaXN;
          newPosition.hN = resizeStart.signature.position.hN + deltaYN;
          break;
        case 'bottom-right':
          newPosition.wN = resizeStart.signature.position.wN + deltaXN;
          newPosition.hN = resizeStart.signature.position.hN + deltaYN;
          break;
      }

      // Enforce minimum size (5% of page dimensions)
      const minSize = 0.05;
      if (newPosition.wN < minSize) newPosition.wN = minSize;
      if (newPosition.hN < minSize) newPosition.hN = minSize;

      // Enforce boundaries (keep within page)
      if (newPosition.xN - newPosition.wN / 2 < 0)
        newPosition.xN = newPosition.wN / 2;
      if (newPosition.xN + newPosition.wN / 2 > 1)
        newPosition.xN = 1 - newPosition.wN / 2;
      if (newPosition.yN - newPosition.hN / 2 < 0)
        newPosition.yN = newPosition.hN / 2;
      if (newPosition.yN + newPosition.hN / 2 > 1)
        newPosition.yN = 1 - newPosition.hN / 2;

      setLocalTemporarySignature({
        ...localTemporarySignature,
        position: newPosition,
      });
    }

    // Handle drag
    if (isDragging && dragStart && localTemporarySignature) {
      const deltaXPx = e.clientX - dragStart.x;
      const deltaYPx = e.clientY - dragStart.y;

      // Convert to normalized coordinates
      const deltaXN = deltaXPx / pageWidth;
      const deltaYN = deltaYPx / pageHeight;

      // Calculate new center position
      let newXN = dragStart.signature.position.xN + deltaXN;
      let newYN = dragStart.signature.position.yN + deltaYN;

      // Enforce boundaries - keep entire field within page
      const halfW = localTemporarySignature.position.wN / 2;
      const halfH = localTemporarySignature.position.hN / 2;

      if (newXN - halfW < 0) newXN = halfW;
      if (newXN + halfW > 1) newXN = 1 - halfW;
      if (newYN - halfH < 0) newYN = halfH;
      if (newYN + halfH > 1) newYN = 1 - halfH;

      setLocalTemporarySignature({
        ...localTemporarySignature,
        position: {
          ...localTemporarySignature.position,
          xN: newXN,
          yN: newYN,
        },
      });
    }
  };

  const handleMouseUp = () => {
    // Handle resize end
    if (isResizing && localTemporarySignature) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
      onSignatureUpdate(localTemporarySignature);
    }

    // Handle drag end
    if (isDragging && localTemporarySignature) {
      setIsDragging(false);
      setDragStart(null);
      onSignatureUpdate(localTemporarySignature);
    }
  };

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    onLoadSuccess(numPages);
  };

  const handlePageLoadSuccess = (page: {
    _pageInfo?: { view?: number[] };
    view?: number[];
  }) => {
    // Use requestAnimationFrame to ensure canvas is fully rendered
    requestAnimationFrame(() => {
      const canvasElement = document.querySelector(
        '.react-pdf__Page__canvas'
      ) as HTMLCanvasElement;
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        setPageWidth(canvasRect.width);
        setPageHeight(canvasRect.height);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* PDF Preview Container */}
      <div
        className={`h-96 md:h-[600px] flex items-center justify-center overflow-auto rounded-xl shadow-inner transition-all ${
          pdfBlobUrl
            ? 'border-2 border-gray-300 bg-gray-50'
            : 'border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100'
        }`}
      >
        {isPdfLoading ? (
          <div className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
            <p className="font-medium text-gray-700">Loading PDF...</p>
            {retryAttempt > 0 && (
              <p className="mt-2 text-sm text-blue-600">
                Retrying... (Attempt {retryAttempt} of {maxRetries})
              </p>
            )}
          </div>
        ) : pdfError ? (
          <div className="max-w-md p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mb-2 font-semibold text-red-600">Failed to load PDF</p>
            <p className="text-sm text-gray-600">{pdfError}</p>
          </div>
        ) : pdfBlobUrl ? (
          <div
            onClick={handlePreviewClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative cursor-pointer"
          >
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={(error) => onLoadError(error)}
              loading={
                <div className="text-center">
                  <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                  <p className="font-medium text-gray-700">Rendering PDF...</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-xl"
                onLoadSuccess={handlePageLoadSuccess}
              />
            </Document>

            {/* Signature image overlay */}
            {localTemporarySignature && (
              <SignatureImageOverlay
                signature={localTemporarySignature}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                pageNumber={pageNumber}
                isDragging={isDragging}
                onDragStart={handleDragStart}
                onResizeStart={handleResizeStart}
              />
            )}
          </div>
        ) : (
          <div className="text-center">
            <svg className="mx-auto mb-3 h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="font-medium text-gray-500">Upload a document to preview</p>
          </div>
        )}
      </div>

      {/* Page Navigation */}
      {pdfBlobUrl && numPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onPageNumberChange(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            Previous
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium text-gray-700">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() =>
              onPageNumberChange(Math.min(numPages, pageNumber + 1))
            }
            disabled={pageNumber >= numPages}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
