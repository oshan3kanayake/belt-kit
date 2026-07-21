import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

import { Role } from "../types";


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



export const getAttendanceList = onCall(
async(request)=>{


    verifyManager(request);



    const {
        employeeId,
        month
    } = request.data;



    const role =
        request.auth!.token.role;



    const branchId =
        request.auth!.token.branchId;



    let query:
    FirebaseFirestore.Query =
        db.collection("attendance");



    // Managers only see their branch

    if(role === "manager"){

        query =
        query.where(
            "branchId",
            "==",
            branchId
        );

    }



    if(employeeId){

        query =
        query.where(
            "employeeId",
            "==",
            employeeId
        );

    }



    const snapshot =
        await query.get();



    let records =
        snapshot.docs.map(doc=>({

            id:doc.id,

            ...doc.data()

        }));



    if(month){

        records =
        records.filter(
            (item:any)=>
            item.date.startsWith(month)
        );

    }



    records.sort(
        (a:any,b:any)=>
        a.date.localeCompare(b.date)
    );



    return {

        success:true,

        attendance:records

    };


});