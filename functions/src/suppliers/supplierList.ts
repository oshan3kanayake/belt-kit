/**
 * BELT-KIT — Supplier Management
 *
 * Handles:
 * - Getting supplier list
 * - Permission validation
 * - Branch isolation
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";

import {
    getFirestore
} from "firebase-admin/firestore";

import {
    Role
} from "../types";


const db = getFirestore();


// ------------------------------------------------
// Permission Check
// ------------------------------------------------

function verifySupplierViewer(request: any) {


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
            "Only owner or manager can view suppliers"
        );

    }

}



// ------------------------------------------------
// GET SUPPLIER LIST
// ------------------------------------------------

export const getSupplierList = onCall(
async (request) => {


    verifySupplierViewer(request);



    const role =
        request.auth!.token.role;



    const branchId =
        request.auth!.token.branchId;



    if (
        role === "manager" &&
        !branchId
    ) {

        throw new HttpsError(
            "failed-precondition",
            "Branch information missing"
        );

    }



    let query:
        FirebaseFirestore.Query =
            db.collection("suppliers");



    // --------------------------------------------
    // Manager can only view own branch suppliers
    // Owner can view all suppliers
    // --------------------------------------------

    if (role === "manager") {

        query =
            query.where(
                "branchId",
                "==",
                branchId
            );

    }



    const snapshot =
        await query.get();



    let suppliers =
        snapshot.docs.map(doc => ({

            id: doc.id,

            ...doc.data()

        }));



    // Sort alphabetically

    suppliers.sort(
        (a: any, b: any) =>
            a.name.localeCompare(b.name)
    );



    return {

        success: true,

        suppliers

    };


});