import type { ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent } from 'react';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
};

export function hasMessageAttachmentFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types || []).includes('Files')
    || Boolean(dataTransfer.files?.length)
    || Array.from(dataTransfer.items || []).some((item) => item.kind === 'file');
}

export function getMessageAttachmentFiles(dataTransfer: DataTransfer): File[] {
  const files = Array.from(dataTransfer.files || []);
  const itemFiles = files.length
    ? files
    : Array.from(dataTransfer.items || [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

  return itemFiles.map((file, index) => {
    const hasExtension = /\.[^./\\]+$/.test(file.name);
    if (hasExtension) return file;

    const extension = EXTENSION_BY_MIME[file.type.toLowerCase()];
    if (!extension) return file;

    const baseName = file.type.startsWith('image/') ? 'imagen-portapapeles' : 'archivo-portapapeles';
    const name = `${baseName}-${Date.now()}-${index + 1}.${extension}`;
    return new File([file], name, { type: file.type, lastModified: file.lastModified || Date.now() });
  });
}

export function pasteMessageAttachmentFiles(
  event: ReactClipboardEvent<HTMLElement>,
  addFiles?: (files: File[]) => void,
) {
  const files = getMessageAttachmentFiles(event.clipboardData);
  if (!files.length) return;
  event.preventDefault();
  addFiles?.(files);
}

export function allowMessageAttachmentDrop(event: ReactDragEvent<HTMLElement>) {
  if (hasMessageAttachmentFiles(event.dataTransfer)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
}

export function dropMessageAttachmentFiles(
  event: ReactDragEvent<HTMLElement>,
  addFiles?: (files: File[]) => void,
) {
  if (!hasMessageAttachmentFiles(event.dataTransfer)) return;
  event.preventDefault();
  const files = getMessageAttachmentFiles(event.dataTransfer);
  if (files.length) addFiles?.(files);
}
