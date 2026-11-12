import { useCallback, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import { getMessageAttachmentFiles, hasMessageAttachmentFiles } from './message-attachment-input';

export function useMessageAttachmentDrop<T extends HTMLElement>(onFiles: (files: File[]) => void, disabled = false) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const reset = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  }, []);

  const onDragEnter = (event: ReactDragEvent<T>) => {
    if (disabled) {
      reset();
      return;
    }
    if (!hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const onDragLeave = (event: ReactDragEvent<T>) => {
    if (!hasMessageAttachmentFiles(event.dataTransfer)) {
      if (disabled) reset();
      return;
    }
    if (disabled) {
      reset();
      return;
    }
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const onDragOver = (event: ReactDragEvent<T>) => {
    if (!hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
  };

  const onDrop = (event: ReactDragEvent<T>) => {
    if (!hasMessageAttachmentFiles(event.dataTransfer)) {
      if (disabled) reset();
      return;
    }
    const alreadyHandled = event.defaultPrevented;
    event.preventDefault();
    reset();
    if (disabled || alreadyHandled) return;
    const files = getMessageAttachmentFiles(event.dataTransfer);
    if (files.length) onFiles(files);
  };

  return { isDragging: !disabled && isDragging, reset, onDragEnter, onDragLeave, onDragOver, onDrop };
}
