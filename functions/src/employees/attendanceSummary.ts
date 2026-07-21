import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

import { Role } from "../types";


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



export const getAttendanceSummary =
onCall(async(request)=>{


    verifyManager(request);



    const {
        employeeId,
        month
    } =
    request.data;



    if(
        !employeeId ||
        !month
    ){

        throw new HttpsError(
            "invalid-argument",
            "Employee and month required"
        );

    }



    const employeeSnap =
        await db
        .collection("users")
        .doc(employeeId)
        .get();



    if(!employeeSnap.exists){

        throw new HttpsError(
            "not-found",
            "Employee not found"
        );

    }



    const employee =
        employeeSnap.data();


if(!employee){

    throw new HttpsError(
        "not-found",
        "Employee data missing"
    );

}



    const role =
        request.auth!.token.role;



    const managerBranch =
        request.auth!.token.branchId;



    // Branch protection

    if(
        role === "manager" &&
        employee?.branchId !== managerBranch
    ){

        throw new HttpsError(
            "permission-denied",
            "Cannot view another branch employee"
        );

    }



    const snapshot =
        await db
        .collection("attendance")
        .where(
            "employeeId",
            "==",
            employeeId
        )
        .where(
            "branchId",
            "==",
            employee.branchId
        )
        .get();



    let presentDays=0;

    let leaveDays=0;



    snapshot.docs.forEach(doc=>{


        const data =
            doc.data();



        if(
            !data.date.startsWith(month)
        ){

            return;

        }



        if(
            data.status==="present"
        ){

            presentDays++;

        }



        if(
            data.status==="on_leave"
        ){

            leaveDays++;

        }


    });



    return {


        success:true,


        employeeId,


        month,


        presentDays,


        leaveDays,


        totalDays:
            presentDays + leaveDays


    };


});