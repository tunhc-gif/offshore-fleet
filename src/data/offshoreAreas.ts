import weatherRaw from "./offshoreWeather.json";

// ---------------------------------------------------------------------------
// Weather sample dataset (frequency-of-occurrence distributions by month).
// wind[m] / wave[m] are 7-bin arrays (% occurrence) for month m (0=Jan..11=Dec),
// aligned to windBins / waveBins below.
// ---------------------------------------------------------------------------
export type WeatherBin = { from: number; to: number; label: string };
// Each field carries its own bins + wind unit, so datasets of different
// resolution/units (e.g. 5-kn sample bins vs 2-m/s LDV hindcast bins) coexist.
export type FieldWeather = {
  windUnit: "knot" | "ms";
  windBins: WeatherBin[];
  waveBins: WeatherBin[];
  wind: number[][];
  wave: number[][];
};

const weather = weatherRaw as { fields: Record<string, FieldWeather> };

export function getFieldWeather(slug: string): FieldWeather | undefined {
  return weather.fields[slug];
}

export function windUnitLabel(unit: "knot" | "ms"): string {
  return unit === "ms" ? "m/s" : "kn";
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type OffshoreField = {
  slug: string;
  countrySlug: string;
  region: string; // region display label
  nameVi: string;
  nameEn: string;
  lat: string;
  lon: string;
  waterDepth: string;
  nearestPort: string;
  dataSource: string;
  statPeriod: string;
  lastUpdated: string;
  windMeta: string; // e.g. sustained/gust + measurement height
  waveMeta: string; // e.g. Hs / Hmax
  dataKind: string; // hindcast | measured | forecast
  sample: boolean; // true = demo data, clearly flagged in UI
  defaultWindLimit?: number; // default operational wind limit (in the field's wind unit)
  defaultHsLimit?: number; // default operational Hs limit (m)
  mapLat?: number; // decimal latitude (for map embed)
  mapLng?: number; // decimal longitude (for map embed)
  hidden?: boolean; // true = ẩn khỏi danh sách + route tĩnh (giữ dữ liệu để bật lại)
};

export type OffshoreCountry = {
  slug: string;
  code: string;
  nameVi: string;
  nameEn: string;
  region: string;
  flag: string;
};

export const offshoreCountries: OffshoreCountry[] = [
  { slug: "vietnam", code: "VN", nameVi: "Việt Nam", nameEn: "Vietnam", region: "Đông Nam Á / Southeast Asia", flag: "🇻🇳" },
  { slug: "malaysia", code: "MY", nameVi: "Malaysia", nameEn: "Malaysia", region: "Đông Nam Á / Southeast Asia", flag: "🇲🇾" },
  { slug: "brunei", code: "BN", nameVi: "Brunei", nameEn: "Brunei", region: "Đông Nam Á / Southeast Asia", flag: "🇧🇳" },
  { slug: "thailand", code: "TH", nameVi: "Thái Lan", nameEn: "Thailand", region: "Đông Nam Á / Southeast Asia", flag: "🇹🇭" },
  { slug: "qatar", code: "QA", nameVi: "Qatar", nameEn: "Qatar", region: "Trung Đông / Middle East", flag: "🇶🇦" },
  { slug: "uae", code: "UAE", nameVi: "UAE", nameEn: "United Arab Emirates", region: "Trung Đông / Middle East", flag: "🇦🇪" },
  { slug: "ksa", code: "KSA", nameVi: "Ả Rập Xê Út", nameEn: "Saudi Arabia (KSA)", region: "Trung Đông / Middle East", flag: "🇸🇦" },
  { slug: "nigeria", code: "NG", nameVi: "Nigeria", nameEn: "Nigeria", region: "Tây Phi / West Africa", flag: "🇳🇬" },
  { slug: "myanmar", code: "MM", nameVi: "Myanmar", nameEn: "Myanmar", region: "Đông Nam Á / Southeast Asia", flag: "🇲🇲" },
];

// Fields (with sample weather where dataKind is populated). Only Vietnam has a
// pilot dataset for now; other countries appear with no field data yet.
export const offshoreFields: OffshoreField[] = [
  {
    slug: "lac-da-vang",
    countrySlug: "vietnam",
    region: "Cửu Long",
    nameVi: "Lạc Đà Vàng (LDV)",
    nameEn: "Lac Da Vang (LDV)",
    lat: "≈10.3° N",
    lon: "≈108.0° E",
    waterDepth: "≈50 m",
    nearestPort: "Vũng Tàu (~120 km về phía Tây)",
    dataSource:
      "Fugro — Metocean Criteria for Lac Da Vang Field, Block 15-1/05 (Doc. 180920-1-R1, 26/10/2018); chủ đầu tư Murphy Cuu Long Bac Oil Co Ltd. Bảng phân bố vận hành từ hindcast SEAFINE (SEAMOS South Fine Grid).",
    statPeriod: "Thống kê vận hành theo tháng từ hindcast SEAFINE dài hạn",
    lastUpdated: "2018-10 (báo cáo) · tích hợp 2026-07",
    windMeta: "Tốc độ gió tại độ cao 10 m (m/s), hindcast SEAFINE",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m)",
    dataKind: "Hindcast (SEAFINE / SEAMOS)",
    sample: false,
    defaultWindLimit: 12,
    defaultHsLimit: 1.5,
    mapLat: 10.3,
    mapLng: 108.0,
  },
  {
    slug: "ps-2",
    countrySlug: "qatar",
    region: "Maydan Mahzam",
    nameVi: "PS-2 (Maydan Mahzam)",
    nameEn: "PS-2 (Maydan Mahzam)",
    lat: "≈25.6° N (UTM 39N N2831362)",
    lon: "≈52.1° E (UTM 39N E654608)",
    waterDepth: "≈34 m (CD)",
    nearestPort: "Doha / Ras Laffan, Qatar",
    dataSource:
      "Qatar Petroleum Oilfields Metocean Study — PS-2 Metocean Criteria (HR Wallingford, Doc. DER6052-RT004-R06-00, 09/2019). Gió từ Appendix A (mô hình PERGOS-2); sóng Hs từ Appendix L, Bảng L.4 (SWAN hindcast).",
    statPeriod: "Thống kê khí hậu theo tháng từ hindcast dài hạn (PERGOS-2 / SWAN)",
    lastUpdated: "2019-09 (báo cáo) · tích hợp 2026-07",
    windMeta: "Gió trung bình 1 giờ, quy về độ cao 10 m (knot) — Appendix A",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Bảng L.4 non-exceedance",
    dataKind: "Hindcast (SWAN / PERGOS-2)",
    sample: false,
    defaultWindLimit: 23,
    defaultHsLimit: 1.5,
    mapLat: 25.6,
    mapLng: 52.13,
  },
  {
    slug: "thang-long-dong-do",
    countrySlug: "vietnam",
    region: "Cửu Long",
    nameVi: "Thăng Long – Đông Đô",
    nameEn: "Thang Long – Dong Do",
    lat: "10°09′31″ N",
    lon: "108°34′30″ E",
    waterDepth: "55 – 75 m",
    nearestPort: "Vũng Tàu (~160 km)",
    dataSource:
      "Fugro GEOS — Block 01/97 & 02/97 Vietnam Metocean Criteria Study cho Lam Sơn JOC (Báo cáo C50631/5751/R1, 17/02/2010). Gió & sóng từ hindcast SEAFINE (1956–2007); phân bố tháng dựng từ Bảng 4.1.1 (gió) và 4.2.1 (Hs).",
    statPeriod: "Thống kê vận hành theo tháng, hindcast SEAFINE 1956–2007",
    lastUpdated: "2010-02 (báo cáo) · tích hợp 2026-07",
    windMeta: "Gió trung bình 1 giờ tại độ cao 10 m (knot) — Bảng 4.1.1",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Bảng 4.2.1",
    dataKind: "Hindcast (SEAFINE)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 10.159,
    mapLng: 108.575,
  },
  {
    slug: "thien-nga-hai-au",
    countrySlug: "vietnam",
    region: "Nam Côn Sơn",
    nameVi: "Thiên Nga – Hải Âu",
    nameEn: "Thien Nga – Hai Au",
    lat: "07°39′ – 07°52′ N",
    lon: "107°52′ – 108°15′ E",
    waterDepth: "60 – 85 m",
    nearestPort: "Vũng Tàu (~320 km)",
    dataSource:
      "IMHEN (Viện Khoa học Khí tượng Thủy văn & BĐKH) cho Vietsovpetro — Metocean & Environmental Data cho mỏ Thiên Nga – Hải Âu, Lô 12/11 (Báo cáo cuối, 10/2022; HĐ 0747/22/T-N5/NIPI1-IMHEN). Gió dựng phân phối Weibull từ Bảng 5.1 (mean/std, hindcast 1hr @10m); sóng từ Bảng 5.20 non-exceedance percentile (1991–2020).",
    statPeriod: "Thống kê theo tháng, hindcast dài hạn (sóng 1991–2020)",
    lastUpdated: "2022-10 (báo cáo) · tích hợp 2026-07",
    windMeta: "Gió trung bình 1 giờ tại độ cao 10 m (knot) — Weibull từ Bảng 5.1",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Bảng 5.20 non-exceedance",
    dataKind: "Hindcast (IMHEN / Vietsovpetro)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 7.755,
    mapLng: 108.055,
  },
  {
    slug: "stp-m1",
    countrySlug: "qatar",
    region: "Sensor Tower Platforms (Halul)",
    nameVi: "STP M1 (Offshore Qatar)",
    nameEn: "STP M1 (Offshore Qatar)",
    lat: "26.6494° N",
    lon: "51.5809° E",
    waterDepth: "34.8 m",
    nearestPort: "Đảo Halul / Doha, Qatar",
    dataSource:
      "SAIPEM — Sensor Tower Platform (STP) Metocean Criteria, National Security Shield, Offshore Qatar (Doc. 3084/3088-STPGEN-1-17-0055 Rev.3, 22/04/2012). Đại diện cho khu STP (M1); các platform M3/M4/M5 có điều kiện tương tự. Gió & sóng theo tháng từ bảng thống kê percentile non-exceedance, hindcast 1983–2009.",
    statPeriod: "Thống kê theo tháng, hindcast 1983–2009",
    lastUpdated: "2012-04 (báo cáo) · tích hợp 2026-07",
    windMeta: "Gió trung bình 1 giờ tại độ cao 10 m (knot) — bảng thống kê tháng",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — bảng thống kê tháng (non-exceedance)",
    dataKind: "Hindcast (SAIPEM / STP)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 26.6494,
    mapLng: 51.5809,
  },
  {
    slug: "nam-du",
    countrySlug: "vietnam",
    region: "Malay – Thổ Chu",
    nameVi: "Nam Du",
    nameEn: "Nam Du",
    lat: "≈8.2° N",
    lon: "≈104.1° E",
    waterDepth: "≈50 m",
    nearestPort: "Cà Mau (~160 km về Đông Bắc)",
    dataSource:
      "Fugro — Metocean Criteria for Blocks 46/07 and 51, Gulf of Thailand cho Jadestone Energy (Doc. 181134-1-R5, 2019). Mỏ Nam Du (Lô 46/07); dữ liệu vận hành gió (Ws 10 phút) & sóng (Hs) theo tháng từ bảng percentile non-exceedance (HYCOM/WRF/Global Wave Database). Cùng báo cáo còn có mỏ Tho Chu & U Minh.",
    statPeriod: "Thống kê vận hành theo tháng (hindcast dài hạn)",
    lastUpdated: "2019 (báo cáo R5) · tích hợp 2026-07",
    windMeta: "Gió trung bình 10 phút tại độ cao 10 m (knot) — Bảng A.1.1",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Bảng B.1.1 non-exceedance",
    dataKind: "Hindcast (Fugro / HYCOM–WRF)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 8.2,
    mapLng: 104.1,
  },
  {
    slug: "oml-112-nigeria",
    countrySlug: "nigeria",
    region: "OML 112 (Niger Delta)",
    nameVi: "OML 112 (Offshore Nigeria)",
    nameEn: "OML 112 (Offshore Nigeria)",
    lat: "04°20′46″ N",
    lon: "07°18′46″ E",
    waterDepth: "≈8 m",
    nearestPort: "Onne / Port Harcourt, Nigeria (~7 km từ bờ)",
    dataSource:
      "TotalEnergies / RPS — Offshore Nigeria (OML 112) Metocean Study (Doc. 100-CN-REP-2080 Rev.0). Gió (Ws 10 m) & sóng (Hs) dựng phân phối Weibull từ thống kê tháng (mean/std) trong Appendix E (gió) và Appendix D (sóng); hindcast 1979–2015.",
    statPeriod: "Thống kê vận hành theo tháng, hindcast 1979–2015",
    lastUpdated: "Rev.0 · tích hợp 2026-07",
    windMeta: "Gió duy trì tại độ cao 10 m (knot) — Weibull từ thống kê tháng (Appendix E)",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Weibull từ thống kê tháng (Appendix D)",
    dataKind: "Hindcast (RPS / TotalEnergies)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 4.3462,
    mapLng: 7.3128,
  },
  {
    slug: "benchamas-b832",
    countrySlug: "thailand",
    region: "Block B8/32 (Gulf of Thailand)",
    nameVi: "Benchamas (B8/32)",
    nameEn: "Benchamas (B8/32)",
    lat: "≈10.33° N",
    lon: "≈101.46° E",
    waterDepth: "67 – 73 m",
    nearestPort: "Songkhla / Sattahip, Thái Lan",
    dataSource:
      "Chevron/PTTEP — Metocean Criteria for the Gulf of Thailand (2020, C01 Issued for RFP). Mỏ Benchamas, Lô B8/32; gió & sóng từ bảng percent-occurrence THEO MÙA (Nov–Mar, Apr–May, Jun–Sep, Oct) ánh xạ sang từng tháng; hindcast SEAFINE + đo đạc Benchamas 2008–2012.",
    statPeriod: "Thống kê theo mùa (ánh xạ 12 tháng), hindcast SEAFINE",
    lastUpdated: "2020-07 (báo cáo) · tích hợp 2026-07",
    windMeta: "Gió trung bình tại độ cao 10 m (knot) — bảng percent-occurrence theo mùa",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — bảng percent-occurrence theo mùa",
    dataKind: "Hindcast theo mùa (Chevron GOT)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 10.33,
    mapLng: 101.46,
  },
  {
    slug: "khanh-my-dam-doi",
    countrySlug: "vietnam",
    region: "Malay – Thổ Chu",
    nameVi: "Khánh Mỹ – Đầm Dơi",
    nameEn: "Khanh My – Dam Doi",
    lat: "07°13′ N (7.216° N)",
    lon: "104°01′ E (104.015° E)",
    waterDepth: "≈80 m",
    nearestPort: "Cà Mau (~160 km)",
    dataSource:
      "Metocean Criteria Study for Block 46/13, Offshore Vietnam cho PVEP-Khánh Mỹ (Doc. F262605-REP-001 R03, 20/03/2025). Điểm DD-WHP (Đầm Dơi WHP). Gió (Ws 1 giờ) & sóng (Hs) theo tháng từ bảng percentile non-exceedance (hindcast SEAFINE).",
    statPeriod: "Thống kê vận hành theo tháng, hindcast SEAFINE",
    lastUpdated: "2025-03 (báo cáo R03) · tích hợp 2026-07",
    windMeta: "Gió trung bình 1 giờ tại độ cao 10 m (knot) — Bảng B.1.1",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Bảng B.2.1 non-exceedance",
    dataKind: "Hindcast (SEAFINE)",
    sample: false,
    defaultWindLimit: 20,
    defaultHsLimit: 1.5,
    mapLat: 7.216,
    mapLng: 104.015,
  },
  {
    slug: "m9-block",
    countrySlug: "myanmar",
    region: "Biển Andaman",
    nameVi: "Block M9 (giàn Z-5)",
    nameEn: "Block M9 (Z-5 Platform)",
    lat: "14°11′36″ N (14.193° N)",
    lon: "096°02′48″ E (96.047° E)",
    waterDepth: "≈141 m LAT",
    nearestPort: "Yangon (~280 km ĐB) / Dawei (~290 km Đ)",
    dataSource:
      "Metocean Report — Myanmar Block M9, giàn Z-5 (Doc. O/C04/1329/WR-001-0 Rev 0). Lập theo ISO 19901-1. Phân bố tháng: gió dựng từ Bảng 5.4 (tần suất gió theo hướng theo tháng, cột Total) và sóng từ Bảng 5.6 (Hs theo hướng theo tháng, cột Total).",
    statPeriod: "Thống kê vận hành theo tháng (parts per 10000), hindcast dài hạn",
    lastUpdated: "Rev 0 (báo cáo) · tích hợp 2026-07",
    windMeta: "Gió tại độ cao 10 m amsl (m/s) — Bảng 5.4",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — Bảng 5.6",
    dataKind: "Hindcast (metocean study)",
    sample: false,
    defaultWindLimit: 12,
    defaultHsLimit: 1.5,
    mapLat: 14.193,
    mapLng: 96.047,
  },
  {
    slug: "arabian-gulf-ksa",
    countrySlug: "ksa",
    // ẨN tạm: lớp sóng đang dùng phân bố annual áp đều 12 tháng (nguồn không có Hs
    // theo tháng) nên chưa phản ánh mùa Shamal. Bật lại khi có dữ liệu Hs theo tháng.
    hidden: true,
    region: "Arabian Gulf (Saudi Aramco)",
    nameVi: "Vịnh Ba Tư – Khu vực Saudi Aramco",
    nameEn: "Arabian Gulf – Saudi Aramco Area",
    lat: "≈27.9° N (đại diện khu vực: Zuluf/Marjan/Safaniya)",
    lon: "≈48.8° E",
    waterDepth: "≈10–60 m (vùng nông; không dùng cho <3 m LAT)",
    nearestPort: "Jubail / Ras Tanura (KSA)",
    dataSource:
      "Saudi Aramco / DHI — Arabian Gulf MetOcean Database (SAER-6406, 30/05/2012), hindcast PERGOS/UNIWAVE. Gió: dựng trực tiếp từ bảng exceedance gió 3h theo tháng (file SAER6406_Wind_3h_Persistence_Distribution.xlsx, ngưỡng 1–20 m/s) → phân bố theo bin. Sóng: Bảng 9.5 phân bố Hs annual (cột Omni/Total). LƯU Ý: nguồn KHÔNG có phân bố Hs theo từng tháng nên sóng dùng phân bố ANNUAL áp đều 12 tháng (mùa vụ chủ yếu thể hiện qua gió).",
    statPeriod: "Gió: theo tháng (persistence 3h). Sóng: annual omni áp đều 12 tháng. Hindcast dài hạn.",
    lastUpdated: "2012-05 (tài liệu) · tích hợp 2026-08",
    windMeta: "Gió 10 m amsl (m/s) — Bảng 9.3 (đại diện khu vực Saudi Aramco)",
    waveMeta: "Hs (m) — Bảng 9.5 phân bố annual omni (áp đều 12 tháng)",
    dataKind: "Hindcast (DHI/PERGOS — đại diện khu vực)",
    sample: false,
    defaultWindLimit: 12,
    defaultHsLimit: 1.5,
    mapLat: 27.9,
    mapLng: 48.8,
  },
  {
    slug: "marjan",
    countrySlug: "ksa",
    region: "Marjan (Saudi Aramco)",
    nameVi: "Marjan (Vịnh Ba Tư)",
    nameEn: "Marjan (Arabian Gulf)",
    lat: "28.4389° N",
    lon: "49.6746° E",
    waterDepth: "≈40–45 m",
    nearestPort: "Jubail / Ras Tanura (KSA)",
    dataSource:
      "ERA5 reanalysis (ECMWF) tại điểm 28.4389° N, 49.6746° E — chuỗi giờ 2006-01 → 2026-10 (182.184 bản ghi). Gió: wind_speed_10m (nguồn m/s, quy đổi sang knot ×1.94384). Sóng: wave_height Hs (m). Phân bố % tần suất theo tháng tính trực tiếp từ chuỗi thời gian ERA5 (không nội suy, không bịa).",
    statPeriod: "Thống kê theo tháng từ hindcast ERA5 2006–2026 (~20,8 năm)",
    lastUpdated: "ERA5 tới 2026-10 · tích hợp 2026-10",
    windMeta: "Gió tại độ cao 10 m (knot) — ERA5 hourly (quy đổi từ m/s)",
    waveMeta: "Chiều cao sóng ý nghĩa Hs (m) — ERA5 hourly",
    dataKind: "Hindcast (ERA5 / ECMWF)",
    sample: false,
    defaultWindLimit: 23,
    defaultHsLimit: 1.5,
    mapLat: 28.4389,
    mapLng: 49.6746,
  },
];

// Region ordering per country (for grouping on the country page).
export const regionsByCountry: Record<string, string[]> = {
  vietnam: ["Vũng Tàu", "Nam Côn Sơn", "Cửu Long", "Malay – Thổ Chu", "Sông Hồng"],
  qatar: ["Maydan Mahzam", "Sensor Tower Platforms (Halul)", "Bul Hanine", "North Field"],
  ksa: ["Marjan (Saudi Aramco)", "Arabian Gulf (Saudi Aramco)"],
  nigeria: ["OML 112 (Niger Delta)"],
  thailand: ["Block B8/32 (Gulf of Thailand)"],
  myanmar: ["Biển Andaman"],
};

export function fieldsForCountry(countrySlug: string): OffshoreField[] {
  return offshoreFields.filter((f) => f.countrySlug === countrySlug && !f.hidden);
}

export function getField(countrySlug: string, fieldSlug: string): OffshoreField | undefined {
  return offshoreFields.find((f) => f.countrySlug === countrySlug && f.slug === fieldSlug);
}

export function countryHasData(countrySlug: string): boolean {
  return offshoreFields.some((f) => f.countrySlug === countrySlug && getFieldWeather(f.slug) !== undefined);
}
