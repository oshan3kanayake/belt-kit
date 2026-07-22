import { createDoc } from "./db-write";


const STARTER_SERVICES = [
  {
    name: "Body Wash",
    defaultPriceMinor: 500000,
    estimatedDays: 1,
    active: true,
  },
  {
    name: "Full Service",
    defaultPriceMinor: 1500000,
    estimatedDays: 2,
    active: true,
  },
  {
    name: "Repair",
    defaultPriceMinor: 2500000,
    estimatedDays: 5,
    active: true,
  },
  {
    name: "Paint",
    defaultPriceMinor: 5000000,
    estimatedDays: 7,
    active: true,
  },
  {
    name: "Body Modification",
    defaultPriceMinor: 10000000,
    estimatedDays: 10,
    active: true,
  },
  {
    name: "Tinkering",
    defaultPriceMinor: 3000000,
    estimatedDays: 4,
    active: true,
  },
];


export async function seedServices(branchId:string){

  for(const service of STARTER_SERVICES){

    await createDoc(
      "services",
      branchId,
      service
    );

  }

}