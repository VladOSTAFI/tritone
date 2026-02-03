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

  const handleCloseClick = () => {
    // Prevent closing if canvas is not empty
    if (!isCanvasEmpty()) {
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleOverlayClick}
    >
      <div className="mx-4 w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {/* Signature Canvas */}
          <div
            ref={containerRef}
            className="rounded-md border-2 border-gray-300"
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
            <div className="rounded bg-red-50 p-2 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              disabled={isSaving}
              className="flex-1 rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-800 transition hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
