'use client';

import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import SignatureCanvas from 'react-signature-canvas';
import type { DocumentMeta, SignatureField } from '@/lib/types';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function Home() {
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Signature state
  const [isSignaturePlaced, setIsSignaturePlaced] = useState<boolean>(false);
  const [signaturePosition, setSignaturePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Modal state
  const [isSigningModalOpen, setIsSigningModalOpen] = useState<boolean>(false);

  // Download state
  const [downloadReady, setDownloadReady] = useState<boolean>(false);

  // PDF preview state
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  // Signature field state (normalized coordinates)
  const [signatureField, setSignatureField] = useState<SignatureField | null>(
    null
  );

  // PDF page dimensions for overlay rendering
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);

  // Signature canvas ref
  const signatureCanvasRef = useRef<SignatureCanvas | null>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    field: SignatureField;
  } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    field: SignatureField;
  } | null>(null);

  // Load existing document status on mount
  useEffect(() => {
    fetch('/api/meta')
      .then((res) => res.json())
      .then((data: DocumentMeta) => {
        setMeta(data);
        // Update UI state based on existing document
        if (data.status === 'uploaded' || data.status === 'converted') {
          setUploadStatus('success');
        }
      })
      .catch((error) => {
        console.error('Failed to load document status:', error);
      });
  }, []);

  // Poll for conversion status when document is uploaded
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (meta?.status === 'uploaded') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/meta');
          const data = await res.json();
          setMeta(data);

          if (data.status !== 'uploaded') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Failed to poll meta:', error);
        }
      }, 2000); // Poll every 2 seconds
    }

    return () => clearInterval(interval);
  }, [meta?.status]);

  // Fetch PDF as blob when document is converted or signed
  useEffect(() => {
    const fetchPdf = async () => {
      if (meta?.status === 'converted' || meta?.status === 'signed') {
        setIsPdfLoading(true);
        setPdfError(null);

        try {
          const response = await fetch('/api/download?type=preview');
          if (!response.ok) {
            throw new Error(`Failed to load PDF: ${response.status}`);
          }

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
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
        if (pdfBlobUrl) {
          URL.revokeObjectURL(pdfBlobUrl);
          setPdfBlobUrl(null);
        }
        setPdfError(null);
        setPageNumber(1);
        setNumPages(0);
      }
    };

    fetchPdf();

    // Cleanup: revoke blob URL when component unmounts or status changes
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [meta?.status]);

  // Sync signatureField from meta
  useEffect(() => {
    if (meta?.signatureField) {
      setSignatureField(meta.signatureField);
      setIsSignaturePlaced(true);
    } else {
      setSignatureField(null);
      setIsSignaturePlaced(false);
    }
  }, [meta?.signatureField]);

  // Event Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.docx')) {
      setUploadedFile(file);
      setErrorMessage('');
    } else {
      setUploadedFile(null);
      setErrorMessage('Only .docx files are allowed');
    }
  };

  const handleUploadClick = async () => {
    if (!uploadedFile) return;

    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus('success');
      setMeta(result.meta);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handlePreviewClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't place new field if resizing or dragging
    if (isResizing || isDragging) return;

    // Only allow placement when document is converted
    if (meta?.status !== 'converted') return;

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

    // Fixed signature field size (from requirements)
    const wN = 0.28;
    const hN = 0.1;

    const newField: SignatureField = { page: pageNumber, xN, yN, wN, hN };

    // Save to backend
    try {
      const response = await fetch('/api/field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newField),
      });

      if (!response.ok) throw new Error('Failed to save signature field');

      const data = await response.json();
      setMeta(data.meta);
      setSignatureField(newField);
      setIsSignaturePlaced(true);
      setPageWidth(pageWidthPx);
      setPageHeight(pageHeightPx);
      setSignaturePosition({ x: xPx, y: yPx });
    } catch (error) {
      console.error('Failed to place signature field:', error);
      setErrorMessage('Failed to place signature field');
    }
  };

  const handleResetSignature = () => {
    setIsSignaturePlaced(false);
    setSignaturePosition(null);
  };

  const handleSignClick = () => {
    setIsSigningModalOpen(true);
  };

  const handleSaveSignature = async () => {
    if (!signatureCanvasRef.current) return;

    // Check if canvas is empty
    if (signatureCanvasRef.current.isEmpty()) {
      setErrorMessage('Please draw your signature first');
      return;
    }

    // Get signature as PNG data URL
    const signatureDataUrl = signatureCanvasRef.current.toDataURL('image/png');

    try {
      const response = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign document');
      }

      const data = await response.json();
      setMeta(data.meta);
      setIsSigningModalOpen(false);
      setDownloadReady(true);
      setErrorMessage('');
    } catch (error) {
      console.error('Signing error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to sign document'
      );
    }
  };

  const handleDownload = (type: 'preview' | 'signed') => {
    window.open(`/api/download?type=${type}`, '_blank');
  };

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (!signatureField) return;

    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      field: { ...signatureField },
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle resize
    if (isResizing && resizeStart && signatureField && resizeHandle) {
      const deltaXPx = e.clientX - resizeStart.x;
      const deltaYPx = e.clientY - resizeStart.y;

      // Convert pixel deltas to normalized deltas
      const deltaXN = deltaXPx / pageWidth;
      const deltaYN = deltaYPx / pageHeight;

      let newField = { ...resizeStart.field };

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

      setSignatureField(newField);
    }

    // Handle drag
    if (isDragging && dragStart && signatureField) {
      const deltaXPx = e.clientX - dragStart.x;
      const deltaYPx = e.clientY - dragStart.y;

      // Convert to normalized coordinates
      const deltaXN = deltaXPx / pageWidth;
      const deltaYN = deltaYPx / pageHeight;

      // Calculate new center position
      let newXN = dragStart.field.xN + deltaXN;
      let newYN = dragStart.field.yN + deltaYN;

      // Enforce boundaries - keep entire field within page
      const halfW = signatureField.wN / 2;
      const halfH = signatureField.hN / 2;

      if (newXN - halfW < 0) newXN = halfW;
      if (newXN + halfW > 1) newXN = 1 - halfW;
      if (newYN - halfH < 0) newYN = halfH;
      if (newYN + halfH > 1) newYN = 1 - halfH;

      setSignatureField({
        ...signatureField,
        xN: newXN,
        yN: newYN,
      });
    }
  };

  const handleMouseUp = async () => {
    // Handle resize end
    if (isResizing && signatureField) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);

      // Save the new dimensions to backend
      try {
        const response = await fetch('/api/field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signatureField),
        });

        if (!response.ok) throw new Error('Failed to update signature field');

        const data = await response.json();
        setMeta(data.meta);
      } catch (error) {
        console.error('Failed to update signature field:', error);
        setErrorMessage('Failed to update signature field');
      }
    }

    // Handle drag end
    if (isDragging && signatureField) {
      setIsDragging(false);
      setDragStart(null);

      // Save to backend
      try {
        const response = await fetch('/api/field', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signatureField),
        });

        if (!response.ok) throw new Error('Failed to update signature field');

        const data = await response.json();
        setMeta(data.meta);
      } catch (error) {
        console.error('Failed to update signature field:', error);
        setErrorMessage('Failed to update signature field');
      }
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent field placement
    if (!signatureField) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      field: { ...signatureField },
    });
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 md:px-8">
      {/* Page Title */}
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">Tritone</h1>
        <p className="text-base text-gray-600">
          Upload, preview, sign, and download your documents
        </p>
      </div>

      {/* Section 1: Upload DOCX */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">1. Upload DOCX</h2>
        <div className="space-y-3">
          <div>
            <input
              type="file"
              accept=".docx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:transition hover:file:bg-blue-700"
            />
          </div>
          {uploadedFile && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Selected: {uploadedFile.name}
              </span>
            </div>
          )}
          <button
            onClick={handleUploadClick}
            disabled={!uploadedFile}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Upload Document
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            {uploadStatus === 'idle' && (
              <span className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800">
                Idle
              </span>
            )}
            {uploadStatus === 'uploading' && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                Uploading...
              </span>
            )}
            {meta?.status === 'uploaded' && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                Converting to PDF...
              </span>
            )}
            {meta?.status === 'converted' && (
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                Converted
              </span>
            )}
            {meta?.status === 'signed' && (
              <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                Signed
              </span>
            )}
            {meta?.status === 'failed' && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                Failed
              </span>
            )}
            {uploadStatus === 'error' && !meta && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                Error
              </span>
            )}
          </div>
          {errorMessage && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {errorMessage}
            </div>
          )}
          {meta?.status === 'failed' && meta.lastError && (
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {meta.lastError}
            </div>
          )}
          {meta &&
            (meta.status === 'uploaded' ||
              meta.status === 'converted' ||
              meta.status === 'signed') &&
            meta.createdAt && (
              <div className="text-xs text-gray-500">
                Uploaded: {new Date(meta.createdAt).toLocaleString()}
              </div>
            )}
        </div>
      </section>

      {/* Section 2: Preview */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">2. Preview</h2>
        {(meta?.status === 'converted' || meta?.status === 'signed') && (
          <div className="mb-4">
            <a
              href="/api/download?type=preview"
              download="preview.pdf"
              className="inline-block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              Download Preview PDF
            </a>
          </div>
        )}
        <div className="space-y-4">
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
                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                  onLoadError={(error) => setPdfError(error.message)}
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
                  />
                </Document>
                {/* Signature field overlay - only show on matching page */}
                {signatureField &&
                  pageNumber === signatureField.page &&
                  pageWidth > 0 && (
                    <div
                      onMouseDown={handleDragStart}
                      style={{
                        position: 'absolute',
                        left: `${(signatureField.xN - signatureField.wN / 2) * pageWidth}px`,
                        top: `${(signatureField.yN - signatureField.hN / 2) * pageHeight}px`,
                        width: `${signatureField.wN * pageWidth}px`,
                        height: `${signatureField.hN * pageHeight}px`,
                        border: '2px dashed #3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        pointerEvents: 'auto',
                        borderRadius: '4px',
                        zIndex: 10,
                        cursor: isDragging ? 'grabbing' : 'grab',
                      }}
                    >
                      {/* Resize handles */}
                      {[
                        'top-left',
                        'top-right',
                        'bottom-left',
                        'bottom-right',
                      ].map((handle) => (
                        <div
                          key={handle}
                          onMouseDown={(e) => handleResizeStart(e, handle)}
                          style={{
                            position: 'absolute',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#3B82F6',
                            border: '2px solid white',
                            borderRadius: '50%',
                            cursor: `${handle.includes('top') ? 'n' : 's'}${handle.includes('left') ? 'w' : 'e'}-resize`,
                            ...(handle === 'top-left' && {
                              top: '-6px',
                              left: '-6px',
                            }),
                            ...(handle === 'top-right' && {
                              top: '-6px',
                              right: '-6px',
                            }),
                            ...(handle === 'bottom-left' && {
                              bottom: '-6px',
                              left: '-6px',
                            }),
                            ...(handle === 'bottom-right' && {
                              bottom: '-6px',
                              right: '-6px',
                            }),
                          }}
                        />
                      ))}
                    </div>
                  )}
                {isSignaturePlaced && signaturePosition && (
                  <div className="mt-4 text-center text-xs text-gray-500">
                    Signature placed at ({Math.round(signaturePosition.x)},{' '}
                    {Math.round(signaturePosition.y)})
                  </div>
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
                onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
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
                  setPageNumber(Math.min(numPages, pageNumber + 1))
                }
                disabled={pageNumber >= numPages}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Next
              </button>

              {isSignaturePlaced && signaturePosition && (
                <button
                  onClick={handleResetSignature}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-300"
                >
                  Reset Signature Placement
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Sign */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">3. Sign Document</h2>
        <button
          onClick={handleSignClick}
          disabled={!(meta?.status === 'converted' && signatureField !== null)}
          className="rounded-md bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Sign Document
        </button>
      </section>

      {/* Section 4: Downloads */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold">4. Downloads</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('preview')}
              disabled={
                meta?.status !== 'converted' && meta?.status !== 'signed'
              }
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                meta?.status === 'converted' || meta?.status === 'signed'
                  ? 'cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              Download Preview PDF
            </button>
            {meta?.status !== 'converted' && meta?.status !== 'signed' && (
              <span className="text-xs text-gray-500">
                (Upload and convert a document first)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('signed')}
              disabled={meta?.status !== 'signed'}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                meta?.status === 'signed'
                  ? 'cursor-pointer bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              Download Signed PDF
            </button>
            {meta?.status !== 'signed' && (
              <span className="text-xs text-gray-500">
                (Complete signing first)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Modal Overlay */}
      {isSigningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Draw Your Signature</h3>
              <button
                onClick={() => setIsSigningModalOpen(false)}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            <div className="space-y-4">
              {/* Signature Canvas */}
              <div className="rounded-md border-2 border-gray-300">
                <SignatureCanvas
                  ref={signatureCanvasRef}
                  canvasProps={{
                    width: 400,
                    height: 200,
                    className: 'signature-canvas',
                  }}
                  backgroundColor="rgb(255, 255, 255)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => signatureCanvasRef.current?.clear()}
                  className="flex-1 rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 transition hover:bg-gray-300"
                >
                  Clear
                </button>
                <button
                  onClick={handleSaveSignature}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
                >
                  Save & Sign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
