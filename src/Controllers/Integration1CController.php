<?php
// Integration1CController — пример интеграции с 1С:Предприятие.
// ЗАБЛОКИРОВАН фича-флагом feature_1c (разблокируется в админ-панели).
// Экспорт заказов/номенклатуры в структуру, совместимую с обменом 1С (JSON/CommerceML-подобную).

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;

class Integration1CController
{
    private const FEATURE = 'feature_1c';

    // GET /api/integration/1c/status — статус интеграции
    public static function status(array $params): void
    {
        Auth::require();
        $enabled = SettingsController::feature(self::FEATURE);
        json_out([
            'enabled'     => $enabled,
            'name'        => 'Интеграция 1С:Предприятие',
            'description' => 'Обмен заказами и номенклатурой с 1С. Экспорт в JSON/CommerceML.',
            'endpoints'   => [
                'export_orders'      => '/api/integration/1c/export/orders',
                'export_nomenclature'=> '/api/integration/1c/export/nomenclature',
            ],
            'locked_hint' => $enabled ? null : 'Функция входит в расширенную версию. Разблокируйте в админ-панели → Обслуживание.',
        ]);
    }

    // GET /api/integration/1c/export/orders — выгрузка заказов в формате 1С
    public static function exportOrders(array $params): void
    {
        Auth::can('orders.view');
        SettingsController::requireFeature(self::FEATURE, 'Интеграция 1С');

        $db = Connection::get();
        $orders = $db->query(
            "SELECT o.id, o.number, o.customer, o.status, o.due_date, o.created_at
             FROM orders o
             WHERE o.status NOT IN ('archived','cancelled')
             ORDER BY o.created_at DESC LIMIT 500"
        )->fetchAll();

        $items = $db->prepare(
            "SELECT oi.order_id, d.code, d.name, oi.quantity, d.unit
             FROM order_items oi JOIN details d ON d.id = oi.detail_id
             WHERE oi.order_id = :oid"
        );

        // Структура, дружественная к загрузке в 1С
        $doc = ['Документы' => []];
        foreach ($orders as $o) {
            $items->execute([':oid' => $o['id']]);
            $lines = [];
            foreach ($items->fetchAll() as $it) {
                $lines[] = [
                    'Номенклатура' => $it['name'],
                    'Артикул'      => $it['code'],
                    'Количество'   => (float)$it['quantity'],
                    'ЕдИзм'        => $it['unit'],
                ];
            }
            $doc['Документы'][] = [
                'Номер'       => $o['number'],
                'Контрагент'  => $o['customer'],
                'Статус'      => $o['status'],
                'ДатаСоздания'=> $o['created_at'],
                'СрокИсполнения' => $o['due_date'],
                'Состав'      => $lines,
            ];
        }

        json_out(['data' => $doc, 'exported_at' => date('c'), 'count' => count($orders)]);
    }

    // GET /api/integration/1c/export/nomenclature — выгрузка номенклатуры
    public static function exportNomenclature(array $params): void
    {
        Auth::can('orders.view');
        SettingsController::requireFeature(self::FEATURE, 'Интеграция 1С');

        $db = Connection::get();
        $rows = $db->query("SELECT code, name, material, unit, drawing FROM details ORDER BY code")->fetchAll();
        $nom = array_map(fn($d) => [
            'Артикул'      => $d['code'],
            'Наименование' => $d['name'],
            'Материал'     => $d['material'],
            'ЕдИзм'        => $d['unit'],
            'Чертёж'       => $d['drawing'],
        ], $rows);

        json_out(['data' => ['Номенклатура' => $nom], 'exported_at' => date('c'), 'count' => count($nom)]);
    }
}
