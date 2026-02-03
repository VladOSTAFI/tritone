'use client';

import React from 'react';
import type { SignatureField as SignatureFieldType } from '@/lib/types';

interface SignatureFieldProps {
  field: SignatureFieldType;
  pageWidth: number;
  pageHeight: number;
  pageNumber: number;
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
}

export function SignatureField({
  field,
  pageWidth,
  pageHeight,
  pageNumber,
  isDragging,
  onDragStart,
  onResizeStart,
}: SignatureFieldProps) {
  // Only render if on the correct page and page dimensions are available
  if (pageNumber !== field.page || pageWidth === 0 || pageHeight === 0) {
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
        left: `${(field.xN - field.wN / 2) * pageWidth}px`,
        top: `${(field.yN - field.hN / 2) * pageHeight}px`,
        width: `${field.wN * pageWidth}px`,
        height: `${field.hN * pageHeight}px`,
        border: '3px dashed #3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        pointerEvents: 'auto',
        borderRadius: '6px',
        zIndex: 10,
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2), 0 2px 4px -1px rgba(59, 130, 246, 0.1)',
      }}
    >
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
