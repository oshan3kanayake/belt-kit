import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { writeAudit } from "../audit";
import { Role } from "../types";


const db = getFirestore();


type AttendanceStatus =
    | "present"
    | "on_leave";


interface AttendanceData {

    employeeId: string;

    date: string;

    status: AttendanceStatus;

    note?: string;

}


// ------------------------------------
// Permission
// ------------------------------------

function verifyAttendanceManager(request:any) {


    if (!request.auth) {

        throw new HttpsError(
            "unauthenticated",
            "Authentication required"
        );

    }


    const role =
        request.auth.token.role as Role;


    if (
        role !== "owner" &&
        role !== "manager"
    ){

        throw new HttpsError(
            "permission-denied",
            "Only owner or manager allowed"
        );

    }

}


// ------------------------------------
// CREATE ATTENDANCE
// ------------------------------------

export const createAttendance = onCall(
async(request)=>{


    verifyAttendanceManager(request);



    const data =
        request.data as AttendanceData;



    const {
        employeeId,
        date,
        status,
        note
    } = data;



    if(
        !employeeId ||
        !date ||
        !status
    ){

        throw new HttpsError(
            "invalid-argument",
            "Missing attendance data"
        );

    }



    const branchId =
        request.auth!.token.branchId;



    const employeeRef =
        db.collection("users")
        .doc(employeeId);



    const employeeSnap =
        await employeeRef.get();



    if(!employeeSnap.exists){

        throw new HttpsError(
            "not-found",
            "Employee not found"
        );

    }



    const employee =
        employeeSnap.data();



    // Attendance is always managed within the authenticated active branch.
    if(
        employee?.branchId !== branchId
    ){

        throw new HttpsError(
            "permission-denied",
            "Cannot manage employee from another branch"
        );

    }



    const attendanceRef =
        db.collection("attendance")
        .doc(
            `${employeeId}_${date}`
        );



    const existing =
        await attendanceRef.get();



    const attendanceData = {


        employeeId,

        branchId:
            employee?.branchId,


        date,

        status,

        note: note || "",


        updatedAt:
            FieldValue.serverTimestamp()


    };



    if(existing.exists){


        await attendanceRef.update(
            attendanceData
        );


    }
    else{


        await attendanceRef.set({

            ...attendanceData,


            createdAt:
                FieldValue.serverTimestamp(),


            createdByUid:
                request.auth!.uid

        });


    }



    await writeAudit({

        branchId:
            employee?.branchId,


        actorUid:
            request.auth!.uid,


        action:
            existing.exists
            ?
            "attendance.updated"
            :
            "attendance.created",


        entityType:
            "attendance",


        entityId:
            attendanceRef.id,


        after:
            attendanceData

    });



    return {

        success:true,

        attendanceId:
            attendanceRef.id,

        operation:
            existing.exists
            ? "updated"
            : "created"

    };


});
