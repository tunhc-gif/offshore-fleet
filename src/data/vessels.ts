import { JubVessel } from "@/data/jubVessels";
import jubBase from "./jubVessels.json";
import jubExtra from "./jubExtra.json";
import ocv from "./ocvVessels.json";
import supplyBoat from "./supplyBoatVessels.json";
import workBoat from "./workBoatVessels.json";
import crewboat from "./crewboatVessels.json";
import floatel from "./floatelVessels.json";
import hlv from "./hlvVessels.json";
import htv from "./htvVessels.json";
import dsv from "./dsvVessels.json";
import ahts from "./ahtsVessels.json";
import dlb from "./dlbVessels.json";
import floatoverBarge from "./floatoverBargeVessels.json";

// Every vessel carries its category slug so links and the AI Agent can route correctly.
export type Vessel = JubVessel & { category: string };

function tag(arr: unknown[], category: string): Vessel[] {
  return (arr as JubVessel[]).map((v) => ({ ...v, category }));
}

// Category slug -> vessels. Slugs match src/data/vesselTypes.ts.
export const vesselsByType: Record<string, Vessel[]> = {
  hlv: tag(hlv as unknown[], "hlv"),
  htv: tag(htv as unknown[], "htv"),
  jub: tag([...(jubBase as unknown[]), ...(jubExtra as unknown[])], "jub"),
  ocv: tag(ocv as unknown[], "ocv"),
  dsv: tag(dsv as unknown[], "dsv"),
  ahts: tag(ahts as unknown[], "ahts"),
  dlb: tag(dlb as unknown[], "dlb"),
  "floatover-barge": tag(floatoverBarge as unknown[], "floatover-barge"),
  "supply-boat": tag(supplyBoat as unknown[], "supply-boat"),
  workboat: tag(workBoat as unknown[], "workboat"),
  crewboat: tag(crewboat as unknown[], "crewboat"),
  floatel: tag(floatel as unknown[], "floatel"),
};

export const allVessels: Vessel[] = Object.values(vesselsByType).flat();

export function getVessel(id: string): Vessel | undefined {
  return allVessels.find((v) => v.id === id);
}

export function vesselsForType(type: string): Vessel[] {
  return vesselsByType[type] ?? [];
}
