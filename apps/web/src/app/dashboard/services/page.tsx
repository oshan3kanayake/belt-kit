"use client";

import { useState } from "react";
import {
  Wrench,
  Plus,
  Pencil,
  Power,
  Sparkles,
} from "lucide-react";
import { seedServices } from "@/lib/service-seeder";
import { auth } from "@/lib/firebase";

import { useAuth } from "@/lib/auth-context";
import { useCollection } from "@/lib/useCollection";
import {
  createDoc,
  updateDocById,
  archiveDoc,
} from "@/lib/db-write";

import { ServiceType } from "@/lib/models";
import { canManageServices } from "@/lib/permissions";
import { formatMoney, toMinor } from "@/lib/format";

import {
  PageHeader,
  Modal,
  Field,
  DataTable,
  Column,
  EmptyState,
  Badge,
  useToast,
} from "@/components/ui";



export default function ServicesPage() {
  

  const { branchId, role } = useAuth();

   console.log("UID:", auth.currentUser?.uid);
  console.log("Role:", role);
  console.log("Branch:", branchId);

  const {
    data: services,
    loading,
  } = useCollection<ServiceType>("services");


  const { notify } = useToast();


  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] =
    useState<(ServiceType & { id:string }) | null>(null);


  const [saving,setSaving] = useState(false);


  const canEdit = canManageServices(role);



  // ---------------- Starter Services ----------------

async function createStarterServices(){

 if(!branchId) return;

 try{

   await seedServices(branchId);

   notify("Starter services created");

 }catch(error){

   console.error(error);

   notify(String(error),"error");

 }

}




  async function handleSave(form:FormData){

    if(!branchId) return;


    setSaving(true);



    const payload = {

      name:
        String(form.get("name") || "")
        .trim(),


      defaultPriceMinor:
        toMinor(
          String(form.get("price") || "0")
        ),


      estimatedDays:
        Number(form.get("days") || 1),


      // FIX: keep disabled service disabled
      active:
        editing?.active ?? true,

    };



    if(!payload.name){

      notify(
        "Service name is required",
        "error"
      );

      setSaving(false);

      return;
    }



    const duplicate =
      services.some(
        s =>
          s.name.toLowerCase()
          ===
          payload.name.toLowerCase()
          &&
          s.id !== editing?.id
      );


    if(duplicate){

      notify(
        "Service already exists",
        "error"
      );


      setSaving(false);

      return;

    }



    try{


      if(editing){

        await updateDocById(
          "services",
          editing.id,
          payload
        );


        notify(
          "Service updated"
        );


      }else{


        await createDoc(
          "services",
          branchId,
          payload
        );


        notify(
          "Service created"
        );

      }


      setModalOpen(false);


   }catch(error){

      console.error(
        "SERVICE SAVE ERROR:",
        error
      );


      notify(
        String(error),
        "error"
      );

    }finally{

      setSaving(false);

    }

  }





  async function toggleActive(
    service: ServiceType & {id:string}
  ){

    await updateDocById(
      "services",
      service.id,
      {
        active: !service.active
      }
    );


    notify(
      service.active
      ? "Service disabled"
      : "Service enabled"
    );

  }





  async function archiveService(
    id:string
  ){

    await archiveDoc(
      "services",
      id
    );


    notify(
      "Service archived"
    );

  }





  const columns:
    Column<ServiceType & {id:string}>[] =
  [

    {

      key:"name",

      header:"Service",

      sortValue:(s)=>s.name,

      cell:(s)=>(

        <div>

          <p className="font-medium text-ink">
            {s.name}
          </p>


          <p className="text-xs text-ink-faint">
            {s.estimatedDays} day estimate
          </p>

        </div>

      )

    },


    {

      key:"price",

      header:"Default Price",

      sortValue:(s)=>
        s.defaultPriceMinor,


      cell:(s)=>(

        <span className="font-medium">

          {formatMoney(
            s.defaultPriceMinor
          )}

        </span>

      )

    },


    {

      key:"status",

      header:"Status",

      cell:(s)=>(

        s.active ?

        <Badge tone="green">
          Active
        </Badge>

        :

        <Badge tone="amber">
          Disabled
        </Badge>

      )

    }

  ];





  return (

    <div className="mx-auto max-w-6xl">


      <PageHeader

        eyebrow="Catalogue"

        title="Services"

        icon={Wrench}


        action={

          canEdit && (

            <div className="flex gap-3">


              <button

                className="btn-ghost"

                onClick={createStarterServices}

              >

                <Sparkles size={18}/>

                Starter Services

              </button>



              <button

                className="btn-primary"

                onClick={()=>{

                  setEditing(null);

                  setModalOpen(true);

                }}

              >

                <Plus size={18}/>

                New Service

              </button>


            </div>

          )

        }

      />





      {
        loading ? (

          <p className="text-sm text-ink-soft">
            Loading services...
          </p>

        )

        :

        services.length === 0 ? (

          <EmptyState

            icon={Wrench}

            title="No services yet"

            hint="Create services like Full Service, Repair, Paint."

          />

        )


        :


        (

          <DataTable

            rows={services}

            columns={columns}


            rowActions={

              canEdit

              ?

              (service)=>(

                <>


                <button

                  className="rounded-lg p-2 text-ink-faint hover:text-burgundy-600"

                  onClick={()=>{

                    setEditing(service);

                    setModalOpen(true);

                  }}

                >

                  <Pencil size={15}/>

                </button>



                <button

                  className="rounded-lg p-2 text-ink-faint hover:text-burgundy-600"

                  onClick={()=>toggleActive(service)}

                >

                  <Power size={15}/>

                </button>



                <button

                  className="rounded-lg px-2 text-xs text-rose-600"

                  onClick={()=>archiveService(service.id)}

                >

                  Archive

                </button>


                </>

              )

              :

              undefined

            }


          />

        )

      }






      <Modal

        open={modalOpen}

        onClose={()=>setModalOpen(false)}

        title={
          editing
          ? "Edit Service"
          : "New Service"
        }

      >


        <form

          className="space-y-4"

          onSubmit={(e)=>{

            e.preventDefault();

            handleSave(
              new FormData(
                e.currentTarget
              )
            );

          }}

        >


          <Field

            label="Service name"

            required

          >

            <input

              name="name"

              defaultValue={
                editing?.name
              }

              className="input-luxe"

              placeholder="Full Service"

            />

          </Field>





          <Field

            label="Default price (LKR)"

          >

            <input

              name="price"

              defaultValue={

                editing

                ?

                (
                  editing.defaultPriceMinor / 100
                ).toString()

                :

                ""

              }

              className="input-luxe"

              placeholder="25000"

              inputMode="decimal"

            />

          </Field>





          <Field

            label="Estimated days"

          >

            <input

              name="days"

              type="number"

              min="1"

              defaultValue={
                editing?.estimatedDays ?? 1
              }

              className="input-luxe"

            />

          </Field>





          <div className="flex justify-end gap-3 pt-3">


            <button

              type="button"

              className="btn-ghost"

              onClick={()=>
                setModalOpen(false)
              }

            >

              Cancel

            </button>



            <button

              disabled={saving}

              className="btn-primary"

            >

              {
                saving
                ?
                "Saving..."
                :
                editing
                ?
                "Save Changes"
                :
                "Create Service"
              }

            </button>


          </div>



        </form>



      </Modal>



    </div>

  );

}