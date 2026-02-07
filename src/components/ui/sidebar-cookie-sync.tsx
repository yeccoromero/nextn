
'use client';
import { useEffect } from 'react';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function SidebarCookieSync({ open }: { open: boolean }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const openState = open ? 'expanded' : 'collapsed';
    document.cookie =
      `${SIDEBAR_COOKIE_NAME}=${encodeURIComponent(openState)}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [open]);

  return null;
}

    