import React from 'react'
import qrcode from 'qrcode-generator'

// Generate QR as SVG string (for print HTML injection)
// QR как data-URL (GIF) для вставки в PDF через jsPDF.addImage
export function generateQrDataUrl(text) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(text || ''));
    qr.make();
    return qr.createDataURL(6, 2); // cellSize, margin
  } catch (e) { return null; }
}

export function generateQrSvg(text, sizePx) {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(String(text || ''));
    qr.make();
    const count = qr.getModuleCount();
    const cell  = Math.floor(sizePx / (count + 4)); // 4 = 2*quietZone
    const svg   = qr.createSvgTag(cell, 2);
    // Override size to exactly sizePx
    return svg
      .replace(/width="[^"]*"/, `width="${sizePx}px"`)
      .replace(/height="[^"]*"/, `height="${sizePx}px"`)
      .replace(/viewBox="[^"]*"/, `viewBox="0 0 ${sizePx} ${sizePx}"`);
  } catch (e) {
    console.error('QR generation failed:', e, 'text:', text);
    return null;
  }
}

// React component for on-screen display
export const QrCode = React.memo(function QrCode({ text, size = 90, className, style }) {
  const svgString = React.useMemo(() => generateQrSvg(text, size), [text, size]);

  if (!svgString) {
    return (
      <div style={{ width: size, height: size, border: '1px solid #ccc',
        display: 'grid', placeItems: 'center', fontSize: 9, color: '#999', ...style }}>
        QR…
      </div>
    );
  }

  return (
    <div
      className={'qr-svg ' + (className || '')}
      style={{ width: size, height: size, ...style }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
});

export default QrCode;
