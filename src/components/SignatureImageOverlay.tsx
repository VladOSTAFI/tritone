'use client';

import React from 'react';
import type { TemporarySignature } from '@/lib/types';

interface SignatureImageOverlayProps {
  signature: TemporarySignature;
  pageWidth: number;
  pageHeight: number;
  pageNumber: number;
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
}

export function SignatureImageOverlay({
  signature,
  pageWidth,
  pageHeight,
  pageNumber,
  isDragging,
  onDragStart,
  onResizeStart,
}: SignatureImageOverlayProps) {
  const { dataUrl, position } = signature;

  // Only render if on the correct page and page dimensions are available
  if (pageNumber !== position.page || pageWidth === 0 || pageHeight === 0) {
    return null;
  }

  const resizeHandles = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ];

  const getHandlePosition = (handle: string) => {
    switch (handle) {
      case 'top-left':
        return { top: '-6px', left: '-6px' };
      case 'top-right':
        return { top: '-6px', right: '-6px' };
      case 'bottom-left':
        return { bottom: '-6px', left: '-6px' };
      case 'bottom-right':
        return { bottom: '-6px', right: '-6px' };
      default:
        return {};
    }
  };

  const getHandleCursor = (handle: string) => {
    return `${handle.includes('top') ? 'n' : 's'}${handle.includes('left') ? 'w' : 'e'}-resize`;
  };

  return (
    <div
      onMouseDown={onDragStart}
      style={{
        position: 'absolute',
        left: `${(position.xN - position.wN / 2) * pageWidth}px`,
        top: `${(position.yN - position.hN / 2) * pageHeight}px`,
        width: `${position.wN * pageWidth}px`,
        height: `${position.hN * pageHeight}px`,
        border: '3px solid rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        pointerEvents: 'auto',
        borderRadius: '6px',
        zIndex: 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2), 0 2px 4px -1px rgba(59, 130, 246, 0.1)',
      }}
    >
      {/* Signature Image */}
      <img
        src={dataUrl}
        alt="Signature"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Resize handles */}
      {resizeHandles.map((handle) => (
        <div
          key={handle}
          onMouseDown={(e) => onResizeStart(e, handle)}
          style={{
            position: 'absolute',
            width: '14px',
            height: '14px',
            backgroundColor: '#3B82F6',
            border: '2.5px solid white',
            borderRadius: '50%',
            cursor: getHandleCursor(handle),
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            ...getHandlePosition(handle),
          }}
        />
      ))}
    </div>
  );
}
