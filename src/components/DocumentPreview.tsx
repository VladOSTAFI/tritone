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

    const pageWidthPx = pageElement.width;
    const pageHeightPx = pageElement.height;

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
    const canvas = page._pageInfo || page;
    if (canvas && 'view' in canvas && canvas.view) {
      const [, , width, height] = canvas.view;
      setPageWidth(width);
      setPageHeight(height);
    }
  };

  return (
    <div className="space-y-4">
      {/* PDF Preview Container */}
      <div
        className={`h-96 border-2 md:h-[600px] ${
          pdfBlobUrl
            ? 'border-solid border-gray-300'
            : 'border-dashed border-gray-300'
        } flex items-center justify-center overflow-auto rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 transition`}
      >
        {isPdfLoading ? (
          <div className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading PDF...</p>
          </div>
        ) : pdfError ? (
          <div className="p-4 text-center">
            <p className="mb-2 text-red-600">Failed to load PDF</p>
            <p className="text-sm text-gray-500">{pdfError}</p>
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
                  <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  <p className="text-gray-600">Rendering PDF...</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
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
            <p className="text-gray-500">Upload a document to preview</p>
          </div>
        )}
      </div>

      {/* Page Navigation */}
      {pdfBlobUrl && numPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onPageNumberChange(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() =>
              onPageNumberChange(Math.min(numPages, pageNumber + 1))
            }
            disabled={pageNumber >= numPages}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
