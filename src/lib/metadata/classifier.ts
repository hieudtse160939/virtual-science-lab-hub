/**
 * Bộ phân loại metadata theo quy tắc (không dùng AI, không sao chép nội dung).
 * Nhận dữ liệu thô (tiêu đề, mô tả, URL) và gợi ý: môn học, khối lớp, chủ đề, từ khóa,
 * ngôn ngữ, loại mô phỏng, độ khó. Kết quả luôn cần admin xem lại trước khi xuất bản.
 *
 * Có thể thay bằng bộ phân loại dùng AI bằng cách hiện thực cùng interface MetadataClassifier.
 */
import type { Difficulty, SimulationType } from "@/types/domain";
import { normalizeText } from "@/lib/utils";

export interface RawMetadataInput {
  title: string;
  description?: string | null;
  url?: string | null;
  topic?: string | null;
  tags?: string[];
}

export interface MetadataSuggestion {
  subject?: string;
  grade_min?: number;
  grade_max?: number;
  topic?: string;
  tags: string[];
  language?: string;
  simulation_type?: SimulationType;
  difficulty?: Difficulty;
  source_name?: string;
  /** 0–1: mức độ tin cậy của gợi ý môn học. */
  confidence: number;
}

export interface MetadataClassifier {
  classify(input: RawMetadataInput): MetadataSuggestion;
}

interface TopicRule {
  subject: string;
  topic: string;
  keywords: string[];
  grades: [number, number];
}

// Từ khóa đã chuẩn hóa (không dấu, chữ thường), song ngữ Việt – Anh.
const TOPIC_RULES: TopicRule[] = [
  {
    subject: "physics",
    topic: "Điện học",
    grades: [7, 12],
    keywords: [
      "circuit",
      "mach dien",
      "ohm",
      "voltage",
      "hieu dien the",
      "resistor",
      "dien tro",
      "current",
      "dong dien",
      "capacitor",
      "tu dien",
      "electric",
      "static electricity",
      "tinh dien",
      "coulomb",
    ],
  },
  {
    subject: "physics",
    topic: "Điện từ học",
    grades: [9, 12],
    keywords: [
      "magnet",
      "nam cham",
      "magnetic",
      "tu truong",
      "faraday",
      "induction",
      "cam ung",
      "electromagnet",
      "generator",
      "may phat dien",
    ],
  },
  {
    subject: "physics",
    topic: "Cơ học",
    grades: [6, 12],
    keywords: [
      "force",
      "luc ",
      "motion",
      "chuyen dong",
      "newton",
      "friction",
      "ma sat",
      "velocity",
      "van toc",
      "acceleration",
      "gia toc",
      "projectile",
      "nem xien",
      "momentum",
      "dong luong",
      "collision",
      "va cham",
      "torque",
      "lever",
      "don bay",
    ],
  },
  {
    subject: "physics",
    topic: "Dao động",
    grades: [9, 12],
    keywords: ["pendulum", "con lac", "spring", "lo xo", "oscillat", "dao dong", "hooke"],
  },
  {
    subject: "physics",
    topic: "Năng lượng",
    grades: [6, 12],
    keywords: [
      "energy",
      "nang luong",
      "kinetic",
      "dong nang",
      "potential energy",
      "the nang",
      "work and power",
      "cong suat",
    ],
  },
  {
    subject: "physics",
    topic: "Sóng",
    grades: [8, 12],
    keywords: [
      "wave",
      "song ",
      "sound",
      "am thanh",
      "interference",
      "giao thoa",
      "frequency",
      "tan so",
      "doppler",
    ],
  },
  {
    subject: "physics",
    topic: "Quang học",
    grades: [7, 12],
    keywords: [
      "light",
      "anh sang",
      "optic",
      "quang hoc",
      "lens",
      "thau kinh",
      "mirror",
      "guong",
      "refraction",
      "khuc xa",
      "reflection",
      "phan xa",
      "color",
      "mau sac",
      "laser",
    ],
  },
  {
    subject: "physics",
    topic: "Nhiệt học",
    grades: [6, 12],
    keywords: [
      "heat",
      "nhiet",
      "temperature",
      "thermal",
      "gas law",
      "chat khi",
      "pressure",
      "ap suat",
      "thermodynamic",
    ],
  },
  {
    subject: "physics",
    topic: "Chất lỏng",
    grades: [6, 12],
    keywords: ["buoyancy", "luc day", "archimedes", "density", "khoi luong rieng", "fluid", "chat long"],
  },
  {
    subject: "physics",
    topic: "Vật lý hiện đại",
    grades: [11, 12],
    keywords: [
      "quantum",
      "luong tu",
      "photoelectric",
      "quang dien",
      "nuclear",
      "hat nhan",
      "radioactiv",
      "phong xa",
      "relativity",
      "blackbody",
    ],
  },
  {
    subject: "earth-science",
    topic: "Thiên văn",
    grades: [4, 12],
    keywords: [
      "astronomy",
      "thien van",
      "planet",
      "hanh tinh",
      "solar system",
      "he mat troi",
      "orbit",
      "quy dao",
      "star",
      "ngoi sao",
      "moon",
      "mat trang",
      "galaxy",
      "exoplanet",
      "telescope",
    ],
  },
  {
    subject: "earth-science",
    topic: "Địa chất",
    grades: [6, 12],
    keywords: [
      "earthquake",
      "dong dat",
      "volcano",
      "nui lua",
      "plate tectonic",
      "kien tao",
      "rock",
      "da ",
      "mineral",
      "khoang vat",
      "erosion",
    ],
  },
  {
    subject: "earth-science",
    topic: "Khí tượng",
    grades: [5, 12],
    keywords: [
      "weather",
      "thoi tiet",
      "cloud",
      "may ",
      "storm",
      "bao ",
      "atmosphere",
      "khi quyen",
      "wind",
      "gio ",
    ],
  },
  {
    subject: "environmental-science",
    topic: "Khí hậu",
    grades: [6, 12],
    keywords: [
      "climate",
      "khi hau",
      "greenhouse",
      "nha kinh",
      "global warming",
      "nong len toan cau",
      "carbon",
    ],
  },
  {
    subject: "environmental-science",
    topic: "Sinh thái",
    grades: [5, 12],
    keywords: [
      "ecosystem",
      "he sinh thai",
      "ecology",
      "sinh thai",
      "food chain",
      "chuoi thuc an",
      "population",
      "quan the",
      "pollution",
      "o nhiem",
      "forest",
      "rung",
      "biodiversity",
      "da dang sinh hoc",
      "recycl",
      "tai che",
    ],
  },
  {
    subject: "chemistry",
    topic: "Cấu tạo nguyên tử",
    grades: [8, 12],
    keywords: [
      "atom",
      "nguyen tu",
      "isotope",
      "dong vi",
      "electron",
      "proton",
      "neutron",
      "periodic table",
      "bang tuan hoan",
    ],
  },
  {
    subject: "chemistry",
    topic: "Liên kết hóa học",
    grades: [10, 12],
    keywords: ["molecule", "phan tu", "bond", "lien ket", "vsepr", "polarity", "phan cuc", "lewis"],
  },
  {
    subject: "chemistry",
    topic: "Phản ứng hóa học",
    grades: [8, 12],
    keywords: [
      "reaction",
      "phan ung",
      "equation",
      "phuong trinh hoa hoc",
      "stoichiometr",
      "reactant",
      "product",
      "limiting",
      "combustion",
      "chay",
    ],
  },
  {
    subject: "chemistry",
    topic: "Dung dịch",
    grades: [8, 12],
    keywords: [
      "solution",
      "dung dich",
      "concentration",
      "nong do",
      "molarity",
      "solubility",
      "do tan",
      "dilution",
      "pha loang",
    ],
  },
  {
    subject: "chemistry",
    topic: "Axit – Bazơ",
    grades: [8, 12],
    keywords: ["acid", "axit", "base", "bazo", " ph", "titration", "chuan do", "indicator", "chi thi"],
  },
  {
    subject: "chemistry",
    topic: "Trạng thái của chất",
    grades: [5, 11],
    keywords: [
      "states of matter",
      "trang thai",
      "solid",
      "liquid",
      "phase change",
      "chuyen the",
      "melting",
      "nong chay",
      "boiling",
      "soi",
    ],
  },
  {
    subject: "biology",
    topic: "Tế bào",
    grades: [6, 12],
    keywords: [
      "cell",
      "te bao",
      "membrane",
      "mang te bao",
      "mitosis",
      "nguyen phan",
      "meiosis",
      "giam phan",
      "organelle",
    ],
  },
  {
    subject: "biology",
    topic: "Di truyền",
    grades: [9, 12],
    keywords: [
      "gene",
      "gen ",
      "dna",
      "adn",
      "rna",
      "genetic",
      "di truyen",
      "chromosome",
      "nhiem sac the",
      "mendel",
      "protein synthesis",
      "expression",
    ],
  },
  {
    subject: "biology",
    topic: "Tiến hóa",
    grades: [9, 12],
    keywords: [
      "evolution",
      "tien hoa",
      "natural selection",
      "chon loc tu nhien",
      "adaptation",
      "thich nghi",
      "mutation",
      "dot bien",
    ],
  },
  {
    subject: "biology",
    topic: "Sinh lý",
    grades: [7, 12],
    keywords: [
      "neuron",
      "than kinh",
      "heart",
      "tim ",
      "blood",
      "mau ",
      "digest",
      "tieu hoa",
      "respiration",
      "ho hap",
      "photosynthesis",
      "quang hop",
      "enzyme",
      "immune",
      "mien dich",
    ],
  },
  {
    subject: "mathematics",
    topic: "Số học",
    grades: [1, 7],
    keywords: [
      "arithmetic",
      "so hoc",
      "addition",
      "phep cong",
      "subtraction",
      "phep tru",
      "multiplication",
      "phep nhan",
      "division",
      "phep chia",
      "number line",
      "truc so",
      "counting",
      "dem so",
      "integer",
      "so nguyen",
    ],
  },
  {
    subject: "mathematics",
    topic: "Phân số",
    grades: [3, 7],
    keywords: ["fraction", "phan so", "decimal", "so thap phan", "percent", "phan tram"],
  },
  {
    subject: "mathematics",
    topic: "Đại số",
    grades: [6, 12],
    keywords: [
      "algebra",
      "dai so",
      "equation",
      "phuong trinh",
      "expression",
      "bieu thuc",
      "inequalit",
      "bat phuong trinh",
      "polynomial",
      "da thuc",
    ],
  },
  {
    subject: "mathematics",
    topic: "Hàm số",
    grades: [8, 12],
    keywords: [
      "function",
      "ham so",
      "graph",
      "do thi",
      "slope",
      "he so goc",
      "quadratic",
      "bac hai",
      "parabola",
      "linear",
      "exponential",
      "logarithm",
    ],
  },
  {
    subject: "mathematics",
    topic: "Hình học",
    grades: [3, 12],
    keywords: [
      "geometry",
      "hinh hoc",
      "triangle",
      "tam giac",
      "circle",
      "duong tron",
      "angle",
      "goc ",
      "area",
      "dien tich",
      "perimeter",
      "chu vi",
      "volume",
      "the tich",
      "polygon",
      "quadrilateral",
      "tu giac",
    ],
  },
  {
    subject: "mathematics",
    topic: "Lượng giác",
    grades: [10, 12],
    keywords: ["trigonometr", "luong giac", "sine", "cosine", "tangent", "unit circle"],
  },
  {
    subject: "mathematics",
    topic: "Xác suất – Thống kê",
    grades: [6, 12],
    keywords: [
      "probability",
      "xac suat",
      "statistic",
      "thong ke",
      "mean",
      "trung binh",
      "median",
      "trung vi",
      "data",
      "du lieu",
      "histogram",
      "regression",
      "hoi quy",
    ],
  },
  {
    subject: "mathematics",
    topic: "Giải tích",
    grades: [11, 12],
    keywords: [
      "calculus",
      "giai tich",
      "derivative",
      "dao ham",
      "integral",
      "tich phan",
      "limit",
      "gioi han",
    ],
  },
  {
    subject: "computer-science",
    topic: "Lập trình",
    grades: [3, 12],
    keywords: [
      "programming",
      "lap trinh",
      "coding",
      "code",
      "algorithm",
      "thuat toan",
      "scratch",
      "python",
      "blockly",
      "loop",
      "vong lap",
    ],
  },
  {
    subject: "computer-science",
    topic: "An toàn thông tin",
    grades: [6, 12],
    keywords: [
      "cybersecurity",
      "an toan thong tin",
      "password",
      "mat khau",
      "encryption",
      "ma hoa",
      "network",
      "mang may tinh",
    ],
  },
  {
    subject: "stem",
    topic: "Kỹ thuật & thiết kế",
    grades: [5, 12],
    keywords: [
      "engineering",
      "ky thuat",
      "design",
      "thiet ke",
      "robot",
      "bridge",
      "cay cau",
      "arduino",
      "maker",
      "3d print",
    ],
  },
];

const TYPE_RULES: { type: SimulationType; keywords: string[] }[] = [
  {
    type: "virtual_lab",
    keywords: ["virtual lab", "phong thi nghiem ao", "lab bench", "vlab", "virtual laboratory"],
  },
  { type: "data_lab", keywords: ["data", "du lieu", "dataset", "map", "ban do", "analysis", "phan tich"] },
  { type: "game", keywords: ["game", "tro choi", "challenge", "thu thach", "puzzle", "cau do", "quiz"] },
  { type: "model", keywords: ["model", "mo hinh", "3d viewer", "visualiz", "truc quan"] },
  { type: "experiment", keywords: ["experiment", "thi nghiem", "investigation", "hands-on"] },
];

const KNOWN_SOURCES: { host: string; name: string }[] = [
  { host: "phet.colorado.edu", name: "PhET" },
  { host: "chemcollective.org", name: "ChemCollective" },
  { host: "concord.org", name: "Concord Consortium" },
  { host: "labxchange.org", name: "LabXchange" },
  { host: "pbs.org/wgbh/nova", name: "NOVA Labs" },
  { host: "geogebra.org", name: "GeoGebra" },
  { host: "desmos.com", name: "Desmos" },
  { host: "nasa.gov", name: "NASA" },
  { host: "scratch.mit.edu", name: "Scratch" },
  { host: "falstad.com", name: "Falstad" },
  { host: "yenka.com", name: "Yenka" },
  { host: "nobook.com", name: "NoBook" },
];

const VIETNAMESE_CHARS = /[ăâđêôơưàảãạáằẳẵặắầẩẫậấèẻẽẹéềểễệếìỉĩịíòỏõọóồổỗộốờởỡợớùủũụúừửữựứỳỷỹỵý]/i;

function countMatches(haystack: string, keywords: string[]) {
  let score = 0;
  const hits: string[] = [];
  for (const kw of keywords) {
    if (haystack.includes(kw)) {
      score += kw.length >= 6 ? 2 : 1;
      hits.push(kw.trim());
    }
  }
  return { score, hits };
}

export const ruleBasedClassifier: MetadataClassifier = {
  classify(input) {
    const rawText = [input.title, input.description, input.topic, ...(input.tags ?? [])]
      .filter(Boolean)
      .join(" ");
    const text = ` ${normalizeText(rawText)} `;
    const titleText = ` ${normalizeText(input.title)} `;

    let best: { rule: TopicRule; score: number; hits: string[] } | null = null;
    let totalScore = 0;
    for (const rule of TOPIC_RULES) {
      const { score, hits } = countMatches(text, rule.keywords);
      // Khớp trong tiêu đề được tính gấp đôi.
      const titleBonus = countMatches(titleText, rule.keywords).score;
      const s = score + titleBonus;
      totalScore += s;
      if (s > 0 && (!best || s > best.score)) best = { rule, score: s, hits };
    }

    const suggestion: MetadataSuggestion = { tags: [], confidence: 0 };
    if (best) {
      suggestion.subject = best.rule.subject;
      suggestion.topic = input.topic ?? best.rule.topic;
      suggestion.grade_min = best.rule.grades[0];
      suggestion.grade_max = best.rule.grades[1];
      suggestion.tags = Array.from(new Set(best.hits)).slice(0, 8);
      suggestion.confidence = Math.min(1, best.score / Math.max(totalScore, 1)) * Math.min(1, best.score / 4);
    }

    // Khối lớp ghi rõ trong văn bản: "lớp 10", "grade 7", "grades 6-8"
    const gradeMatch = normalizeText(rawText).match(
      /(?:lop|grade|grades|khoi)\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/,
    );
    if (gradeMatch) {
      const a = Number(gradeMatch[1]);
      const b = gradeMatch[2] ? Number(gradeMatch[2]) : a;
      if (a >= 1 && a <= 12 && b >= a && b <= 12) {
        suggestion.grade_min = a;
        suggestion.grade_max = b;
      }
    }

    for (const rule of TYPE_RULES) {
      if (countMatches(text, rule.keywords).score > 0) {
        suggestion.simulation_type = rule.type;
        break;
      }
    }
    suggestion.simulation_type ??= "simulation";

    suggestion.language = VIETNAMESE_CHARS.test(input.title) ? "vi" : "en";

    if (/(advanced|nang cao|university|dai hoc|calculus|quantum)/.test(text))
      suggestion.difficulty = "advanced";
    else if (/(intro|basics|co ban|beginner|elementary|tieu hoc)/.test(text))
      suggestion.difficulty = "beginner";
    else suggestion.difficulty = "intermediate";

    if (input.url) {
      const url = input.url.toLowerCase();
      suggestion.source_name = KNOWN_SOURCES.find((s) => url.includes(s.host))?.name;
    }
    return suggestion;
  },
};
