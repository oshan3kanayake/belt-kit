import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
    getFirestore,
    FieldValue
} from "firebase-admin/firestore";

import {
    writeAudit
} from "../audit";

import {
    Role
} from "../types";


const db = getFirestore();



function verifyPaymentPermission(request: any)
{

    if (!request.auth)
    {
        throw new HttpsError(
            "unauthenticated",
            "Sign in first."
        );
    }


    const role =
        request.auth.token.role as Role | undefined;


    if (
        role !== "owner" &&
        role !== "manager" &&
        role !== "accountant"
    )
    {
        throw new HttpsError(
            "permission-denied",
            "Only owner, manager or accountant can manage payments."
        );
    }

}



// CREATE EMPLOYEE PAYMENT

export const createEmployeePayment =
onCall(async(request)=>{


    verifyPaymentPermission(request);



    const {

        employeeId,
        month,
        amountPaidMinor,
        paidDate

    } = request.data;



    if (
        !employeeId ||
        !month ||
        amountPaidMinor === undefined ||
        !paidDate
    )
    {
        throw new HttpsError(
            "invalid-argument",
            "employeeId, month, amountPaidMinor and paidDate are required."
        );
    }



    const branchId =
        request.auth!.token.branchId;



    if (!branchId)
    {
        throw new HttpsError(
            "failed-precondition",
            "Branch not found."
        );
    }



    // Check employee exists

    const employeeRef =
        db.collection("users")
        .doc(employeeId);



    const employeeSnap =
        await employeeRef.get();



    if (!employeeSnap.exists)
    {
        throw new HttpsError(
            "not-found",
            "Employee not found."
        );
    }



    const employee =
        employeeSnap.data();



    // Prevent cross-branch payment

    if (
        employee?.branchId !== branchId
    )
    {
        throw new HttpsError(
            "permission-denied",
            "Cannot create payment for another branch employee."
        );
    }



    const paymentRef =
        db.collection("employeePayments")
        .doc();



    await paymentRef.set({

        employeeId,

        branchId,

        month,

        amountPaidMinor,

        paidDate,


        createdBy:

        request.auth!.uid,


        createdAt:

        FieldValue.serverTimestamp()

    });



    await writeAudit({

        branchId,


        actorUid:

        request.auth!.uid,


        action:

        "employee.payment_created",


        entityType:

        "employeePayment",


        entityId:

        paymentRef.id,


        after:{

            employeeId,

            month,

            amountPaidMinor

        }

    });



    return {

        success:true,

        paymentId:

        paymentRef.id

    };


});