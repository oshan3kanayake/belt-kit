/**
 * BELT-KIT — Supplier Management
 *
 * Handles:
 * - Creating suppliers
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

interface SupplierData {

    name: string;

    phone?: string;

    email?: string;

}



// ------------------------------------------------
// Permission Check
// ------------------------------------------------

function verifySupplierManager(request: any) {


    if (!request.auth) {

        throw new HttpsError(
            "unauthenticated",
            "Authentication required"
        );

    }



    const role =
        request.auth.token.role as Role | undefined;



    if (
        role !== "owner" &&
        role !== "manager"
    ) {

        throw new HttpsError(
            "permission-denied",
            "Only owner or manager can manage suppliers"
        );

    }

}



// ------------------------------------------------
// CREATE SUPPLIER
// ------------------------------------------------

export const createSupplier = onCall(
async (request) => {


    verifySupplierManager(request);



    const data =
        request.data as SupplierData;



    const {
        name,
        phone,
        email
    } = data;



    if (!name) {

        throw new HttpsError(
            "invalid-argument",
            "Supplier name is required"
        );

    }



    const branchId =
        request.auth!.token.branchId;



    if (!branchId) {

        throw new HttpsError(
            "failed-precondition",
            "Branch information missing"
        );

    }



    // --------------------------------------------
    // Create supplier document
    // --------------------------------------------

    const supplierRef =
        await db
        .collection("suppliers")
        .add({

            name,

            phone: phone || "",

            email: email || "",


            branchId,


            createdAt:
                FieldValue.serverTimestamp(),


            updatedAt:
                FieldValue.serverTimestamp(),


            createdByUid:
                request.auth!.uid

        });



    // --------------------------------------------
    // Audit Log
    // --------------------------------------------

    await writeAudit({

        branchId,


        actorUid:
            request.auth!.uid,


        action:
            "supplier.created",


        entityType:
            "supplier",


        entityId:
            supplierRef.id,


        after: {

            name,

            phone: phone || "",

            email: email || ""

        }

    });



    return {

        success: true,


        supplierId:
            supplierRef.id

    };


});