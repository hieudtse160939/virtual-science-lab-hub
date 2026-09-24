/**
 * Nguồn tài nguyên giáo dục mở / miễn phí dùng cho seed data.
 * allowsEmbed = true CHỈ khi nhà cung cấp công khai cho phép nhúng iframe
 * (PhET cung cấp mã nhúng chính thức cho các mô phỏng HTML5).
 */
export interface SeedSource {
  name: string;
  slug: string;
  description: string;
  websiteUrl: string;
  license: string;
  licenseUrl?: string;
  country: string;
  allowsEmbed: boolean;
}

export const SEED_SOURCES: SeedSource[] = [
  {
    name: "PhET",
    slug: "phet",
    description:
      "PhET Interactive Simulations (Đại học Colorado Boulder) – mô phỏng tương tác miễn phí về vật lý, hóa học, sinh học, khoa học Trái đất và toán học.",
    websiteUrl: "https://phet.colorado.edu",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    country: "US",
    allowsEmbed: true,
  },
  {
    name: "ChemCollective",
    slug: "chemcollective",
    description:
      "ChemCollective (Carnegie Mellon University) – phòng thí nghiệm hóa học ảo và bài tập dựa trên tình huống.",
    websiteUrl: "https://chemcollective.org",
    license: "Free educational use (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Concord Consortium",
    slug: "concord-consortium",
    description:
      "Concord Consortium – tổ chức phi lợi nhuận phát triển mô hình, mô phỏng và công cụ dữ liệu mã nguồn mở cho giáo dục STEM.",
    websiteUrl: "https://concord.org",
    license: "Open educational resource (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "LabXchange",
    slug: "labxchange",
    description:
      "LabXchange (Harvard) – nền tảng học tập miễn phí với phòng thí nghiệm ảo và nội dung khoa học.",
    websiteUrl: "https://www.labxchange.org",
    license: "Free educational use (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "NOVA Labs",
    slug: "nova-labs",
    description:
      "NOVA Labs (PBS/GBH) – các phòng thí nghiệm số dạng khám phá về tiến hóa, năng lượng, Mặt Trời, mây...",
    websiteUrl: "https://www.pbs.org/wgbh/nova/labs/",
    license: "Free educational use (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Desmos",
    slug: "desmos",
    description: "Desmos – máy tính đồ thị, hình học và khoa học trực tuyến miễn phí.",
    websiteUrl: "https://www.desmos.com",
    license: "Free to use (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "GeoGebra",
    slug: "geogebra",
    description: "GeoGebra – phần mềm toán học động cho hình học, đại số, đồ thị và 3D.",
    websiteUrl: "https://www.geogebra.org",
    license: "Free for non-commercial use (see provider terms)",
    country: "AT",
    allowsEmbed: false,
  },
  {
    name: "NASA",
    slug: "nasa",
    description: "NASA Eyes – trực quan hóa 3D dữ liệu thật về Hệ Mặt Trời, Trái Đất và ngoại hành tinh.",
    websiteUrl: "https://eyes.nasa.gov",
    license: "NASA media usage guidelines",
    licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Stellarium Web",
    slug: "stellarium-web",
    description: "Stellarium Web – cung thiên văn trực tuyến hiển thị bầu trời theo thời gian thực.",
    websiteUrl: "https://stellarium-web.org",
    license: "Free to use (see provider terms)",
    country: "FR",
    allowsEmbed: false,
  },
  {
    name: "Scratch",
    slug: "scratch",
    description: "Scratch (MIT Media Lab) – ngôn ngữ lập trình khối cho trẻ em và người mới bắt đầu.",
    websiteUrl: "https://scratch.mit.edu",
    license: "Free to use; community projects CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Blockly Games",
    slug: "blockly-games",
    description: "Blockly Games – chuỗi trò chơi học lập trình bằng khối lệnh, mã nguồn mở.",
    websiteUrl: "https://blockly.games",
    license: "Apache License 2.0",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Falstad",
    slug: "falstad",
    description: "Các mô phỏng vật lý/điện tử mã nguồn mở của Paul Falstad (CircuitJS, Ripple Tank...).",
    websiteUrl: "https://www.falstad.com",
    license: "GPL (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "MolView",
    slug: "molview",
    description: "MolView – công cụ vẽ và xem cấu trúc phân tử 2D/3D trên trình duyệt.",
    websiteUrl: "https://molview.org",
    license: "Free to use (see provider terms)",
    country: "NL",
    allowsEmbed: false,
  },
  {
    name: "Chrome Music Lab",
    slug: "chrome-music-lab",
    description: "Chrome Music Lab – các thí nghiệm âm thanh và âm nhạc trực quan trên trình duyệt.",
    websiteUrl: "https://musiclab.chromeexperiments.com",
    license: "Free to use (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "USGS",
    slug: "usgs",
    description: "Cục Khảo sát Địa chất Hoa Kỳ – dữ liệu động đất và khoa học Trái Đất công khai.",
    websiteUrl: "https://www.usgs.gov",
    license: "Public domain (U.S. Government work)",
    licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "earth.nullschool",
    slug: "earth-nullschool",
    description: "Bản đồ trực quan gió, hải lưu và điều kiện khí quyển toàn cầu gần thời gian thực.",
    websiteUrl: "https://earth.nullschool.net",
    license: "Free to use (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Global Forest Watch",
    slug: "global-forest-watch",
    description: "Global Forest Watch (World Resources Institute) – bản đồ và dữ liệu mở về rừng toàn cầu.",
    websiteUrl: "https://www.globalforestwatch.org",
    license: "Free to use; data mostly CC BY 4.0 (see provider terms)",
    country: "US",
    allowsEmbed: false,
  },
  {
    name: "Yenka",
    slug: "yenka",
    description:
      "Yenka – phần mềm mô phỏng khoa học, công nghệ và toán học (miễn phí cho sử dụng tại nhà, trả phí cho trường học).",
    websiteUrl: "https://www.yenka.com",
    license: "Commercial (free home licence available)",
    country: "GB",
    allowsEmbed: false,
  },
];
