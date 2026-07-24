/**
 * BELT-KIT — Cloud Functions entry point.
 * Initializes the Admin SDK once, then re-exports every function so Firebase
 * can discover them. Add new function files here as the backend grows.
 */

import { initializeApp } from "firebase-admin/app";

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
initializeApp(projectId ? { projectId } : undefined);

// User & role management (RBAC backbone)
export { setUserRole, bootstrapFirstOwner } from "./users";

// Job card triggers (audit on status change)
export { onJobCardStatusChange } from "./jobCards";

// Billing (server-side invoice generation)
export { generateInvoice } from "./billing";

// Employee management
export {
    createEmployee,
    updateEmployee,
    assignEmployeeRole
} from "./employees/employees";


export {
    getEmployees
} from "./employees/employeeList";


export {
    createEmployeePayment
} from "./employees/employeePayments";

export {
    getEmployeePayments
} from "./employees/employeePaymentList";

export {
    getEmployeePaymentHistory
} from "./employees/employeePaymentHistory";

// Employee attendance
export {
    createAttendance
} from "./employees/attendance";

export {
    getAttendanceList
} from "./employees/attendanceList";

export {
    getAttendanceSummary
} from "./employees/attendanceSummary";

export {
  downloadAttendanceReport,
} from "./employees/attendanceReportPdf";

export {
createSupplier
}
from "./suppliers/supplierCreate";


export {
getSupplierList
}
from "./suppliers/supplierList";


export {
createPurchaseOrder
}
from "./suppliers/purchaseOrderCreate";


export {
createSupplierPayment
}
from "./suppliers/supplierPaymentCreate";


export {
getSupplierSummary
}
from "./suppliers/supplierSummary";

export {
  notifyLowStock,
} from "./notifications/notifyLowStock";

export {
  createServiceReminder,
} from "./notifications/createServiceReminder";

export {
  processServiceReminders,
} from "./notifications/processServiceReminders";

export {
  markNotificationRead,
} from "./notifications/markNotificationRead";

export {
  markAllNotificationsRead,
} from "./notifications/markAllNotificationsRead";

export {
  notifyEmployeeOnLeave,
} from "./notifications/notifyEmployeeOnLeave";
