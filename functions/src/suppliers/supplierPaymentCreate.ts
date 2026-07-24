/**
 * BELT-KIT — Supplier Payments
 *
 * Handles:
 * - Recording supplier payments
 * - Audit logging
 */

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



function verifyManager(request:any){


    if(!request.auth){

        throw new HttpsError(
            "unauthenticated",
            "Authentication required"
        );

    }


    const role =
        request.auth.token.role as Role;


    if(
        role !== "owner" &&
        role !== "manager"
    ){

        throw new HttpsError(
            "permission-denied",
            "Not allowed"
        );

    }

}



// ------------------------------------------------
// CREATE PAYMENT
// ------------------------------------------------

export const createSupplierPayment = onCall(
async(request)=>{


    verifyManager(request);



    const {
        supplierId,
        amount,
        paymentDate,
        note
    } = request.data;



    if(
        !supplierId ||
        !amount ||
        !paymentDate
    ){

        throw new HttpsError(
            "invalid-argument",
            "Payment details missing"
        );

    }



    const branchId =
        request.auth!.token.branchId;



    const supplierSnap =
        await db
        .collection("suppliers")
        .doc(supplierId)
        .get();



    if(!supplierSnap.exists){

        throw new HttpsError(
            "not-found",
            "Supplier not found"
        );

    }



    const supplier =
        supplierSnap.data();



    if(
        supplier?.branchId !== branchId &&
        request.auth!.token.role === "manager"
    ){

        throw new HttpsError(
            "permission-denied",
            "Cannot pay another branch supplier"
        );

    }



    const paymentRef =
        await db
        .collection("supplierPayments")
        .add({

            supplierId,


            branchId:
                supplier?.branchId,


            amount,


            paymentDate,


            note:
                note || "",


            createdAt:
                FieldValue.serverTimestamp(),


            createdByUid:
                request.auth!.uid

        });



    await writeAudit({

        branchId,


        actorUid:
            request.auth!.uid,


        action:
            "supplierPayment.created",


        entityType:
            "supplierPayment",


        entityId:
            paymentRef.id,


        after:{
            supplierId,
            amount
        }

    });



    return {

        success:true,

        paymentId:
            paymentRef.id

    };


});