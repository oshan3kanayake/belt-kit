/**
 * BELT-KIT — Supplier Summary
 *
 * Calculates supplier balance
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";

import {
    getFirestore
} from "firebase-admin/firestore";

import {
    Role
} from "../types";


const db =
    getFirestore();



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




export const getSupplierSummary =
onCall(async(request)=>{


    verifyManager(request);



    const {
        supplierId
    } = request.data;



    if(!supplierId){

        throw new HttpsError(
            "invalid-argument",
            "Supplier required"
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
            "Cannot view another branch supplier"
        );

    }



    const orders =
        await db
        .collection("purchaseOrders")
        .where(
            "supplierId",
            "==",
            supplierId
        )
        .get();



    const payments =
        await db
        .collection("supplierPayments")
        .where(
            "supplierId",
            "==",
            supplierId
        )
        .get();



    let totalPurchased = 0;

    let totalPaid = 0;



    orders.docs.forEach(doc=>{

        totalPurchased +=
            doc.data().totalAmount || 0;

    });



    payments.docs.forEach(doc=>{

        totalPaid +=
            doc.data().amount || 0;

    });



    return {


        success:true,


        supplierId,


        supplierName:
            supplier?.name,


        totalPurchased,


        totalPaid,


        outstanding:

            totalPurchased - totalPaid


    };


});