import React from 'react';

// qr.jsx — QR generation (uses qrcode-generator from CDN, exposed as window.qrcode)

function generateQrSvg(text, size, quietZone = 2) {
  if (!window.qrcode) return null;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const total = count + quietZone * 2;
    const cellSize = size / total;
    const cells = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          cells.push({
            x: (c + quietZone) * cellSize,
            y: (r + quietZone) * cellSize,
            w: cellSize,
            h: cellSize,
          });
        }
      }
    }
    return { size, cells, total, cellSize };
  } catch (e) {
    return null;
  }
}

const QrCode = React.memo(function QrCode({ text, size = 90, className, style }) {
  const data = React.useMemo(() => generateQrSvg(text, size), [text, size]);
  if (!data) {
    return (
      <div style={{ width: size, height: size, border: '1px solid #ccc', display: 'grid', placeItems: 'center', fontSize: 9, color: '#999', ...style }}>
        QR…
      </div>
    );
  }
  return (
    <svg
      className={'qr-svg ' + (className || '')}
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={style}
      shapeRendering="crispEdges"
    >
      <rect className="bg" x="0" y="0" width={size} height={size} />
      {data.cells.map((c, i) => (
        <rect className="cell" key={i} x={c.x} y={c.y} width={c.w} height={c.h} />
      ))}
    </svg>
  );
});



export { QrCode, generateQrSvg };
export default QrCode;
