import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
    getFirestore,
    FieldValue
} from "firebase-admin/firestore";
import {
    getAuth
} from "firebase-admin/auth";

import {
    writeAudit
} from "../audit";

const db = getFirestore();


type EmployeeRole =
    | "owner"
    | "manager"
    | "advisor"
    | "technician"
    | "accountant";


interface EmployeeData {

    email: string;

    password: string;

    fullName: string;

    role: EmployeeRole;

    phone?: string;

    salaryMinor?: number;

    joinDate?: string;

}


const ALLOWED_ROLES: EmployeeRole[] = [
    "owner",
    "manager",
    "advisor",
    "technician",
    "accountant"
];


// Owner and Manager only
function verifyEmployeeManager(request: any) {

    if (!request.auth) {

        throw new HttpsError(
            "unauthenticated",
            "User is not authenticated"
        );
    }


    const role =
        request.auth.token.role;


    if (
        role !== "owner" &&
        role !== "manager"
    ) {

        throw new HttpsError(
            "permission-denied",
            "Only owner or manager can manage employees"
        );
    }

}



// CREATE EMPLOYEE

export const createEmployee = onCall(
async(request)=>{


    verifyEmployeeManager(request);


    const data =
        request.data as EmployeeData;


    const {
        email,
        password,
        fullName,
        role,
        phone,
        salaryMinor,
        joinDate

    } = data;



    if(
        !email ||
        !password ||
        !fullName ||
        !role
    ){

        throw new HttpsError(
            "invalid-argument",
            "Missing employee data"
        );
    }



    if(
        !ALLOWED_ROLES.includes(role)
    ){

        throw new HttpsError(
            "invalid-argument",
            "Invalid employee role"
        );

    }



    const callerRole =
        request.auth!.token.role;


    // Manager cannot create owner

    if(
        callerRole === "manager" &&
        role === "owner"
    ){

        throw new HttpsError(
            "permission-denied",
            "Managers cannot create owners"
        );

    }



    const branchId =
        request.auth!.token.branchId;



    if(!branchId){

        throw new HttpsError(
            "failed-precondition",
            "Branch not found"
        );

    }



    let user;



    try {


        user =
        await getAuth()
        .createUser({

            email,

            password,

            displayName:
            fullName

        });



        await getAuth()
        .setCustomUserClaims(

            user.uid,

            {
                role,

                branchId
            }

        );



        await db
        .collection("users")
        .doc(user.uid)
        .set({

            uid:user.uid,

            fullName,

            email,

            role,

            branchId,

            phone:
            phone ?? null,


            salaryMinor:
            salaryMinor ?? 0,


            joinDate:
            joinDate ?? null,


            active:true,

            archived:false,


            createdAt:
            FieldValue.serverTimestamp(),


            createdBy:
            request.auth!.uid

        });



        await writeAudit({

            branchId,

            actorUid:
            request.auth!.uid,


            action:
            "employee.created",


            entityType:
            "user",


            entityId:
            user.uid,


            after:{
                fullName,
                role,
                branchId
            }

        });



        return {

            success:true,

            employeeId:user.uid

        };


    }
    catch(error){


        if(user){

            await getAuth()
            .deleteUser(user.uid);

        }


        throw new HttpsError(
            "internal",
            "Failed to create employee"
        );

    }


});




// UPDATE EMPLOYEE

export const updateEmployee = onCall(
async(request)=>{


    verifyEmployeeManager(request);



    const {
        employeeId,
        updates

    } = request.data;



    if(
        !employeeId ||
        !updates
    ){

        throw new HttpsError(
            "invalid-argument",
            "Invalid employee data"
        );

    }



    const employeeRef =
        db.collection("users")
        .doc(employeeId);



    const snapshot =
        await employeeRef.get();



    if(!snapshot.exists){

        throw new HttpsError(
            "not-found",
            "Employee not found"
        );

    }



    const before =
        snapshot.data();



    const allowedFields = [

        "fullName",
        "phone",
        "salaryMinor",
        "joinDate",
        "active",
        "archived"

    ];



    const safeUpdates:any = {};



    allowedFields.forEach(field=>{

        if(
            updates[field] !== undefined
        ){

            safeUpdates[field] =
                updates[field];

        }

    });



    await employeeRef.update({

        ...safeUpdates,

        updatedAt:
        FieldValue.serverTimestamp()

    });



    await writeAudit({

        branchId:
        request.auth!.token.branchId,


        actorUid:
        request.auth!.uid,


        action:
        "employee.updated",


        entityType:
        "user",


        entityId:
        employeeId,


        before,


        after:
        safeUpdates

    });



    return {
        success:true
    };


});




// ASSIGN ROLE

export const assignEmployeeRole =
onCall(async(request)=>{


    verifyEmployeeManager(request);



    const {
        employeeId,
        role

    } = request.data;



    if(
        !employeeId ||
        !role
    ){

        throw new HttpsError(
            "invalid-argument",
            "Invalid role data"
        );

    }



    if(
        !ALLOWED_ROLES.includes(role)
    ){

        throw new HttpsError(
            "invalid-argument",
            "Invalid role"
        );

    }



    const branchId =
        request.auth!.token.branchId;



    const employeeRef =
        db.collection("users")
        .doc(employeeId);



    const snapshot =
        await employeeRef.get();



    if(!snapshot.exists){

        throw new HttpsError(
            "not-found",
            "Employee not found"
        );

    }



    const oldRole =
        snapshot.data()?.role;



    await employeeRef.update({

        role,

        updatedAt:
        FieldValue.serverTimestamp()

    });



    await getAuth()
    .setCustomUserClaims(

        employeeId,

        {

            role,

            branchId

        }

    );



    await writeAudit({

        branchId,

        actorUid:
        request.auth!.uid,


        action:
        "employee.role_updated",


        entityType:
        "user",


        entityId:
        employeeId,


        before:{
            role:oldRole
        },


        after:{
            role
        }

    });



    return {
        success:true
    };


});