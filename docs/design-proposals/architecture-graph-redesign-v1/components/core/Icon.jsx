import React from 'react';

/**
 * Lucide glyphs, vendored. The markup below is copied verbatim from
 * lucide-icons/lucide `icons/` (also kept as files in `assets/icons/`) — no
 * network request, no CDN, works offline and in rasterised captures. Upstream
 * draws lucide at stroke 1.6–1.9; 1.75 is the house value.
 *
 * To add a glyph: copy `icons/<name>.svg` from lucide-icons/lucide, drop it in
 * `assets/icons/`, and paste its inner markup here. Never draw one by hand.
 */
export const iconGlyphs = {
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path> <path d="M12 9v4"></path> <path d="M12 17h.01"></path>',
  'arrow-down-to-line': '<path d="M12 17V3"></path> <path d="m6 11 6 6 6-6"></path> <path d="M19 21H5"></path>',
  'arrow-left': '<path d="m12 19-7-7 7-7"></path> <path d="M19 12H5"></path>',
  'arrow-right': '<path d="M5 12h14"></path> <path d="m12 5 7 7-7 7"></path>',
  'arrow-up-right': '<path d="M7 7h10v10"></path> <path d="M7 17 17 7"></path>',
  'book-open': '<path d="M12 5v16"></path> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"></path>',
  'bookmark-plus': '<path d="M12 7v6"></path> <path d="M15 10H9"></path> <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path>',
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path> <path d="m3.3 7 8.7 5 8.7-5"></path> <path d="M12 22V12"></path>',
  'boxes': '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"></path> <path d="m7 16.5-4.74-2.85"></path> <path d="m7 16.5 5-3"></path> <path d="M7 16.5v5.17"></path> <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"></path> <path d="m17 16.5-5-3"></path> <path d="m17 16.5 4.74-2.85"></path> <path d="M17 16.5v5.17"></path> <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"></path> <path d="M12 8 7.26 5.15"></path> <path d="m12 8 4.74-2.85"></path> <path d="M12 13.5V8"></path>',
  'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
  'chevron-right': '<path d="m9 18 6-6-6-6"></path>',
  'chevrons-down-up': '<path d="m7 20 5-5 5 5"></path> <path d="m7 4 5 5 5-5"></path>',
  'chevrons-up-down': '<path d="m7 15 5 5 5-5"></path> <path d="m7 9 5-5 5 5"></path>',
  'circle-alert': '<circle cx="12" cy="12" r="10"></circle> <line x1="12" x2="12" y1="8" y2="12"></line> <line x1="12" x2="12.01" y1="16" y2="16"></line>',
  'circle-check-big': '<path d="M21.801 10A10 10 0 1 1 17 3.335"></path> <path d="m9 11 3 3L22 4"></path>',
  'circle-dot': '<circle cx="12" cy="12" r="10"></circle> <circle cx="12" cy="12" r="1"></circle>',
  'circle-x': '<circle cx="12" cy="12" r="10"></circle> <path d="m15 9-6 6"></path> <path d="m9 9 6 6"></path>',
  'clock': '<circle cx="12" cy="12" r="10"></circle> <path d="M12 6v6l4 2"></path>',
  'code': '<path d="m16 18 6-6-6-6"></path> <path d="m8 6-6 6 6 6"></path>',
  'compass': '<circle cx="12" cy="12" r="10"></circle> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"></path>',
  'component': '<path d="M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z"></path> <path d="M2.297 11.293a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0z"></path> <path d="M8.916 17.912a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0z"></path> <path d="M8.916 4.674a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z"></path>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
  'database': '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse> <path d="M3 5V19A9 3 0 0 0 21 19V5"></path> <path d="M3 12A9 3 0 0 0 21 12"></path>',
  'external-link': '<path d="M15 3h6v6"></path> <path d="M10 14 21 3"></path> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
  'file-code': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path> <path d="M14 2v5a1 1 0 0 0 1 1h5"></path> <path d="M10 12.5 8 15l2 2.5"></path> <path d="m14 12.5 2 2.5-2 2.5"></path>',
  'file-code-2': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path> <path d="M14 2v5a1 1 0 0 0 1 1h5"></path> <path d="M10 12.5 8 15l2 2.5"></path> <path d="m14 12.5 2 2.5-2 2.5"></path>',
  'file-text': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path> <path d="M14 2v5a1 1 0 0 0 1 1h5"></path> <path d="M10 9H8"></path> <path d="M16 13H8"></path> <path d="M16 17H8"></path>',
  'folder-open': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"></path>',
  'folder-search': '<path d="M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1"></path> <path d="m21 21-1.9-1.9"></path> <circle cx="17" cy="17" r="3"></circle>',
  'folder-tree': '<path d="M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path> <path d="M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z"></path> <path d="M3 5a2 2 0 0 0 2 2h3"></path> <path d="M3 3v13a2 2 0 0 0 2 2h3"></path>',
  'git-branch': '<path d="M15 6a9 9 0 0 0-9 9V3"></path> <circle cx="18" cy="6" r="3"></circle> <circle cx="6" cy="18" r="3"></circle>',
  'info': '<circle cx="12" cy="12" r="10"></circle> <path d="M12 16v-4"></path> <path d="M12 8h.01"></path>',
  'list': '<path d="M3 5h.01"></path> <path d="M3 12h.01"></path> <path d="M3 19h.01"></path> <path d="M8 5h13"></path> <path d="M8 12h13"></path> <path d="M8 19h13"></path>',
  'list-tree': '<path d="M8 5h13"></path> <path d="M13 12h8"></path> <path d="M13 19h8"></path> <path d="M3 10a2 2 0 0 0 2 2h3"></path> <path d="M3 5v12a2 2 0 0 0 2 2h3"></path>',
  'loader-circle': '<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>',
  'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path> <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path> <path d="M3 16v3a2 2 0 0 0 2 2h3"></path> <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>',
  'menu': '<path d="M4 5h16"></path> <path d="M4 12h16"></path> <path d="M4 19h16"></path>',
  'message-square-text': '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"></path> <path d="M7 11h10"></path> <path d="M7 15h6"></path> <path d="M7 7h8"></path>',
  'minus': '<path d="M5 12h14"></path>',
  'monitor': '<rect width="20" height="14" x="2" y="3" rx="2"></rect> <line x1="8" x2="16" y1="21" y2="21"></line> <line x1="12" x2="12" y1="17" y2="21"></line>',
  'moon': '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>',
  'network': '<rect x="16" y="16" width="6" height="6" rx="1"></rect> <rect x="2" y="16" width="6" height="6" rx="1"></rect> <rect x="9" y="2" width="6" height="6" rx="1"></rect> <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path> <path d="M12 12V8"></path>',
  'panel-right': '<rect width="18" height="18" x="3" y="3" rx="2"></rect> <path d="M15 3v18"></path>',
  'plus': '<path d="M5 12h14"></path> <path d="M12 5v14"></path>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path> <path d="M21 3v5h-5"></path> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path> <path d="M8 16H3v5"></path>',
  'search-code': '<path d="m13 13.5 2-2.5-2-2.5"></path> <path d="m21 21-4.3-4.3"></path> <path d="M9 8.5 7 11l2 2.5"></path> <circle cx="11" cy="11" r="8"></circle>',
  'send': '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path> <path d="m21.854 2.147-10.94 10.939"></path>',
  'settings': '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path> <circle cx="12" cy="12" r="3"></circle>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path> <path d="m9 12 2 2 4-4"></path>',
  'sparkles': '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path> <path d="M20 2v4"></path> <path d="M22 4h-4"></path> <circle cx="4" cy="20" r="2"></circle>',
  'sun': '<circle cx="12" cy="12" r="4"></circle> <path d="M12 2v2"></path> <path d="M12 20v2"></path> <path d="m4.93 4.93 1.41 1.41"></path> <path d="m17.66 17.66 1.41 1.41"></path> <path d="M2 12h2"></path> <path d="M20 12h2"></path> <path d="m6.34 17.66-1.41 1.41"></path> <path d="m19.07 4.93-1.41 1.41"></path>',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path> <path d="M12 9v4"></path> <path d="M12 17h.01"></path>',
  'waypoints': '<path d="m10.586 5.414-5.172 5.172"></path> <path d="m18.586 13.414-5.172 5.172"></path> <path d="M6 12h12"></path> <circle cx="12" cy="20" r="2"></circle> <circle cx="12" cy="4" r="2"></circle> <circle cx="20" cy="12" r="2"></circle> <circle cx="4" cy="12" r="2"></circle>',
  'workflow': '<rect width="8" height="8" x="3" y="3" rx="2"></rect> <path d="M7 11v4a2 2 0 0 0 2 2h4"></path> <rect width="8" height="8" x="13" y="13" rx="2"></rect>',
  'x': '<path d="M18 6 6 18"></path> <path d="m6 6 12 12"></path>',
};

export function Icon({ name, size = 16, strokeWidth = 1.75, style, ...rest }) {
  const glyph = iconGlyphs[name];
  if (glyph === undefined && typeof console !== 'undefined') console.warn('Icon: no vendored glyph named "' + name + '"');
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: '0 0 auto', ...style }}
      dangerouslySetInnerHTML={{ __html: glyph || '' }}
      {...rest}
    />
  );
}
