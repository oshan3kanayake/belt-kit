/**
 * Small, reviewable workshop knowledge base used for local retrieval.
 * These are reference notes, not canned bot answers. Add only material the
 * workshop is permitted to use, then replace/extend this set with approved
 * manuals and internal procedures.
 */
export type KnowledgeArticle = {
  id: string;
  title: string;
  content: string;
};

export const WORKSHOP_KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: "engine-light-basics",
    title: "Check-engine light: safe first checks",
    content:
      "First confirm whether the check-engine light is flashing or steady. A flashing light, loss of power, strong fuel smell, overheating, or severe vibration requires stopping the vehicle and checking for damage before further driving. Read and record diagnostic trouble codes before clearing them. Inspect battery voltage, loose intake hoses, obvious wiring damage, fluid levels, and recent repair work. A code identifies a system, not automatically the failed part.",
  },
  {
    id: "rough-idle",
    title: "Rough idle diagnostic sequence",
    content:
      "For rough idle, establish whether the issue occurs cold, warm, under load, or with air conditioning on. Check for stored codes and freeze-frame data. Inspect for vacuum leaks, intake duct splits, ignition misfire data, spark plug and coil condition, fuel trim values, throttle body contamination, and battery/charging voltage. Do not replace ignition or fuel components only from a code; confirm with measured data or swap testing where appropriate.",
  },
  {
    id: "brake-noise",
    title: "Brake noise and vibration inspection",
    content:
      "Before brake work, confirm pedal feel, warning lamps, pulling, heat, and whether noise is only while braking. Raise and support the vehicle safely. Inspect pad thickness, uneven wear, rotor scoring or runout, caliper slide movement, hardware, brake hoses, leaks, and wheel bearing play. Never use compressed air to clean brake dust. Torque wheel fasteners to the vehicle manufacturer's specification.",
  },
  {
    id: "service-checklist",
    title: "Routine service verification",
    content:
      "For a routine service, verify the vehicle identification, engine oil grade and capacity from the approved manufacturer source, filter fitment, drain-plug washer condition, coolant level, brake fluid condition, tyre pressures, lights, wipers, belts, and visible leaks. Record mileage and reset the service reminder only after service work is complete. Check for existing warnings before returning the vehicle.",
  },
  {
    id: "hybrid-safety",
    title: "Hybrid and high-voltage safety",
    content:
      "High-voltage hybrid systems require trained personnel and the manufacturer isolation procedure. Do not touch orange cables or high-voltage components without appropriate training, PPE, and lockout procedures. A technician should escalate high-voltage fault, battery, inverter, or insulation warnings to qualified staff.",
  },
  {
    id: "parts-control",
    title: "Parts and inventory control",
    content:
      "Confirm part number, vehicle fitment, quantity, and stock availability before promising a repair. If stock is low or unavailable, state that clearly and suggest checking approved suppliers. Do not claim a part is compatible without a verified catalogue or manufacturer reference.",
  },
];
