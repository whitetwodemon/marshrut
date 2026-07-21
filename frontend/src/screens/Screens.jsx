// Screens.jsx — barrel. Реальные компоненты вынесены по экранам (Этап 1).
// App.jsx импортирует отсюда — точка входа не изменилась.
export { Dashboard, DetailBoardGroup } from './Dashboard.jsx'
export { Library } from './Library.jsx'
export { OrderBuilder, WorkCenterPreview, RouteSheetView } from './OrderBuilder.jsx'
export { HistoryView, OrdersListView, ReportView, HistoryOrdersView,
         ExcelExportView, ShiftHistoryView } from './Reports.jsx'
export { WorkshopView, ModalManageWorkshops, ModalManageWorkCenters,
         WorkCentersView } from './WorkCenters.jsx'
export { WikiPage } from './Wiki.jsx'
export { Analytics } from './Analytics.jsx'
export { Integrations } from './Integrations.jsx'
