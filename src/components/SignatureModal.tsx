'use client';

import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureDataUrl: string) => Promise<void>;
  mode?: 'place' | 'redraw';
  title?: string;
}

export function SignatureModal({
  isOpen,
  onClose,
  onSave,
  mode = 'place',
  title = 'Draw Your Signature',
}: SignatureModalProps) {
  const signatureCanvasRef = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [canvasWidth, setCanvasWidth] = useState<number>(800);

  // Update canvas width when container size changes
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updateCanvasWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setCanvasWidth(width);
      }
    };

    // Set initial width
    updateCanvasWidth();

    // Update on window resize
    window.addEventListener('resize', updateCanvasWidth);
    return () => window.removeEventListener('resize', updateCanvasWidth);
  }, [isOpen]);

  if (!isOpen) return null;

  const isCanvasEmpty = () => {
    return signatureCanvasRef.current?.isEmpty() ?? true;
  };

  const handleClear = () => {
    signatureCanvasRef.current?.clear();
    setErrorMessage('');
  };

  const handleSave = async () => {
    if (!signatureCanvasRef.current) return;

    // Check if canvas is empty
    if (signatureCanvasRef.current.isEmpty()) {
      setErrorMessage('Please draw your signature first');
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    try {
      // Get signature as PNG data URL
      const signatureDataUrl =
        signatureCanvasRef.current.toDataURL('image/png');
      await onSave(signatureDataUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to save signature'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Prevent closing if canvas is not empty
      if (!isCanvasEmpty()) {
        return;
      }
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="mx-4 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:ring-2 focus:ring-gray-300 focus:outline-none"
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {/* Signature Canvas */}
          <div
            ref={containerRef}
            className="overflow-hidden rounded-lg border-2 border-gray-300 shadow-inner"
          >
            <SignatureCanvas
              ref={signatureCanvasRef}
              canvasProps={{
                width: canvasWidth,
                height: 500,
                className: 'signature-canvas w-full',
              }}
              backgroundColor="rgb(255, 255, 255)"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-4 w-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClear}
              disabled={isSaving}
              className="flex-1 rounded-lg bg-gray-100 px-5 py-3 font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-200 hover:shadow-md focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving
                ? 'Placing...'
                : mode === 'redraw'
                  ? 'Update Signature'
                  : 'Place on Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
