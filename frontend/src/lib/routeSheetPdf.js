// lib/routeSheetPdf.js — генерация маршрутного листа в PDF.
// Рендерим готовый HTML off-screen (браузер корректно отрисовывает кириллицу и QR),
// снимаем в canvas и раскладываем по страницам A4. Без проблем со шрифтами и вёрсткой печати.
// jsPDF и html2canvas грузятся лениво — только при формировании PDF (экономия ~450КБ на старте)

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 12; // базовые отступы со всех сторон

export async function routeSheetToPdf(bodyHtml, { filename = 'route-sheet.pdf', open = true } = {}) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'), import('html2canvas'),
  ]);
  // Off-screen контейнер шириной под область печати A4 (210 - 2*12 = 186мм ≈ 703px @ 96dpi)
  const contentWmm = A4_W_MM - MARGIN_MM * 2;
  const pxPerMm = 96 / 25.4;
  const widthPx = Math.round(contentWmm * pxPerMm);

  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${widthPx}px;background:#fff;` +
    `padding:0;margin:0;font-family:Arial,sans-serif;font-size:9pt;color:#14110b;`;
  holder.innerHTML = bodyHtml;
  document.body.appendChild(holder);

  try {
    const canvas = await html2canvas(holder, {
      scale: 2,               // 2x для чёткости текста и сканируемости QR
      backgroundColor: '#fff',
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const imgWmm = A4_W_MM - MARGIN_MM * 2;
    const imgHmm = (canvas.height / canvas.width) * imgWmm;
    const pageContentHmm = A4_H_MM - MARGIN_MM * 2;

    if (imgHmm <= pageContentHmm) {
      // Влезает на одну страницу
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, imgWmm, imgHmm);
    } else {
      // Пагинация: режем изображение по высоте страницы
      const pageHpx = Math.floor((pageContentHmm / imgWmm) * canvas.width);
      let renderedPx = 0;
      let page = 0;
      while (renderedPx < canvas.height) {
        const sliceHpx = Math.min(pageHpx, canvas.height - renderedPx);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceHpx;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
        const sliceHmm = (sliceHpx / canvas.width) * imgWmm;
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN_MM, MARGIN_MM, imgWmm, sliceHmm);
        renderedPx += sliceHpx;
        page++;
      }
    }

    if (open) {
      // Открываем во вкладке для печати/сохранения
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      pdf.save(filename);
    }
  } finally {
    document.body.removeChild(holder);
  }
}
