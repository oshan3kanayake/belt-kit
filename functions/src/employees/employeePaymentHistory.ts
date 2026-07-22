import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

import {
    Role
} from "../types";


const db = getFirestore();



function verifyPaymentHistoryPermission(request:any)
{

    if(!request.auth)
    {
        throw new HttpsError(
            "unauthenticated",
            "Sign in first."
        );
    }


    const role =
        request.auth.token.role as Role | undefined;


    if(
        role !== "owner" &&
        role !== "manager" &&
        role !== "accountant"
    )
    {
        throw new HttpsError(
            "permission-denied",
            "You cannot view payment history."
        );
    }

}



// GET EMPLOYEE PAYMENT HISTORY

export const getEmployeePaymentHistory =
onCall(async(request)=>{


    verifyPaymentHistoryPermission(request);



    const {
        employeeId,
        month
    } = request.data;



    if(!employeeId)
    {
        throw new HttpsError(
            "invalid-argument",
            "employeeId is required."
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



    // Verify employee

    const employeeSnap =
        await db
        .collection("users")
        .doc(employeeId)
        .get();



    if(!employeeSnap.exists)
    {
        throw new HttpsError(
            "not-found",
            "Employee not found."
        );
    }



    const employee =
        employeeSnap.data();



    if(
        employee?.branchId !== branchId
    )
    {
        throw new HttpsError(
            "permission-denied",
            "Employee belongs to another branch."
        );
    }



    let query =
        db.collection("employeePayments")
        .where(
            "employeeId",
            "==",
            employeeId
        )
        .where(
            "branchId",
            "==",
            branchId
        );



    if(month)
    {
        query =
        query.where(
            "month",
            "==",
            month
        );
    }



    const snapshot =
        await query.get();



    let totalPaidMinor = 0;



    const payments =
        snapshot.docs.map(doc=>{

            const data =
                doc.data();


            totalPaidMinor +=
                data.amountPaidMinor;


            return {

                id:doc.id,

                ...data

            };

        });



    return {

        success:true,

        employeeId,

        payments,

        totalPaidMinor

    };


});