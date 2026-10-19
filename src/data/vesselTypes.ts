export type VesselType = {
  slug: string;
  code: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  hasData: boolean;
};

export const vesselTypes: VesselType[] = [
  {
    slug: "hlv",
    code: "HLV",
    nameVi: "Tàu cẩu nặng (Heavy Lift Vessel)",
    nameEn: "Heavy Lift Vessel",
    descVi: "Tàu chuyên dụng nâng/hạ, vận chuyển kết cấu nặng ngoài khơi.",
    descEn: "Specialised vessel for heavy-lift and transport of offshore structures.",
    hasData: false,
  },
  {
    slug: "htv",
    code: "HTV",
    nameVi: "Tàu vận tải siêu trường siêu trọng (Heavy Transport Vessel)",
    nameEn: "Heavy Transport Vessel",
    descVi: "Tàu bán chìm/boong hở (float-on/float-off) chuyên vận chuyển kết cấu, giàn khoan, module và tàu cỡ lớn.",
    descEn: "Semi-submersible / open-deck (float-on/float-off) vessel for transporting large structures, rigs, modules and vessels.",
    hasData: true,
  },
  {
    slug: "jub",
    code: "JUB",
    nameVi: "Sà lan tự nâng (Jack-Up Barge / Liftboat)",
    nameEn: "Jack-Up Barge / Liftboat",
    descVi: "Công trình tự nâng dùng cho bảo trì, lưu trú và thi công ngoài khơi.",
    descEn: "Self-elevating unit used for offshore maintenance, accommodation and construction.",
    hasData: true,
  },
  {
    slug: "ocv",
    code: "OCV",
    nameVi: "Tàu công trình ngoài khơi (Offshore Construction Vessel)",
    nameEn: "Offshore Construction Vessel",
    descVi: "Tàu đa năng phục vụ thi công, lắp đặt công trình ngoài khơi.",
    descEn: "Multi-purpose vessel for offshore construction and installation work.",
    hasData: true,
  },
  {
    slug: "dsv",
    code: "DSV",
    nameVi: "Tàu hỗ trợ ngầm (Subsea/DSV)",
    nameEn: "Subsea & Diving Support Vessel",
    descVi: "Tàu hỗ trợ công tác ngầm: thi công/lắp đặt ngầm (OCV), ROV/IMR, can thiệp giếng và hỗ trợ lặn (DSV).",
    descEn: "Vessels supporting subsea work: subsea construction/installation (OCV), ROV/IMR, well intervention and diving (DSV).",
    hasData: true,
  },
  {
    slug: "ahts",
    code: "AHTS",
    nameVi: "Tàu kéo neo & tiếp vận (Anchor Handling Tug Supply)",
    nameEn: "Anchor Handling Tug Supply Vessel",
    descVi: "Tàu công suất kéo lớn (bollard pull) chuyên xử lý neo, kéo/dắt và tiếp vận cho công trình ngoài khơi.",
    descEn: "High bollard-pull vessel for anchor handling, towing and supply of offshore installations.",
    hasData: true,
  },
  {
    slug: "dlb",
    code: "DLB",
    nameVi: "Sà lan cẩu lắp đặt (Derrick Lay Barge)",
    nameEn: "Derrick Lay Barge",
    descVi: "Sà lan mang cẩu cỡ lớn phục vụ lắp đặt/rải đường ống ngoài khơi.",
    descEn: "Barge with heavy derrick crane for offshore installation and pipelay.",
    hasData: true,
  },
  {
    slug: "floatover-barge",
    code: "Floatover Barge",
    nameVi: "Sà lan Floatover",
    nameEn: "Floatover Barge",
    descVi: "Sà lan chuyên dụng lắp đặt topside bằng phương pháp floatover.",
    descEn: "Specialised barge for topside installation using the floatover method.",
    hasData: true,
  },
  {
    slug: "floatel",
    code: "Floatel",
    nameVi: "Nhà nổi lưu trú (Floatel)",
    nameEn: "Floatel",
    descVi: "Công trình nổi cung cấp chỗ ở cho nhân sự ngoài khơi.",
    descEn: "Floating accommodation unit for offshore personnel.",
    hasData: true,
  },
  {
    slug: "workboat",
    code: "Workboat",
    nameVi: "Tàu công vụ (Workboat)",
    nameEn: "Workboat",
    descVi: "Tàu đa dụng phục vụ công tác hỗ trợ ngoài khơi.",
    descEn: "Multi-purpose vessel for general offshore support work.",
    hasData: true,
  },
  {
    slug: "supply-boat",
    code: "Supply Boat",
    nameVi: "Tàu tiếp vận (Supply Boat)",
    nameEn: "Supply Boat",
    descVi: "Tàu vận chuyển vật tư, nhiên liệu, nước cho công trình ngoài khơi.",
    descEn: "Vessel transporting cargo, fuel and water to offshore installations.",
    hasData: true,
  },
  {
    slug: "crewboat",
    code: "Crewboat",
    nameVi: "Tàu chở người (Crewboat)",
    nameEn: "Crewboat",
    descVi: "Tàu tốc độ cao vận chuyển nhân sự ra/vào công trình ngoài khơi.",
    descEn: "High-speed vessel transporting crew to/from offshore installations.",
    hasData: true,
  },
];
