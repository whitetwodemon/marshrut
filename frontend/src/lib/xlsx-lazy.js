// Ленивам загрузка SheetJS — только при экспорте/импорте Excel (~180КБ вне старта)
export async function loadXLSX() { return await import('xlsx'); }
