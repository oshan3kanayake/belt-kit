/**
 * BELT-KIT — Supplier Purchase Orders
 *
 * Handles:
 * - Creating supplier purchase orders
 * - Permission validation
 * - Branch isolation
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


// ------------------------------------------------
// Types
// ------------------------------------------------

interface PurchaseItem {

    name: string;

    quantity: number;

    cost: number;

}


interface PurchaseOrderData {

    supplierId: string;

    items: PurchaseItem[];

    orderDate: string;

}



// ------------------------------------------------
// Permission
// ------------------------------------------------

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
            "Only owner or manager allowed"
        );

    }

}



// ------------------------------------------------
// CREATE PURCHASE ORDER
// ------------------------------------------------

export const createPurchaseOrder = onCall(
async(request)=>{


    verifyManager(request);



    const data =
        request.data as PurchaseOrderData;



    const {
        supplierId,
        items,
        orderDate
    } = data;



    if(
        !supplierId ||
        !items ||
        items.length === 0 ||
        !orderDate
    ){

        throw new HttpsError(
            "invalid-argument",
            "Missing purchase order data"
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



    // Branch protection

    if(
        supplier?.branchId !== branchId
        &&
        request.auth!.token.role === "manager"
    ){

        throw new HttpsError(
            "permission-denied",
            "Cannot create order for another branch supplier"
        );

    }



    let totalAmount = 0;


    items.forEach(item=>{

        totalAmount +=
            item.quantity * item.cost;

    });



    const orderRef =
        await db
        .collection("purchaseOrders")
        .add({

            supplierId,

            branchId:
                supplier?.branchId,


            items,


            totalAmount,


            orderDate,


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
            "purchaseOrder.created",


        entityType:
            "purchaseOrder",


        entityId:
            orderRef.id,


        after:{
            supplierId,
            totalAmount
        }

    });



    return {

        success:true,

        purchaseOrderId:
            orderRef.id

    };


});