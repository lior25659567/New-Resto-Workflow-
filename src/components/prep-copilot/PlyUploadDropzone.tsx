import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { color, radius, font, space } from '@/design-system/tokens';

type Slot = 'pre' | 'post';

interface SlotInfo {
  file: File | null;
  loading: boolean;
  error: string | null;
  geometry: unknown | null;
}

interface PlyUploadDropzoneProps {
  pre: SlotInfo;
  post: SlotInfo;
  onDrop: (files: FileList, slot: Slot) => void;
  onReady: () => void;
  isReady: boolean;
}

function DropTarget({
  slot,
  label,
  info,
  onDrop,
}: {
  slot: Slot;
  label: string;
  info: SlotInfo;
  onDrop: (files: FileList, slot: Slot) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onDrop(e.dataTransfer.files, slot);
      }
    },
    [onDrop, slot],
  );

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(e.target.files, slot);
    }
  };

  const done = !!info.geometry;
  const borderColor = dragOver
    ? color.primary
    : info.error
      ? color.danger
      : done
        ? '#4ade80'
        : 'rgba(255,255,255,0.25)';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[3],
        padding: space[6],
        border: `2px dashed ${borderColor}`,
        borderRadius: radius.lg,
        cursor: 'pointer',
        background: dragOver ? 'rgba(0,154,206,0.08)' : 'rgba(255,255,255,0.03)',
        transition: 'all 0.2s ease',
        minHeight: 160,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ply"
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {info.loading ? (
        <Loader2 size={28} color={color.primary} className="animate-spin" />
      ) : done ? (
        <CheckCircle size={28} color="#4ade80" />
      ) : info.error ? (
        <AlertCircle size={28} color={color.danger} />
      ) : (
        <Upload size={28} color="rgba(255,255,255,0.5)" />
      )}

      <span
        style={{
          fontSize: font.size.sm,
          fontWeight: font.weight.semibold,
          color: 'rgba(255,255,255,0.9)',
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: font.size['2xs'],
          color: info.error ? color.danger : 'rgba(255,255,255,0.5)',
          textAlign: 'center',
        }}
      >
        {info.loading
          ? 'Parsing geometry...'
          : info.error
            ? info.error
            : done
              ? info.file?.name ?? 'Loaded'
              : 'Drop .ply file or click to browse'}
      </span>
    </div>
  );
}

export function PlyUploadDropzone({ pre, post, onDrop, onReady, isReady }: PlyUploadDropzoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space[4],
        padding: space[5],
        height: '100%',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h3
          style={{
            fontSize: font.size.base,
            fontWeight: font.weight.semibold,
            color: 'rgba(255,255,255,0.95)',
            margin: 0,
          }}
        >
          Upload Scan Models
        </h3>
        <p
          style={{
            fontSize: font.size['2xs'],
            color: 'rgba(255,255,255,0.5)',
            margin: `${space[1]} 0 0`,
          }}
        >
          Import pre-treatment and post-treatment .ply scans
        </p>
      </div>

      <div style={{ display: 'flex', gap: space[3], flex: 1 }}>
        <DropTarget slot="pre" label="Pre-treatment" info={pre} onDrop={onDrop} />
        <DropTarget slot="post" label="Post-treatment" info={post} onDrop={onDrop} />
      </div>

      <button
        disabled={!isReady}
        onClick={onReady}
        style={{
          width: '100%',
          padding: `${space[3]} ${space[4]}`,
          background: isReady ? color.primary : 'rgba(255,255,255,0.1)',
          color: isReady ? '#fff' : 'rgba(255,255,255,0.4)',
          border: 'none',
          borderRadius: radius.md,
          fontSize: font.size.sm,
          fontWeight: font.weight.semibold,
          cursor: isReady ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        Align & Continue
      </button>
    </motion.div>
  );
}
