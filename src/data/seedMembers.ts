import type { MemberInput } from "../types";

/**
 * Dữ liệu gốc đời 1 đến 12 họ Nguyễn Nhuận (81 thành viên). Đời 13 trở đi sẽ nhập tay trong trang Quản trị, dùng cho nút "Nạp dữ liệu gốc" ở trang Quản trị.
 * id là document id cố định trong collection members để fatherId tham chiếu được.
 */
export interface SeedMember extends MemberInput {
  id: string;
}

export const SEED_MEMBERS: SeedMember[] = [
  // Gen 1
  { id: "nguyen-huu-chi", name: "Nguyễn Hữu Chỉ", generation: 1, gender: "Nam", status: "Deceased", biography: "Tướng Công. Kỉ: 29 - 9. Mộ tại Rú Tháp Sơn - Xã Hậu Thành. Tức ông Kẻ Lấu." },
  
  // Gen 2
  { id: "nguyen-huu-han", name: "Nguyễn Hữu Hân", generation: 2, gender: "Nam", status: "Deceased", address: "Xứ Ngọc Lấu - xã Vĩnh Thành", fatherId: "nguyen-huu-chi" },
  { id: "nguyen-huu-hoan", name: "Nguyễn Hữu Hoan", generation: 2, gender: "Nam", status: "Deceased", address: "Xứ Đỉnh Tải - xã Vĩnh Thành", fatherId: "nguyen-huu-chi" },
  { id: "nguyen-huu-hoa", name: "Nguyễn Hữu Hòa", generation: 2, gender: "Nam", status: "Deceased", address: "Xứ Cồn Quánh - xã Vĩnh Thành", fatherId: "nguyen-huu-chi" },
  { id: "nguyen-phuc-duyet", name: "Nguyễn Phúc Duyệt", generation: 2, gender: "Nam", status: "Deceased", biography: "Trở về tỉnh Thanh Hóa và làm Quan Tri Phủ", fatherId: "nguyen-huu-chi" },
  { id: "nguyen-thi-cong", name: "Nguyễn Thị Công", generation: 2, gender: "Nữ", status: "Deceased", biography: "Lấy chồng người họ Ngô", fatherId: "nguyen-huu-chi" },
  { id: "nguyen-luc-lang", name: "Nguyễn Lục Lang", generation: 2, gender: "Nam", status: "Deceased", biography: "Tự Trực Tâm, Tức Nguyễn Duy Bòi. Di cư ra xã Hậu Thành. Húy kỉ: 17-02.", spouse: "Lê Nhật Nương", fatherId: "nguyen-huu-chi" },
  
  // Gen 3 (Children of Nguyễn Lục Lang)
  { id: "nguyen-nhat-lang", name: "Nguyễn Nhất Lang", generation: 3, gender: "Nam", status: "Deceased", biography: "Duy Nhất. Kỉ: 06-05 âl.", spouse: "Nguyễn Nhất Nương", fatherId: "nguyen-luc-lang" },
  { id: "nguyen-duy-quang", name: "Nguyễn Duy Quang", generation: 3, gender: "Nam", status: "Deceased", biography: "Phiêu cư. Chưa rõ ở đâu", fatherId: "nguyen-luc-lang" },
  { id: "nguyen-duy-che", name: "Nguyễn Duy Chế", generation: 3, gender: "Nam", status: "Deceased", address: "Xã Sơn Thành - Huyện Yên Thành", biography: "Có công lập ấp - Được tặng sắc HUYÊN TRỨ LINH PHÙ BẢN THỔ TÔN THẦN", fatherId: "nguyen-luc-lang" },
  { id: "nguyen-thi-tien", name: "Nguyễn Thị Tiến", generation: 3, gender: "Nữ", status: "Deceased", fatherId: "nguyen-luc-lang" },
  { id: "nguyen-thi-may", name: "Nguyễn Thị Mày", generation: 3, gender: "Nữ", status: "Deceased", fatherId: "nguyen-luc-lang" },
  { id: "nguyen-thi-tru", name: "Nguyễn Thị Trụ", generation: 3, gender: "Nữ", status: "Deceased", fatherId: "nguyen-luc-lang" },
  { id: "nguyen-thi-lieu", name: "Nguyễn Thị Liễu", generation: 3, gender: "Nữ", status: "Deceased", fatherId: "nguyen-luc-lang" },

  // Gen 4 (Children of Nguyễn Nhất Lang)
  { id: "nguyen-duy-chuc", name: "Nguyễn Duy Chúc", generation: 4, gender: "Nam", status: "Deceased", biography: "Tại nhánh Hậu Thành - Ông Nguyễn Duy Lợi làm Tộc trưởng.", fatherId: "nguyen-nhat-lang" },
  { id: "nguyen-duy-chung", name: "Nguyễn Duy Chung", generation: 4, gender: "Nam", status: "Deceased", biography: "Làm Quan tri huyện, huyện Thạch Hà - Tỉnh Hà Tĩnh.", fatherId: "nguyen-nhat-lang" },
  { id: "nguyen-dung-cam", name: "Nguyễn Dũng Cảm", generation: 4, gender: "Nam", status: "Deceased", biography: "Ông Tổ của nhánh Nguyễn Nhuận. Húy Kỉ: 16 - 9 ÂL. Hiệu ông Kẻ Ốc. Được Vương triều tặng sắc: BẢN THỔ TÔN THẦN.", spouse: "Nguyễn Thị Ứng", fatherId: "nguyen-nhat-lang" },
  { id: "nguyen-thuc", name: "Nguyễn Thúc", generation: 4, gender: "Nam", status: "Deceased", biography: "Chưa rõ đi đâu và ở đâu.", fatherId: "nguyen-nhat-lang" },
  
  // Gen 5 (Children of Nguyễn Dũng Cảm)
  { id: "nguyen-dung-than", name: "Nguyễn Dũng Thân", generation: 5, gender: "Nam", status: "Deceased", biography: "Tự hành vi. Húy Kỉ: 06 - 10. Làm quan tri phủ PHỦ QUỐC OAI.", spouse: "Nguyễn Thị Thanh", fatherId: "nguyen-dung-cam" },
  { id: "nguyen-thi-tinh", name: "Nguyễn Thị Tình", generation: 5, gender: "Nữ", status: "Deceased", fatherId: "nguyen-dung-cam" },
  
  // Gen 6 (Children of Nguyễn Dũng Thân)
  { id: "nguyen-duy-chinh", name: "Nguyễn Duy Chính", generation: 6, gender: "Nam", status: "Deceased", biography: "Tự Minh Lý. Kỉ: 03 - 7.", fatherId: "nguyen-dung-than" },
  { id: "nguyen-duy-tri", name: "Nguyễn Duy Trị", generation: 6, gender: "Nam", status: "Deceased", biography: "Ông Trị phiêu cư, chưa rõ.", fatherId: "nguyen-dung-than" },
  
  // Gen 7 (Children of Nguyễn Duy Chính)
  { id: "nguyen-duy-ngu", name: "Nguyễn Duy Ngu", generation: 7, gender: "Nam", status: "Deceased", biography: "Tự đức. Chi ông Thông - Yên Thịnh - Phúc Thành.", spouse: "Nguyễn Thị Tâm", fatherId: "nguyen-duy-chinh" },
  { id: "nguyen-duy-phu", name: "Nguyễn Duy Phú", generation: 7, gender: "Nam", status: "Deceased", biography: "Tự chương. Húy Kỉ: 06 - 3. Tại nhà thờ Tổ - Xuân Viên - Phúc Thành.", fatherId: "nguyen-duy-chinh" },
  { id: "nguyen-duy-sinh", name: "Nguyễn Duy Sinh", generation: 7, gender: "Nam", status: "Deceased", biography: "Tự vinh. Con trai Duy Bản - Cả 2 cha con đều chết. Ông: Nguyễn Duy Hiền thờ tự.", fatherId: "nguyen-duy-chinh" },

  // Gen 8
  { id: "nguyen-nhuan-tuc", name: "Nguyễn Nhuận Túc", generation: 8, gender: "Nam", status: "Deceased", biography: "Chi ông Thông. Húy Kỉ:.... Vợ: Mai Thị Hành.", spouse: "Mai Thị Hành", fatherId: "nguyen-duy-ngu" },
  { id: "nguyen-nhuan-co", name: "Nguyễn Nhuận Cơ", generation: 8, gender: "Nam", status: "Deceased", biography: "Chưa rõ.", fatherId: "nguyen-duy-ngu" },
  { id: "nguyen-nhuan-tai-gen8", name: "Nguyễn Nhuận Tải", generation: 8, gender: "Nam", status: "Deceased", biography: "Chưa rõ.", fatherId: "nguyen-duy-ngu" },
  { id: "nguyen-nhuan-le-gen8", name: "Nguyễn Nhuận Lệ", generation: 8, gender: "Nam", status: "Deceased", biography: "Chưa rõ.", fatherId: "nguyen-duy-ngu" },
  { id: "nguyen-duy-ha", name: "Nguyễn Duy Hà", generation: 8, gender: "Nam", status: "Deceased", biography: "Tự Nam. Tại Chi ông Nguyễn Đình Hoàng - Đức Thành. Làm Quan Tri huyện Hương Sơn, Hà Tĩnh.", fatherId: "nguyen-duy-phu" },
  { id: "nguyen-duy-hien", name: "Nguyễn Duy Hiến", generation: 8, gender: "Nam", status: "Deceased", biography: "Tự Du. Tại nhà thờ Tổ ông Niệm Tộc trưởng. Vợ: Nguyễn Thị Viêm.", spouse: "Nguyễn Thị Viêm", fatherId: "nguyen-duy-phu" },
  { id: "nguyen-duy-tai", name: "Nguyễn Duy Tài", generation: 8, gender: "Nam", status: "Deceased", biography: "Tức Huỳnh. Tự Sinh. Tại ông Long Trinh Tộc trưởng. Vợ: Dương Thị Tình.", spouse: "Dương Thị Tình", fatherId: "nguyen-duy-phu" },
  { id: "nguyen-duy-than", name: "Nguyễn Duy Thận", generation: 8, gender: "Nam", status: "Deceased", biography: "Tự Đăng. Tại Văn Thành, ông Hưng (Phổ) Tộc trưởng.", fatherId: "nguyen-duy-phu" },

  // Gen 9
  { id: "nguyen-duy-hai", name: "Nguyễn Duy Hải", generation: 9, gender: "Nam", status: "Deceased", fatherId: "nguyen-duy-ha" },
  { id: "nguyen-nhuan-ba", name: "Nguyễn Nhuận Bá", generation: 9, gender: "Nam", status: "Deceased", biography: "Chi ông Niệm - Phúc Thành. Vợ 1: Phan Thị Tính, 2: Phan Thị Thiện, 3: Trần Thị Niệm.", fatherId: "nguyen-duy-hien" },
  { id: "nguyen-nhuan-due", name: "Nguyễn Nhuận Duệ", generation: 9, gender: "Nam", status: "Deceased", biography: "Húy Kỉ: 30 - 9. Chi ông Niêm - Phúc Thành. Vợ: Nguyễn Thị Kiệm.", spouse: "Nguyễn Thị Kiệm", fatherId: "nguyen-duy-hien" },
  { id: "nguyen-thi-dinh", name: "Nguyễn Thị Đình", generation: 9, gender: "Nữ", status: "Deceased", fatherId: "nguyen-duy-hien" },
  { id: "nguyen-huu-hang", name: "Nguyễn Hựu Hằng", generation: 9, gender: "Nam", status: "Deceased", biography: "Chức HOÀNG TRIỀU ĐIỆN TRUNG TỪ ĐƯỜNG. Vợ 1: Nguyễn Thị Chiên, 2: Nguyễn Thị Tần.", fatherId: "nguyen-duy-tai" },
  { id: "nguyen-nhuan-oanh", name: "Nguyễn Nhuận Oánh", generation: 9, gender: "Nam", status: "Deceased", biography: "Tự trác. Chi ông Trọng - Phúc Thành. Vợ: Trần Thị Ất.", spouse: "Trần Thị Ất", fatherId: "nguyen-duy-tai" },
  { id: "nguyen-phuc-sinh-gen9", name: "Nguyễn Phúc Sinh", generation: 9, gender: "Nam", status: "Deceased", biography: "Tự viêm. Chức vụ: THĂNG QUÂN CHỈ HUY SỨ. Chi ông Hùng, Loan - Hậu Thành.", fatherId: "nguyen-duy-tai" },
  { id: "nguyen-thi-hong", name: "Nguyễn Thị Hồng", generation: 9, gender: "Nữ", status: "Deceased", fatherId: "nguyen-duy-tai" },
  { id: "nguyen-hue-nghiem", name: "Nguyễn Huệ Nghiêm", generation: 9, gender: "Nam", status: "Deceased", biography: "Chi ông Hưng ( Phổ) - Văn Thành. Vợ: Nguyễn Thị Chấn.", spouse: "Nguyễn Thị Chấn", fatherId: "nguyen-duy-than" },
  { id: "nguyen-tho-thang", name: "Nguyễn Thọ Thắng", generation: 9, gender: "Nam", status: "Deceased", biography: "Chi ông Hưng ( Phổ) - Văn Thành. Vợ 1: Đào Thị Đôn, 2: Nguyễn Thị Cựa, 3: Ngô Thị Mãi.", fatherId: "nguyen-duy-than" },
  { id: "nguyen-nhuan-nam", name: "Nguyễn Nhuận Nam", generation: 9, gender: "Nam", status: "Deceased", fatherId: "nguyen-nhuan-tuc" },
  { id: "nguyen-nhuan-huy", name: "Nguyễn Nhuận Huy", generation: 9, gender: "Nam", status: "Deceased", biography: "Vợ: Nguyễn Thị Bảo.", spouse: "Nguyễn Thị Bảo", fatherId: "nguyen-nhuan-tuc" },
  { id: "nguyen-nhuan-mai", name: "Nguyễn Nhuận Mai", generation: 9, gender: "Nam", status: "Deceased", biography: "Vợ: Nguyễn Thị Kì.", spouse: "Nguyễn Thị Kì", fatherId: "nguyen-nhuan-tuc" },

  // Children of Nguyễn Duy Hải
  { id: "nguyen-phuc-huyen", name: "Nguyễn Phúc Huyền", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ:.... Chi ông Hoàng - Đức Thành. Vợ: Nguyễn Thị Duyên.", spouse: "Nguyễn Thị Duyên", fatherId: "nguyen-duy-hai" },
  { id: "nguyen-phuc-dinh", name: "Nguyễn Phúc Đinh", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ:.... Chi ông Hoàng - Đức Thành. Vợ 1: Trần Thị Sĩ, 2: Trần Thị Tao.", fatherId: "nguyen-duy-hai" },
  { id: "nguyen-phuc-than", name: "Nguyễn Phúc Thân", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ:.... Chi ông Hoàng - Đức Thành. Vợ: Trần Thị Đồng.", spouse: "Trần Thị Đồng", fatherId: "nguyen-duy-hai" },
  { id: "nguyen-phuc-tuu", name: "Nguyễn Phúc Tửu", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ:.... Chi ông Hoàng - Đức Thành. Vợ: Bùi Thị Chương.", spouse: "Bùi Thị Chương", fatherId: "nguyen-duy-hai" },
  { id: "nguyen-phuc-yen", name: "Nguyễn Phúc Yên", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ:.... Chi ông Hoàng - Đức Thành. Vợ: Bùi Thị Phương.", spouse: "Bùi Thị Phương", fatherId: "nguyen-duy-hai" },

  // Children of Nguyễn Nhuận Bá
  { id: "nguyen-nhuan-dong", name: "Nguyễn Nhuận Đống", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ.... Chi ông Niệm - Phúc Thành. Vợ: Hoàng Thị Đôn.", spouse: "Hoàng Thị Đôn", fatherId: "nguyen-nhuan-ba" },

  // Children of Nguyễn Nhuận Duệ
  { id: "nguyen-nhuan-tap", name: "Nguyễn Nhuận Tập", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ: 20 - 5. Chi ông Niệm - Phúc Thành.", fatherId: "nguyen-nhuan-due" },
  { id: "nguyen-nhuan-trach", name: "Nguyễn Nhuận Trạch", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ: 06 - 2. Chi ông Niệm - Phúc Thành. Vợ: Nguyễn Thị Nhự.", spouse: "Nguyễn Thị Nhự", fatherId: "nguyen-nhuan-due" },
  { id: "nguyen-nhuan-hoe", name: "Nguyễn Nhuận Hòe", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ: 09 - 2. Chi ông Niệm - Phúc Thành. Vợ: Nguyễn Thị Hẳn.", spouse: "Nguyễn Thị Hẳn", fatherId: "nguyen-nhuan-due" },

  // Children of Nguyễn Hựu Hằng
  { id: "nguyen-nhuan-can", name: "Nguyễn Nhuận Căn", generation: 10, gender: "Nam", status: "Deceased", biography: "Chức vụ: NGỤ TRƯỞNG ƯU BÌNH và THẬP LÍ HẦU. Chi ông Long (Trinh) - Phúc Thành. Vợ: Phan Thị Phúc.", spouse: "Phan Thị Phúc", fatherId: "nguyen-huu-hang" },
  { id: "nguyen-nhuan-duc-gen10", name: "Nguyễn Nhuận Dục", generation: 10, gender: "Nam", status: "Deceased", fatherId: "nguyen-huu-hang" },
  { id: "nguyen-nhuan-chi-gen10", name: "Nguyễn Nhuận Chí", generation: 10, gender: "Nam", status: "Deceased", fatherId: "nguyen-huu-hang" },
  { id: "nguyen-nhuan-thao", name: "Nguyễn Nhuận Thảo", generation: 10, gender: "Nam", status: "Deceased", fatherId: "nguyen-huu-hang" },

  // Children of Nguyễn Nhuận Oánh
  { id: "nguyen-nhuan-trac-gen10", name: "Nguyễn Nhuận Trác", generation: 10, gender: "Nam", status: "Deceased", biography: "Chức vụ: ĐẬU TIẾN SĨ. Húy Kỉ: 01 - 4 âl. Chi ông Long (Trọng) Phúc Thành. Vợ: Nguyễn Thị Xuyên.", spouse: "Nguyễn Thị Xuyên", fatherId: "nguyen-nhuan-oanh" },
  { id: "nguyen-nhuan-boi-gen10", name: "Nguyễn Nhuận Bòi", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ: .... Chi ông Long (Trọng) Phúc Thành.", fatherId: "nguyen-nhuan-oanh" },

  // Children of Nguyễn Phúc Sinh
  { id: "nguyen-trong-nhuong", name: "Nguyễn Trọng Nhương", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ: 29 - 12. Chi ông Hùng, Loan - Hậu Thành.", fatherId: "nguyen-phuc-sinh-gen9" },

  // Children of Nguyễn Thọ Thắng
  { id: "nguyen-tho-cung", name: "Nguyễn Thọ Cung", generation: 10, gender: "Nam", status: "Deceased", biography: "Kỉ:.... Chi ông Hưng (Phổ) Văn Thành.", fatherId: "nguyen-tho-thang" },
  { id: "nguyen-tho-sac", name: "Nguyễn Thọ Sắc", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ.... Chi ông Hưng (Phổ) Văn Thành. Vợ 1: Nguyễn Thị Thích, 2: Nguyễn Thị Vinh.", fatherId: "nguyen-tho-thang" },

  // Children of Nguyễn Nhuận Nam
  { id: "nguyen-nhuan-da", name: "Nguyễn Nhuận Đa", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ:.... Chi ông Thông - Yên Thịnh - Phúc Thành. Vợ 1: Nguyễn Thị Hậu, 2: Nguyễn Thị Sinh.", fatherId: "nguyen-nhuan-nam" },

  // Children of Nguyễn Nhuận Huy
  { id: "nguyen-nhuan-tri-gen10", name: "Nguyễn Nhuận Trí", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ:.... Chi ông Thông - Yên Thịnh - Phúc Thành. Vợ: Phan Thị Tư.", spouse: "Phan Thị Tư", fatherId: "nguyen-nhuan-huy" },
  { id: "nguyen-nhuan-nui", name: "Nguyễn Nhuận Núi", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ:.... Chi ông Thông - Yên Thịnh - Phúc Thành. Vợ: Nguyễn Thị Tâm.", spouse: "Nguyễn Thị Tâm", fatherId: "nguyen-nhuan-huy" },

  // Gen 11 - Representative members from major branches
  { id: "nguyen-phuc-can", name: "Nguyễn Phúc Cẩn", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-phuc-huyen" },
  { id: "nguyen-phuc-vuong", name: "Nguyễn Phúc Vượng", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-phuc-huyen" },
  { id: "nguyen-nhuan-truong", name: "Nguyễn Nhuận Trường", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-nhuan-dong" },
  { id: "nguyen-nhuan-hoc", name: "Nguyễn Nhuận Học", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-nhuan-tap" },
  { id: "nguyen-nhuan-co-gen11", name: "Nguyễn Nhuận Cơ", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-nhuan-can" },
  { id: "nguyen-nhuan-long-gen11", name: "Nguyễn Nhuận Long", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-nhuan-trac-gen10" },
  { id: "nguyen-trong-hung", name: "Nguyễn Trọng Hùng", generation: 11, gender: "Nam", status: "Alive", fatherId: "nguyen-trong-nhuong" },
  { id: "nguyen-trong-loan", name: "Nguyễn Trọng Loan", generation: 11, gender: "Nam", status: "Alive", fatherId: "nguyen-trong-nhuong" },
  { id: "nguyen-tho-hung-gen11", name: "Nguyễn Thọ Hưng", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-tho-cung" },
  { id: "nguyen-tho-pho-gen11", name: "Nguyễn Thọ Phổ", generation: 11, gender: "Nam", status: "Deceased", fatherId: "nguyen-tho-sac" },
  { id: "nguyen-nhuan-thong-gen11", name: "Nguyễn Nhuận Thông", generation: 11, gender: "Nam", status: "Alive", fatherId: "nguyen-nhuan-da" },
  
  // Gen 12
  { id: "nguyen-phuc-loc", name: "Nguyễn Phúc Lộc", generation: 12, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-can" },
  { id: "nguyen-nhuan-minh-gen12", name: "Nguyễn Nhuận Minh", generation: 12, gender: "Nam", status: "Alive", fatherId: "nguyen-nhuan-truong" },
  { id: "nguyen-trong-anh", name: "Nguyễn Trọng Anh", generation: 12, gender: "Nam", status: "Alive", fatherId: "nguyen-trong-hung" },
  
  
  

  
  
  
  
  
  
];
