'use client';

import { useState, useCallback } from 'react';
import type { TemporarySignature, DocumentMeta, SignatureField } from '@/lib/types';

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

export function useTemporarySignature(
  setMeta: React.Dispatch<React.SetStateAction<DocumentMeta | null>>
): UseTemporarySignatureReturn {
  const [temporarySignature, setTemporarySignature] = useState<TemporarySignature | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<ModalMode>('place');
  const [pendingCoords, setPendingCoords] = useState<PendingCoords | null>(null);

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

  const updateSignaturePosition = useCallback((signature: TemporarySignature) => {
    setTemporarySignature(signature);
  }, []);

  const deleteSignature = useCallback(() => {
    setTemporarySignature(null);
  }, []);

  const finalizeSignature = useCallback(async () => {
    if (!temporarySignature) return;

    try {
      // Step 1: Save signature field position to backend
      const fieldResponse = await fetch('/api/field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(temporarySignature.position),
      });

      if (!fieldResponse.ok) {
        const error = await fieldResponse.json();
        throw new Error(error.error || 'Failed to save signature field');
      }

      // Step 2: Sign the document (stamp signature on PDF)
      const signResponse = await fetch('/api/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signatureDataUrl: temporarySignature.dataUrl }),
      });

      if (!signResponse.ok) {
        const error = await signResponse.json();
        throw new Error(error.error || 'Failed to sign document');
      }

      const result = await signResponse.json();

      // Step 3: Update meta state to 'signed'
      setMeta(result.meta);

      // Step 4: Clear temporary signature (now permanent)
      setTemporarySignature(null);
    } catch (error) {
      console.error('Finalization error:', error);
      throw error;
    }
  }, [temporarySignature, setMeta]);

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
