import { MouseEvent } from 'react';

export const copyToClipboard = (e: MouseEvent, text: string): void => {
  e.stopPropagation();
  e.preventDefault();
  navigator.clipboard.writeText(text);
};

