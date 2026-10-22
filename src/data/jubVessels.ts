import raw from "./jubVessels.json";

export type JubVessel = {
  id: string;
  displayName: string;
  nameNote: string;
  idName: string;
  idType: string;
  idOwner: string;
  idFlag: string;
  idPort: string;
  idClassSociety: string;
  idNotation: string;
  idImo: string | number;
  idCallsign: string;
  idMmsi: string | number;
  idAbsNo: string;
  idRegNo: string;
  idDesigner: string;
  idBuilder: string;
  idHullNo: string;
  idYear: string | number;
  idLocation: string;
  dimLbp: string | number;
  dimLoa: string | number;
  dimWidth: string | number;
  dimDepth: string | number;
  dimLegsQty: string | number;
  dimLegType: string;
  dimLegLength: string | number;
  dimLegTransverseCenters: string | number;
  dimLegFwdAftDist: string | number;
  dimSpudcanHeight: string | number;
  dimSpudcanArea: string | number;
  wtLightshipExLegs: string | number;
  wtLegsSpudcans: string | number;
  wtLightshipTotal: string | number;
  wtDisplacementLoaded: string | number;
  wtDraftLoaded: string | number;
  accPobMax: string | number;
  accDimsLwh: string;
  heliDiameter: string | number;
  heliType: string;
  heliMaxTow: string | number;
  craneMainQty: string | number;
  craneMainSwl: string;
  craneMainWindLimit: string | number;
  craneAuxQty: string | number;
  craneAuxSwl: string;
  craneAuxWindLimit: string | number;
  jackUnitsPerLeg: string | number;
  jackUnitsTotal: string | number;
  jackNormalCapUnit: string | number;
  jackPreloadCapUnit: string | number;
  jackMaxHoldingUnit: string | number;
  jackStormHoldingUnit: string | number;
  jackSpeed: string | number;
  jackAlarmAngle: string | number;
  pwrMainGenDesc: string;
  pwrMainGenUnitEkw: string | number;
  pwrMainGenTotalEkw: string | number;
  pwrEmergGenDesc: string;
  pwrEmergGenEkw: string | number;
  pwrBowThruster: string;
  pwrAftThruster: string;
  pwrDpClass: string;
  tankFoTotalM3: string | number;
  tankFwTotalM3: string | number;
  tankBallastTotalM3: string | number;
  tankBrineTotalM3: string | number;
  tankBufferTotalM3: string | number;
  envStormWind: string | number;
  envStormWave: string | number;
  envStormPeriod: string | number;
  envStormDepth: string | number;
  envStormCurrent: string | number;
  envStormAirgap: string | number;
  envNormalWind: string | number;
  envNormalWave: string | number;
  envNormalPeriod: string | number;
  envNormalDepth: string | number;
  envNormalAirgap: string | number;
  opsFieldmoveWindKn: string | number;
  opsFieldmoveWaveM: string | number;
  opsFieldmoveBeaufort: string | number;
  opsJackingWind: string | number;
  opsJackingWave: string | number;
  opsCraneWind: string | number;
  // Optional explicit per-vessel WORKING limits (bare numbers: Hs in m, wind in kn).
  // When both are set they override the type-default working limit in the WDT calc.
  opsWorkingWaveM?: string | number;
  opsWorkingWindKn?: string | number;
  opsAirTemp: string;
  opsSeaTemp: string;
  srcDoc: string;
  srcDate: string;
  // Optional service-vessel fields (supply/work/crew boats); absent on JUB units.
  cargoDeckArea?: string | number;
  speedKn?: string | number;
  bollardPullT?: string | number;
  dwt?: string | number;
};

export const jubVessels = raw as unknown as JubVessel[];

export function getJubVessel(id: string): JubVessel | undefined {
  return jubVessels.find((v) => v.id === id);
}

export function formatVal(v: string | number | undefined, unit?: string): string {
  if (v === undefined || v === null || v === "") return "—";
  const str = String(v);
  if (!unit) return str;
  if (/[a-zA-Z%]/.test(str)) return str; // already contains unit-like text
  return `${str} ${unit}`;
}
