'use client';

import { useState, useCallback } from 'react';
import type { TemporarySignature, SignatureField } from '@/lib/types';
import { useDocumentContext } from '@/contexts/DocumentContext';

interface PendingCoords {
  xN: number;
  yN: number;
  pageWidth: number;
  pageHeight: number;
  page: number;
}

type ModalMode = 'place' | 'redraw';

interface UseTemporarySignatureReturn {
  temporarySignature: TemporarySignature | null;
  isModalOpen: boolean;
  modalMode: ModalMode;
  openModalForPlacement: (coords: PendingCoords) => void;
  openModalForRedraw: () => void;
  closeModal: () => void;
  placeSignature: (dataUrl: string) => Promise<void>;
  updateSignaturePosition: (signature: TemporarySignature) => void;
  deleteSignature: () => void;
  finalizeSignature: () => Promise<void>;
}

export function useTemporarySignature(): UseTemporarySignatureReturn {
  const { meta, updateMeta } = useDocumentContext();
  const [temporarySignature, setTemporarySignature] =
    useState<TemporarySignature | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('place');
  const [pendingCoords, setPendingCoords] = useState<PendingCoords | null>(
    null
  );

  const openModalForPlacement = useCallback((coords: PendingCoords) => {
    setPendingCoords(coords);
    setModalMode('place');
    setIsModalOpen(true);
  }, []);

  const openModalForRedraw = useCallback(() => {
    if (!temporarySignature) return;
    setModalMode('redraw');
    setIsModalOpen(true);
  }, [temporarySignature]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const placeSignature = useCallback(
    async (dataUrl: string) => {
      if (modalMode === 'place' && pendingCoords) {
        // Placing new signature
        // Fixed signature field size
        const wN = 0.28;
        const hN = 0.1;

        const position: SignatureField = {
          page: pendingCoords.page,
          xN: pendingCoords.xN,
          yN: pendingCoords.yN,
          wN,
          hN,
        };

        setTemporarySignature({
          dataUrl,
          position,
        });
      } else if (modalMode === 'redraw' && temporarySignature) {
        // Redrawing existing signature - keep position
        setTemporarySignature({
          dataUrl,
          position: temporarySignature.position,
        });
      }

      closeModal();
    },
    [modalMode, pendingCoords, temporarySignature, closeModal]
  );

  const updateSignaturePosition = useCallback(
    (signature: TemporarySignature) => {
      setTemporarySignature(signature);
    },
    []
  );

  const deleteSignature = useCallback(() => {
    setTemporarySignature(null);
  }, []);

  const finalizeSignature = useCallback(async () => {
    if (!temporarySignature) return;

    try {
      // Call backend to sign the document with signature data and field position
      const signResponse = await fetch('/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatureDataUrl: temporarySignature.dataUrl,
          signatureField: temporarySignature.position,
        }),
      });

      if (!signResponse.ok) {
        const error = await signResponse.json();
        throw new Error(error.error || 'Failed to sign document');
      }

      const result = await signResponse.json();

      // Update meta state to 'signed' on frontend
      updateMeta({
        ...meta,
        status: 'signed',
        signedPdfPath: result.signedPdfUrl,
        signatureField: temporarySignature.position,
      });

      // Clear temporary signature (now permanent)
      setTemporarySignature(null);
    } catch (error) {
      console.error('Finalization error:', error);
      throw error;
    }
  }, [temporarySignature, meta, updateMeta]);

  return {
    temporarySignature,
    isModalOpen,
    modalMode,
    openModalForPlacement,
    openModalForRedraw,
    closeModal,
    placeSignature,
    updateSignaturePosition,
    deleteSignature,
    finalizeSignature,
  };
}
