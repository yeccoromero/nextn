

import type { SvgObject, ClipboardEnvelope } from '@/types/editor';

class ClipboardManager {
  private clipboard: ClipboardEnvelope | null = null;

  copy(content: ClipboardEnvelope) {
    this.clipboard = JSON.parse(JSON.stringify(content));
  }

  paste(): ClipboardEnvelope | null {
    if (!this.clipboard) return null;
    return JSON.parse(JSON.stringify(this.clipboard));
  }

  isEmpty(): boolean {
    return this.clipboard === null;
  }
}

export const clipboard = new ClipboardManager();
