import type { FamilyMember } from "../types";

/**
 * Nội dung các chương của trang Giới thiệu 3D (/gioi-thieu).
 * Sửa lời ở đây không cần đụng code 3D. `highlight` là id thành viên trong Firestore;
 * nếu id không còn thì chương vẫn hiển thị chữ, chỉ bỏ phần làm sáng.
 */
export interface IntroStats {
  totalMembers: number;
  generations: number;
  minGen: number;
  maxGen: number;
  alive: number;
  latestGenCount: number;
}

export interface IntroChapter {
  id: string;
  kicker: string;
  title: string;
  body: string | ((stats: IntroStats, members: FamilyMember[]) => string);
  /** Các đời camera hướng tới; "all" là toàn cảnh, "latest" là đời mới nhất */
  focus: { from: number; to: number } | "all" | "latest";
  /** Góc quay quanh thân (độ) khi dừng ở chương này */
  azimuth: number;
  /** Hệ số lùi xa camera (1 = vừa khung các đời đang tập trung) */
  zoom?: number;
  highlight?: string[];
  /** Chương cuối có nút điều hướng */
  cta?: boolean;
}

export const INTRO_CHAPTERS: IntroChapter[] = [
  {
    id: "mo-dau",
    kicker: "Phả hệ dòng tộc",
    title: "Gia Phả Họ Nguyễn Nhuận",
    body: "Cây có cội mới nảy cành xanh lá, nước có nguồn mới bể rộng sông sâu. Mỗi đốm sáng trên cây là một người con của dòng họ, nối liền từ Thủy tổ đến hôm nay.",
    focus: "all",
    azimuth: 20,
    zoom: 1.12,
  },
  {
    id: "thuy-to",
    kicker: "Đời thứ nhất",
    title: "Thủy Tổ Nguyễn Hữu Chỉ",
    body: "Tướng Công Nguyễn Hữu Chỉ, tức ông Kẻ Lấu, là cội nguồn của dòng họ. Mộ Ngài đặt tại Rú Tháp Sơn, xã Hậu Thành. Ngày kỵ 29 tháng 9.",
    focus: { from: 1, to: 4 },
    azimuth: 40,
    zoom: 1.35,
    highlight: ["nguyen-huu-chi"],
  },
  {
    id: "khai-hoang",
    kicker: "Đời thứ hai và thứ ba",
    title: "Khai hoang lập ấp",
    body: "Ông Nguyễn Lục Lang di cư ra xã Hậu Thành, mở đất sinh cơ. Con trai Ngài là ông Nguyễn Duy Chế có công lập ấp tại Sơn Thành, được triều đình tặng sắc Huyên Trứ Linh Phù Bản Thổ Tôn Thần. Ông Nguyễn Phúc Duyệt trở về Thanh Hóa làm Quan Tri phủ.",
    focus: { from: 2, to: 3 },
    azimuth: 110,
    zoom: 1.3,
    highlight: ["nguyen-luc-lang", "nguyen-duy-che", "nguyen-phuc-duyet"],
  },
  {
    id: "ong-to-nhanh",
    kicker: "Đời thứ tư",
    title: "Ông Tổ nhánh Nguyễn Nhuận",
    body: "Ông Nguyễn Dũng Cảm, hiệu ông Kẻ Ốc, là Ông Tổ của nhánh Nguyễn Nhuận, được Vương triều tặng sắc Bản Thổ Tôn Thần. Ngày kỵ 16 tháng 9 âm lịch. Cùng đời, ông Nguyễn Duy Chung làm Quan Tri huyện Thạch Hà, Hà Tĩnh.",
    focus: { from: 3, to: 5 },
    azimuth: 190,
    zoom: 1.15,
    highlight: ["nguyen-dung-cam", "nguyen-duy-chung"],
  },
  {
    id: "khoa-hoan",
    kicker: "Đời thứ năm đến thứ mười",
    title: "Rạng danh khoa hoạn",
    body: "Qua nhiều thế hệ, con cháu nối nhau ra gánh việc nước: Tri phủ Quốc Oai, Tri huyện Hương Sơn, Thăng quân Chỉ huy sứ, Hoàng triều Điện trung Từ đường, Ngụ trưởng Ưu binh. Ông Nguyễn Nhuận Trác đậu Tiến sĩ, làm rạng rỡ tổ tông.",
    focus: { from: 5, to: 10 },
    azimuth: 270,
    zoom: 1.05,
    highlight: [
      "nguyen-dung-than",
      "nguyen-duy-ha",
      "nguyen-phuc-sinh-gen9",
      "nguyen-huu-hang",
      "nguyen-nhuan-can",
      "nguyen-nhuan-trac-gen10",
    ],
  },
  {
    id: "sum-sue",
    kicker: "Hôm nay",
    title: "Cành lá sum suê",
    body: (s) =>
      `Từ một cội nguồn, dòng họ đã vươn thành ${s.generations} thế hệ với ${s.totalMembers} người con được ghi danh trong gia phả. Đời thứ ${s.maxGen} hiện có ${s.latestGenCount} người, và cây vẫn đang tiếp tục đâm chồi.`,
    focus: "latest",
    azimuth: 340,
    zoom: 1.1,
  },
  {
    id: "nho-nguon",
    kicker: "Lời nhắn hậu thế",
    title: "Uống nước nhớ nguồn",
    body: "Hãy luôn nhớ về cội nguồn, trân trọng và tôn kính tổ tiên. Sự đoàn kết, yêu thương và tinh thần tương trợ lẫn nhau là nền tảng để mỗi người vươn lên, xứng đáng với những gì các bậc tiền nhân đã gây dựng.",
    focus: "all",
    azimuth: 380,
    zoom: 1.25,
    cta: true,
  },
];

export function computeIntroStats(members: FamilyMember[]): IntroStats {
  if (!members.length) {
    return { totalMembers: 0, generations: 0, minGen: 1, maxGen: 1, alive: 0, latestGenCount: 0 };
  }
  const gens = members.map((m) => m.generation);
  const minGen = Math.min(...gens);
  const maxGen = Math.max(...gens);
  return {
    totalMembers: members.length,
    generations: new Set(gens).size,
    minGen,
    maxGen,
    alive: members.filter((m) => m.status === "Alive").length,
    latestGenCount: members.filter((m) => m.generation === maxGen).length,
  };
}
