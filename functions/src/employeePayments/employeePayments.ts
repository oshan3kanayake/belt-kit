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



function verifyPaymentPermission(request:any)
{

    if(!request.auth)
    {
        throw new HttpsError(
            "unauthenticated",
            "Sign in first."
        );
    }


    const role =
        request.auth.token.role as Role;


    if(
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



// CREATE PAYMENT

export const createEmployeePayment =
onCall(async(request)=>{


    verifyPaymentPermission(request);



    const {

        employeeId,
        month,
        amountPaidMinor,
        paidDate

    } = request.data;



    if(
        !employeeId ||
        !month ||
        !amountPaidMinor ||
        !paidDate
    )
    {
        throw new HttpsError(
            "invalid-argument",
            "Missing payment data."
        );
    }



    const branchId =
        request.auth!.token.branchId;



    if(!branchId)
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



    if(!employeeSnap.exists)
    {
        throw new HttpsError(
            "not-found",
            "Employee not found."
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