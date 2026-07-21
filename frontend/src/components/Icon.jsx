import React from 'react'

// icons.jsx — minimal stroked iconset (24x24, 1.5 stroke)

const Icon = ({ name, size = 16, className, style }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    className: 'ico ' + (className || ''), style,
  };
  switch (name) {
    case 'gauge': return (
      <svg {...props}>
        <path d="M12 14l4-4" />
        <circle cx="12" cy="14" r="0.6" fill="currentColor" stroke="none" />
        <path d="M3.5 16a9 9 0 0117 0" />
        <path d="M3.5 16h17" />
        <path d="M5 13.5l1.4.5M19 13.5l-1.4.5M9 8.5l.9 1.4M15 8.5l-.9 1.4" />
      </svg>
    );
    case 'orders': return (
      <svg {...props}>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
    case 'library': return (
      <svg {...props}>
        <rect x="3.5" y="4" width="5" height="16" rx="1" />
        <rect x="10.5" y="4" width="5" height="16" rx="1" />
        <path d="M17.5 5l3.2 1-3 14.5-3.2-1z" />
      </svg>
    );
    case 'scan': return (
      <svg {...props}>
        <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16" />
        <path d="M4 12h16" />
      </svg>
    );
    case 'plus': return (
      <svg {...props}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
    case 'print': return (
      <svg {...props}>
        <path d="M7 8V4h10v4" />
        <rect x="4.5" y="8" width="15" height="9" rx="1.5" />
        <rect x="7" y="14" width="10" height="6" rx="0.5" />
        <circle cx="16.5" cy="11" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    );
    case 'search': return (
      <svg {...props}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
    );
    case 'filter': return (
      <svg {...props}>
        <path d="M4 5h16l-6 8v6l-4-2v-4z" />
      </svg>
    );
    case 'trash': return (
      <svg {...props}>
        <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
      </svg>
    );
    case 'check': return (
      <svg {...props}>
        <path d="M4.5 12.5l5 5 10-11" />
      </svg>
    );
    case 'x': return (
      <svg {...props}>
        <path d="M6 6l12 12M18 6l-12 12" />
      </svg>
    );
    case 'clock': return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
    case 'building': return (
      <svg {...props}>
        <rect x="3" y="7" width="18" height="14" rx="1"/>
        <path d="M8 21V11h8v10"/>
        <path d="M3 7l9-4 9 4"/>
        <rect x="10" y="13" width="4" height="4"/>
      </svg>
    );
    case 'archive': return (
      <svg {...props}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
    );
    case 'pause': return (
      <svg {...props}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    );
    case 'alert-triangle': return (
      <svg {...props}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    );
    case 'play': return (
      <svg {...props}><polygon points="5 3 19 12 5 21 5 3"/></svg>
    );
    case 'history': return (
      <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    );
    case 'chevron-up': return (
      <svg {...props}><polyline points="18 15 12 9 6 15"/></svg>
    );
    case 'grid': return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    );
    case 'list': return (
      <svg {...props}>
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="1.5" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="3" cy="18" r="1.5" fill="currentColor"/>
      </svg>
    );
    case 'chart': return (
      <svg {...props}>
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
        <line x1="2"  y1="20" x2="22" y2="20"/>
      </svg>
    );
    case 'table': return (
      <svg {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
    );
    case 'chevron-down': return (
      <svg {...props}>
        <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    case 'edit': return (
      <svg {...props}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
    case 'close': return (
      <svg {...props}>
        <line x1="5" y1="5" x2="19" y2="19" strokeWidth="2" strokeLinecap="round" />
        <line x1="19" y1="5" x2="5" y2="19" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
    case 'dots': return (
      <svg {...props}>
        <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
    case 'cog': return (
      <svg {...props}>
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3.5l1 2.2 2.4-.4.5 2.4 2.3.6-.5 2.3 1.7 1.7-1.7 1.7.5 2.3-2.3.6-.5 2.4-2.4-.4-1 2.2-1-2.2-2.4.4-.5-2.4-2.3-.6.5-2.3L3 12l1.7-1.7-.5-2.3 2.3-.6.5-2.4 2.4.4z" />
      </svg>
    );
    case 'qr': return (
      <svg {...props}>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <path d="M14 14v3M14 20h3M17 14v3M20 14v6M14 17h0" />
      </svg>
    );
    case 'camera': return (
      <svg {...props}>
        <path d="M3.5 8h3l1.5-2h8L17.5 8h3v11h-17z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
    );
    case 'arrow-right': return (
      <svg {...props}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
    case 'arrow-left': return (
      <svg {...props}>
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
    );
    case 'bell': return (
      <svg {...props}>
        <path d="M6 17V11a6 6 0 0112 0v6l1.5 1.5h-15z" />
        <path d="M10 21h4" />
      </svg>
    );
    case 'menu': return (
      <svg {...props}>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
    case 'flash': return (
      <svg {...props}>
        <path d="M13 3l-8 11h6l-1 7 8-11h-6z" />
      </svg>
    );
    case 'wifi': return (
      <svg {...props}>
        <path d="M5 12a10 10 0 0114 0M8 15a6 6 0 018 0" />
        <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
    case 'battery': return (
      <svg {...props} strokeWidth="1.2">
        <rect x="3" y="8" width="16" height="8" rx="1.5" />
        <rect x="5" y="10" width="11" height="4" fill="currentColor" stroke="none" />
        <path d="M20.5 10.5v3" />
      </svg>
    );
    case 'signal': return (
      <svg {...props} strokeWidth="1.4">
        <path d="M3 18h2v-3H3zM7 18h2v-6H7zM11 18h2V9h-2zM15 18h2V6h-2z" fill="currentColor" />
      </svg>
    );
    case 'route': return (
      <svg {...props}>
        <circle cx="6" cy="6" r="2.2" />
        <circle cx="18" cy="18" r="2.2" />
        <path d="M6 8.2v6a4 4 0 004 4h2M14 5.8h2a4 4 0 014 4v2" />
      </svg>
    );
    case 'box': return (
      <svg {...props}>
        <path d="M3.5 7l8.5-3.5L20.5 7v10L12 20.5 3.5 17z" />
        <path d="M3.5 7l8.5 4 8.5-4M12 11v9.5" />
      </svg>
    );
    case 'cross-x': return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </svg>
    );
    default: return <svg {...props}><circle cx="12" cy="12" r="4" /></svg>;
  }
};

window.Icon = Icon;

export { Icon }
