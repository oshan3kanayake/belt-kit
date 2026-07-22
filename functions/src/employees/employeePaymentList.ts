import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

import {
    Role
} from "../types";


const db = getFirestore();



function verifyPaymentViewPermission(request:any)
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
            "You cannot view employee payments."
        );
    }

}



// GET EMPLOYEE PAYMENTS

export const getEmployeePayments =
onCall(async(request)=>{


    verifyPaymentViewPermission(request);



    const {

        employeeId,
        month

    } = request.data;



    const branchId =
        request.auth!.token.branchId;



    if(!branchId)
    {
        throw new HttpsError(
            "failed-precondition",
            "Branch not found."
        );
    }



    let query =
        db.collection("employeePayments")
        .where(
            "branchId",
            "==",
            branchId
        );



    if(employeeId)
    {
        query =
        query.where(
            "employeeId",
            "==",
            employeeId
        );
    }



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



    const payments =
        snapshot.docs.map(doc=>({

            id:doc.id,

            ...doc.data()

        }));



    return {

        success:true,

        payments

    };


});