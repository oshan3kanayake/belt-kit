/**
 * BELT-KIT — Employee Attendance Management
 *
 * Handles:
 * - Creating employee attendance records
 * - Permission validation
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

type AttendanceStatus =
    | "present"
    | "on_leave";


interface AttendanceData {

    employeeId: string;

    date: string;

    status: AttendanceStatus;

}



// ------------------------------------------------
// Permission check
// ------------------------------------------------

function verifyAttendanceManager(request: any) {


    if (!request.auth) {

        throw new HttpsError(
            "unauthenticated",
            "User is not authenticated"
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
            "Only owner or manager can manage attendance"
        );

    }

}



// ------------------------------------------------
// CREATE ATTENDANCE
// ------------------------------------------------

export const createAttendance = onCall(
async(request)=>{


    verifyAttendanceManager(request);



    const data =
        request.data as AttendanceData;



    const {

        employeeId,

        date,

        status

    } = data;



    if (
        !employeeId ||
        !date ||
        !status
    ) {

        throw new HttpsError(
            "invalid-argument",
            "Missing attendance data"
        );

    }



    if (
        status !== "present" &&
        status !== "on_leave"
    ) {

        throw new HttpsError(
            "invalid-argument",
            "Invalid attendance status"
        );

    }



    const branchId =
        request.auth!.token.branchId;



    if (!branchId) {

        throw new HttpsError(
            "failed-precondition",
            "Branch not found"
        );

    }



    // Check employee exists

    const employeeSnapshot =
        await db
        .collection("users")
        .doc(employeeId)
        .get();



    if (!employeeSnapshot.exists) {

        throw new HttpsError(
            "not-found",
            "Employee not found"
        );

    }



    const employee =
        employeeSnapshot.data();



    // Prevent cross branch access

    if (
        employee?.branchId !== branchId
    ) {

        throw new HttpsError(
            "permission-denied",
            "Cannot manage employee from another branch"
        );

    }



    const attendanceRef =
        db.collection("attendance")
        .doc();



    await attendanceRef.set({

        employeeId,

        branchId,

        date,

        status,


        createdAt:
        FieldValue.serverTimestamp(),


        createdByUid:
        request.auth!.uid,


        updatedAt:
        FieldValue.serverTimestamp()

    });



    await writeAudit({

        branchId,


        actorUid:
        request.auth!.uid,


        action:
        "attendance.created",


        entityType:
        "attendance",


        entityId:
        attendanceRef.id,


        after: {

            employeeId,

            date,

            status

        }

    });



    return {

        success:true,

        attendanceId:
        attendanceRef.id

    };


});