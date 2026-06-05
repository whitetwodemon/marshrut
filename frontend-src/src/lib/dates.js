/**
 * dates.js — Утилиты для работы с датами и часовым поясом
 *
 * MySQL возвращает TIMESTAMP в UTC (+00:00 из PDO connection).
 * Для отображения пользователю используем настройку timezone_offset из system_settings.
 */

/**
 * Получить смещение часового пояса из настроек приложения
 * @returns {string} '+03:00' формат
 */
export function getTimezoneOffset(settings) {
  return settings?.timezone_offset?.value || '+03:00';
}

/**
 * Парсит дату из ответа сервера (UTC строка без Z) в UTC миллисекунды
 * @param {string} dateStr - "2026-05-31 08:00:00" или "2026-05-31T08:00:00"
 * @returns {number} UTC миллисекунды
 */
export function serverDateToMs(dateStr) {
  if (!dateStr) return 0;
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime();
}

/**
 * Вычислить прошедшее время в минутах от серверного timestamp до сейчас
 * @param {string} dateStr  - timestamp с сервера
 * @returns {number} минут прошло
 */
export function elapsedMinutes(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.round((Date.now() - serverDateToMs(dateStr)) / 60000));
}
