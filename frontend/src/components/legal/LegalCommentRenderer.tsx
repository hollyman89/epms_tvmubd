'use client';

import React, { useEffect, useState } from 'react';

interface LegalCommentRendererProps {
  content: string;
  style?: React.CSSProperties;
  className?: string;
}

export const LegalCommentRenderer: React.FC<LegalCommentRendererProps> = ({
  content,
  style,
  className,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getSanitizedHtml = (rawHtml: string) => {
    // Client-side DOMPurify sanitization (SSR safe)
    if (mounted && typeof window !== 'undefined' && (window as any).DOMPurify) {
      return (window as any).DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'p', 'br'],
      });
    }

    // Safe SSR fallback (prevents window is not defined crash during SSR in Next.js 14)
    return (rawHtml || '')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
  };

  return (
    <div
      className={className}
      style={{ fontSize: 12, color: '#333333', lineHeight: '1.5', ...style }}
      dangerouslySetInnerHTML={{ __html: getSanitizedHtml(content || '') }}
    />
  );
};
