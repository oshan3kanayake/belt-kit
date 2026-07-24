/**
 * BELT-KIT — Cloud Functions entry point.
 * Initializes the Admin SDK once, then re-exports every function so Firebase
 * can discover them. Add new function files here as the backend grows.
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

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