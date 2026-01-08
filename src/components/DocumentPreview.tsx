'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import type { SignatureField as SignatureFieldType } from '@/lib/types';
import { SignatureField } from './SignatureField';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentPreviewProps {
  pdfBlobUrl: string | null;
  isPdfLoading: boolean;
  pdfError: string | null;
  signatureField: SignatureFieldType | null;
  pageNumber: number;
  numPages: number;
  onPageNumberChange: (page: number) => void;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: (error: Error) => void;
  onSignatureFieldPlace: (field: SignatureFieldType) => void;
  onSignatureFieldUpdate: (field: SignatureFieldType) => void;
  canPlaceSignature: boolean;
}

export function DocumentPreview({
  pdfBlobUrl,
  isPdfLoading,
  pdfError,
  signatureField,
  pageNumber,
  numPages,
  onPageNumberChange,
  onLoadSuccess,
  onLoadError,
  onSignatureFieldPlace,
  onSignatureFieldUpdate,
  canPlaceSignature,
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
    field: SignatureFieldType;
  } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    field: SignatureFieldType;
  } | null>(null);

  // Local signature field state for real-time updates
  const [localSignatureField, setLocalSignatureField] =
    useState<SignatureFieldType | null>(signatureField);

  // Sync local state with prop
  useEffect(() => {
    setLocalSignatureField(signatureField);
  }, [signatureField]);

  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't place new field if resizing or dragging
    if (isResizing || isDragging) return;

    // Only allow placement when allowed by parent
    if (!canPlaceSignature) return;

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

    // Fixed signature field size
    const wN = 0.28;
    const hN = 0.1;

    const newField: SignatureFieldType = { page: pageNumber, xN, yN, wN, hN };

    setPageWidth(pageWidthPx);
    setPageHeight(pageHeightPx);
    setLocalSignatureField(newField);
    onSignatureFieldPlace(newField);
  };

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (!localSignatureField) return;

    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      field: { ...localSignatureField },
    });
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!localSignatureField) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      field: { ...localSignatureField },
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle resize
    if (isResizing && resizeStart && localSignatureField && resizeHandle) {
      const deltaXPx = e.clientX - resizeStart.x;
      const deltaYPx = e.clientY - resizeStart.y;

      // Convert pixel deltas to normalized deltas
      const deltaXN = deltaXPx / pageWidth;
      const deltaYN = deltaYPx / pageHeight;

      const newField = { ...resizeStart.field };

      // Handle different resize corners
      switch (resizeHandle) {
        case 'top-left':
          newField.xN = resizeStart.field.xN + deltaXN;
          newField.yN = resizeStart.field.yN + deltaYN;
          newField.wN = resizeStart.field.wN - deltaXN;
          newField.hN = resizeStart.field.hN - deltaYN;
          break;
        case 'top-right':
          newField.yN = resizeStart.field.yN + deltaYN;
          newField.wN = resizeStart.field.wN + deltaXN;
          newField.hN = resizeStart.field.hN - deltaYN;
          break;
        case 'bottom-left':
          newField.xN = resizeStart.field.xN + deltaXN;
          newField.wN = resizeStart.field.wN - deltaXN;
          newField.hN = resizeStart.field.hN + deltaYN;
          break;
        case 'bottom-right':
          newField.wN = resizeStart.field.wN + deltaXN;
          newField.hN = resizeStart.field.hN + deltaYN;
          break;
      }

      // Enforce minimum size (5% of page dimensions)
      const minSize = 0.05;
      if (newField.wN < minSize) newField.wN = minSize;
      if (newField.hN < minSize) newField.hN = minSize;

      // Enforce boundaries (keep within page)
      if (newField.xN - newField.wN / 2 < 0) newField.xN = newField.wN / 2;
      if (newField.xN + newField.wN / 2 > 1) newField.xN = 1 - newField.wN / 2;
      if (newField.yN - newField.hN / 2 < 0) newField.yN = newField.hN / 2;
      if (newField.yN + newField.hN / 2 > 1) newField.yN = 1 - newField.hN / 2;

      setLocalSignatureField(newField);
    }

    // Handle drag
    if (isDragging && dragStart && localSignatureField) {
      const deltaXPx = e.clientX - dragStart.x;
      const deltaYPx = e.clientY - dragStart.y;

      // Convert to normalized coordinates
      const deltaXN = deltaXPx / pageWidth;
      const deltaYN = deltaYPx / pageHeight;

      // Calculate new center position
      let newXN = dragStart.field.xN + deltaXN;
      let newYN = dragStart.field.yN + deltaYN;

      // Enforce boundaries - keep entire field within page
      const halfW = localSignatureField.wN / 2;
      const halfH = localSignatureField.hN / 2;

      if (newXN - halfW < 0) newXN = halfW;
      if (newXN + halfW > 1) newXN = 1 - halfW;
      if (newYN - halfH < 0) newYN = halfH;
      if (newYN + halfH > 1) newYN = 1 - halfH;

      setLocalSignatureField({
        ...localSignatureField,
        xN: newXN,
        yN: newYN,
      });
    }
  };

  const handleMouseUp = () => {
    // Handle resize end
    if (isResizing && localSignatureField) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
      onSignatureFieldUpdate(localSignatureField);
    }

    // Handle drag end
    if (isDragging && localSignatureField) {
      setIsDragging(false);
      setDragStart(null);
      onSignatureFieldUpdate(localSignatureField);
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

            {/* Signature field overlay */}
            {localSignatureField && (
              <SignatureField
                field={localSignatureField}
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
