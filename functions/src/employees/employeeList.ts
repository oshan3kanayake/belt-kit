import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Query } from "firebase-admin/firestore";
import { Role, UserProfile } from "../types";


const db = getFirestore();


export const getEmployees = onCall(async (request) => {


    const caller = request.auth;


    if (!caller) {

        throw new HttpsError(
            "unauthenticated",
            "You must be signed in."
        );

    }


    const role =
        caller.token.role as Role | undefined;


    const branchId =
        caller.token.branchId as string | undefined;



    if (
        role !== "owner" &&
        role !== "manager"
    ) {

        throw new HttpsError(
            "permission-denied",
            "Only owner or manager can view employees."
        );

    }



let query: Query =
    db.collection("users");



    // Manager only sees own branch

    if (role === "manager") {


        if (!branchId) {

            throw new HttpsError(
                "failed-precondition",
                "Branch not found."
            );

        }


        query =
            query.where(
                "branchId",
                "==",
                branchId
            );

    }



    const snapshot =
        await query.get();



    const employees =
        snapshot.docs.map(doc => {


            const data =
                doc.data() as UserProfile;


            return {

                id: doc.id,

                ...data

            };


        });



    return {

        success:true,

        employees

    };


});