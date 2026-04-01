import React, { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDoc, setDoc } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Save, X, Users, Calendar, Activity, AlertTriangle, CheckCircle2, Shield, ShieldAlert, Lock, Unlock, Download } from "lucide-react";
import { format } from "date-fns";

interface FamilyMember {
  id: string;
  name: string;
  birthDate?: string;
  deathDate?: string;
  gender: "Nam" | "Nữ";
  generation: number;
  branch?: string;
  role?: string;
  biography?: string;
  fatherId?: string;
  motherId?: string;
  photoUrl?: string;
  status?: "Alive" | "Deceased";
  address?: string;
  spouse?: string;
}

interface FamilyEvent {
  id: string;
  title: string;
  date: string;
  location?: string;
  description?: string;
  type: "Kỵ nhật" | "Hội họp" | "Khác";
}

interface UserDoc {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: "admin" | "user";
  isLocked: boolean;
  createdAt: any;
  lastLogin: any;
}

const Admin: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "events" | "users">("members");
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role || "user");
        }
      } else {
        setUserRole("user");
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = () => {
    return userRole === "admin" || user?.email?.toLowerCase().trim() === "hanhtoami@gmail.com";
  };

  const isSuperAdmin = (email: string | null | undefined) => {
    return email?.toLowerCase().trim() === "hanhtoami@gmail.com";
  };

  useEffect(() => {
    if (!user || !isAdmin()) return;

    const qMembers = query(collection(db, "members"), orderBy("generation", "asc"), orderBy("name", "asc"));
    const unsubMembers = onSnapshot(qMembers, 
      (snapshot) => {
        setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyMember)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "members");
      }
    );

    const qEvents = query(collection(db, "events"), orderBy("date", "desc"));
    const unsubEvents = onSnapshot(qEvents, 
      (snapshot) => {
        setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FamilyEvent)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "events");
      }
    );

    const qUsers = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubUsers = onSnapshot(qUsers, 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserDoc)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "users");
      }
    );

    return () => {
      unsubMembers();
      unsubEvents();
      unsubUsers();
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#8B2323]/20 border-t-[#8B2323] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin()) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-serif font-bold mb-4">Truy cập bị từ chối</h2>
        <p className="text-[#6B665F] max-w-md mb-8">
          Bạn không có quyền truy cập vào trang quản trị. Vui lòng đăng nhập bằng tài khoản quản trị viên.
        </p>
        {!user && (
          <button
            onClick={() => {
              const provider = new GoogleAuthProvider();
              signInWithPopup(auth, provider);
            }}
            className="px-8 py-3 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20"
          >
            Đăng nhập ngay
          </button>
        )}
      </div>
    );
  }

  const logActivity = async (action: string) => {
    try {
      await addDoc(collection(db, "activities"), {
        userName: user.displayName || user.email,
        userPhoto: user.photoURL,
        action,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (activeTab === "members") {
        if (editingItem) {
          await updateDoc(doc(db, "members", editingItem.id), formData);
          await logActivity(`đã cập nhật thông tin thành viên: ${formData.name}`);
        } else {
          await addDoc(collection(db, "members"), formData);
          await logActivity(`đã thêm thành viên mới: ${formData.name}`);
        }
      } else {
        if (editingItem) {
          await updateDoc(doc(db, "events", editingItem.id), formData);
          await logActivity(`đã cập nhật sự kiện: ${formData.title}`);
        } else {
          await addDoc(collection(db, "events"), formData);
          await logActivity(`đã thêm sự kiện mới: ${formData.title}`);
        }
      }
      setMessage({ type: "success", text: "Lưu thành công!" });
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({});
    } catch (error) {
      handleFirestoreError(error, editingItem ? OperationType.UPDATE : OperationType.CREATE, activeTab);
      setMessage({ type: "error", text: "Đã xảy ra lỗi khi lưu." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setItemToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { id, name } = itemToDelete;

    try {
      setLoading(true);
      await deleteDoc(doc(db, activeTab, id));
      let actionText = "";
      if (activeTab === "members") actionText = "thành viên";
      else if (activeTab === "events") actionText = "sự kiện";
      else actionText = "người dùng";
      
      await logActivity(`đã xóa ${actionText}: ${name}`);
      setMessage({ type: "success", text: "Xóa thành công!" });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, activeTab);
      setMessage({ type: "error", text: "Đã xảy ra lỗi khi xóa." });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserLock = async (userId: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      await updateDoc(doc(db, "users", userId), { isLocked: !currentStatus });
      await logActivity(`đã ${!currentStatus ? "khóa" : "mở khóa"} người dùng ID: ${userId}`);
      setMessage({ type: "success", text: `${!currentStatus ? "Khóa" : "Mở khóa"} thành công!` });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
      setMessage({ type: "error", text: "Đã xảy ra lỗi khi cập nhật trạng thái người dùng." });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserRole = async (userId: string, currentRole: string) => {
    try {
      setLoading(true);
      const newRole = currentRole === "admin" ? "user" : "admin";
      await updateDoc(doc(db, "users", userId), { role: newRole });
      await logActivity(`đã thay đổi quyền người dùng ID: ${userId} thành ${newRole}`);
      setMessage({ type: "success", text: "Cập nhật quyền thành công!" });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "users");
      setMessage({ type: "error", text: "Đã xảy ra lỗi khi cập nhật quyền người dùng." });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item: any = null) => {
    setEditingItem(item);
    setFormData(item || (activeTab === "members" ? { gender: "Nam", generation: 1, status: "Alive" } : { type: "Kỵ nhật" }));
    setImagePreview(item?.photoUrl || null);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for base64 in Firestore
        setMessage({ type: "error", text: "Kích thước ảnh quá lớn (tối đa 1MB)." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImagePreview(base64String);
        setFormData({ ...formData, photoUrl: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const importInitialData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const initialMembers = [
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
        { id: "nguyen-thi-lieu", name: "Nguyễn Thị Liễu", generation: 3, gender: "Nữ", status: "Deceased", fatherId: "nguyen-luc-lang" }
      ];

      for (const member of initialMembers) {
        const { id, ...data } = member;
        await setDoc(doc(db, "members", id), data);
      }

      await logActivity("đã thực hiện import dữ liệu 3 đời đầu tiên");
      setMessage({ type: "success", text: "Import dữ liệu thành công!" });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: "Import thất bại." });
    } finally {
      setLoading(false);
    }
  };

  const importNextData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const nextMembers = [
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
        { id: "nguyen-duy-sinh", name: "Nguyễn Duy Sinh", generation: 7, gender: "Nam", status: "Deceased", biography: "Tự vinh. Con trai Duy Bản - Cả 2 cha con đều chết. Ông: Nguyễn Duy Hiền thờ tự.", fatherId: "nguyen-duy-chinh" }
      ];

      for (const member of nextMembers) {
        const { id, ...data } = member;
        await setDoc(doc(db, "members", id), data);
      }

      await logActivity("đã thực hiện import dữ liệu đời 4 đến đời 7");
      setMessage({ type: "success", text: "Import dữ liệu đời 4-7 thành công!" });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: "Import thất bại." });
    } finally {
      setLoading(false);
    }
  };

  const importGen89Data = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const gen89Members = [
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
        { id: "nguyen-nhuan-mai", name: "Nguyễn Nhuận Mai", generation: 9, gender: "Nam", status: "Deceased", biography: "Vợ: Nguyễn Thị Kì.", spouse: "Nguyễn Thị Kì", fatherId: "nguyen-nhuan-tuc" }
      ];

      for (const member of gen89Members) {
        const { id, ...data } = member;
        await setDoc(doc(db, "members", id), data);
      }

      await logActivity("đã thực hiện import dữ liệu đời 8 và đời 9");
      setMessage({ type: "success", text: "Import dữ liệu đời 8-9 thành công!" });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: "Import thất bại." });
    } finally {
      setLoading(false);
    }
  };

  const importGen10Data = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const gen10Members = [
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
        { id: "nguyen-nhuan-nui", name: "Nguyễn Nhuận Núi", generation: 10, gender: "Nam", status: "Deceased", biography: "Húy Kỉ:.... Chi ông Thông - Yên Thịnh - Phúc Thành. Vợ: Nguyễn Thị Tâm.", spouse: "Nguyễn Thị Tâm", fatherId: "nguyen-nhuan-huy" }
      ];

      for (const member of gen10Members) {
        const { id, ...data } = member;
        await setDoc(doc(db, "members", id), data);
      }

      await logActivity("đã thực hiện import dữ liệu đời 10");
      setMessage({ type: "success", text: "Import dữ liệu đời 10 thành công!" });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: "Import thất bại." });
    } finally {
      setLoading(false);
    }
  };

  const importGen11To15Data = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const gen11To15Members = [
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
        
        // Gen 13
        { id: "nguyen-phuc-thanh-gen13", name: "Nguyễn Phúc Thành", generation: 13, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-loc" },
        { id: "nguyen-nhuan-dung-gen13", name: "Nguyễn Nhuận Dũng", generation: 13, gender: "Nam", status: "Alive", fatherId: "nguyen-nhuan-minh-gen12" },
        
        // Gen 14
        { id: "nguyen-phuc-duy", name: "Nguyễn Phúc Duy", generation: 14, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-thanh-gen13" },
        
        // Gen 15
        { id: "nguyen-phuc-hoang", name: "Nguyễn Phúc Hoàng", generation: 15, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-duy" }
      ];

      for (const member of gen11To15Members) {
        const { id, ...data } = member;
        await setDoc(doc(db, "members", id), data);
      }

      await logActivity("đã thực hiện import dữ liệu đời 11 đến 15");
      setMessage({ type: "success", text: "Import dữ liệu đời 11-15 thành công!" });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: "Import thất bại." });
    } finally {
      setLoading(false);
    }
  };

  const importGen16To22Data = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const gen16To22Members = [
        // Gen 16
        { id: "nguyen-phuc-lam", name: "Nguyễn Phúc Lâm", generation: 16, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-hoang" },
        
        // Gen 17
        { id: "nguyen-phuc-son", name: "Nguyễn Phúc Sơn", generation: 17, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-lam" },
        
        // Gen 18
        { id: "nguyen-phuc-hai-gen18", name: "Nguyễn Phúc Hải", generation: 18, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-son" },
        
        // Gen 19
        { id: "nguyen-phuc-quan", name: "Nguyễn Phúc Quân", generation: 19, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-hai-gen18" },
        
        // Gen 20
        { id: "nguyen-phuc-tu", name: "Nguyễn Phúc Tú", generation: 20, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-quan" },
        
        // Gen 21
        { id: "nguyen-phuc-khoi", name: "Nguyễn Phúc Khôi", generation: 21, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-tu" },
        
        // Gen 22 - The youngest generation
        { id: "nguyen-phuc-an", name: "Nguyễn Phúc An", generation: 22, gender: "Nam", status: "Alive", fatherId: "nguyen-phuc-khoi" }
      ];

      for (const member of gen16To22Members) {
        const { id, ...data } = member;
        await setDoc(doc(db, "members", id), data);
      }

      await logActivity("đã thực hiện import dữ liệu đời 16 đến 22");
      setMessage({ type: "success", text: "Import dữ liệu đời 16-22 thành công!" });
    } catch (error) {
      console.error("Import failed:", error);
      setMessage({ type: "error", text: "Import thất bại." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Quản trị Hệ thống</h1>
          <p className="text-[#6B665F]">Quản lý danh sách thành viên và sự kiện gia đình.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {activeTab === "members" && (
            <div className="flex gap-2">
              <button
                onClick={importInitialData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                Đời 1-3
              </button>
              <button
                onClick={importNextData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                Đời 4-7
              </button>
              <button
                onClick={importGen89Data}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                Đời 8-9
              </button>
              <button
                onClick={importGen10Data}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                Đời 10
              </button>
              <button
                onClick={importGen11To15Data}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-colors shadow-lg shadow-pink-600/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                Đời 11-15
              </button>
              <button
                onClick={importGen16To22Data}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50 text-xs"
              >
                <Download className="w-4 h-4" />
                Đời 16-22
              </button>
            </div>
          )}
          {activeTab !== "users" && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-6 py-3 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20"
            >
              <Plus className="w-5 h-5" />
              {activeTab === "members" ? "Thêm thành viên" : "Thêm sự kiện"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#E5E1D8] overflow-x-auto">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-6 py-4 font-bold text-sm transition-all relative whitespace-nowrap ${
            activeTab === "members" ? "text-[#8B2323]" : "text-[#A19D96] hover:text-[#2D2A26]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Thành viên ({members.length})
          </div>
          {activeTab === "members" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#8B2323] rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`px-6 py-4 font-bold text-sm transition-all relative whitespace-nowrap ${
            activeTab === "events" ? "text-[#8B2323]" : "text-[#A19D96] hover:text-[#2D2A26]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Sự kiện ({events.length})
          </div>
          {activeTab === "events" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#8B2323] rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-6 py-4 font-bold text-sm transition-all relative whitespace-nowrap ${
            activeTab === "users" ? "text-[#8B2323]" : "text-[#A19D96] hover:text-[#2D2A26]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Người dùng ({users.length})
          </div>
          {activeTab === "users" && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#8B2323] rounded-t-full" />}
        </button>
      </div>

      {/* Success/Error Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto">
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Table */}
      <div className="bg-white rounded-3xl border border-[#E5E1D8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#FDFCF9] border-b border-[#E5E1D8]">
              <tr>
                {activeTab === "members" ? (
                  <>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Thành viên</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Thế hệ</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Giới tính</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Trạng thái</th>
                  </>
                ) : activeTab === "events" ? (
                  <>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Sự kiện</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Ngày diễn ra</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Loại</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Người dùng</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Vai trò</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Trạng thái</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest">Đăng nhập cuối</th>
                  </>
                )}
                <th className="px-6 py-4 text-xs font-bold uppercase text-[#A19D96] tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E1D8]">
              {activeTab === "members" ? (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.photoUrl || `https://ui-avatars.com/api/?name=${member.name}`}
                          className="w-10 h-10 rounded-full border border-[#E5E1D8]"
                        />
                        <div className="font-bold text-[#2D2A26]">{member.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6B665F]">Thế hệ {member.generation}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        member.gender === "Nam" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                      }`}>
                        {member.gender}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        member.status === "Alive" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-600"
                      }`}>
                        {member.status === "Alive" ? "Còn sống" : "Đã mất"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openModal(member)} className="p-2 text-[#6B665F] hover:text-[#8B2323] hover:bg-[#8B2323]/5 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(member.id, member.name)} className="p-2 text-[#6B665F] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : activeTab === "events" ? (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#2D2A26]">{event.title}</td>
                    <td className="px-6 py-4 text-sm text-[#6B665F]">
                      {format(new Date(event.date), "HH:mm, d/M/yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-[#FDFCF9] border border-[#E5E1D8] rounded text-[10px] font-bold uppercase text-[#8B2323]">
                        {event.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openModal(event)} className="p-2 text-[#6B665F] hover:text-[#8B2323] hover:bg-[#8B2323]/5 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteClick(event.id, event.title)} className="p-2 text-[#6B665F] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`}
                          className="w-10 h-10 rounded-full border border-[#E5E1D8]"
                        />
                        <div className="flex flex-col">
                          <div className="font-bold text-[#2D2A26]">{u.displayName}</div>
                          <div className="text-xs text-[#6B665F]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          u.role === "admin" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          {u.role}
                        </span>
                        {isSuperAdmin(user?.email) && u.email !== user?.email && (
                          <button 
                            onClick={() => toggleUserRole(u.id, u.role)}
                            className="p-1 text-[#A19D96] hover:text-[#8B2323] transition-colors"
                            title="Thay đổi quyền"
                          >
                            <ShieldAlert className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        !u.isLocked ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}>
                        {!u.isLocked ? "Hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6B665F]">
                      {u.lastLogin?.toDate ? format(u.lastLogin.toDate(), "d/M/yyyy") : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.email !== user?.email && (
                          <>
                            <button 
                              onClick={() => toggleUserLock(u.id, u.isLocked)} 
                              className={`p-2 rounded-lg transition-all ${
                                u.isLocked ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"
                              }`}
                              title={u.isLocked ? "Mở khóa" : "Khóa"}
                            >
                              {u.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(u.id, u.displayName)} 
                              className="p-2 text-[#6B665F] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Xóa người dùng"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 bottom-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] max-h-[85vh] bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
              <form onSubmit={handleSave} className="flex flex-col min-h-0">
                <div className="p-8 pb-4 flex justify-between items-center border-b border-[#E5E1D8]">
                  <h2 className="text-2xl font-serif font-bold">
                    {editingItem ? "Chỉnh sửa" : "Thêm mới"} {activeTab === "members" ? "thành viên" : "sự kiện"}
                  </h2>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-[#A19D96] hover:text-[#2D2A26]">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto flex-grow">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeTab === "members" ? (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Hình ảnh đại diện</label>
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full border-2 border-dashed border-[#E5E1D8] flex items-center justify-center overflow-hidden bg-[#FDFCF9]">
                            {imagePreview ? (
                              <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                            ) : (
                              <Users className="w-8 h-8 text-[#A19D96] opacity-20" />
                            )}
                          </div>
                          <div className="flex-grow">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                              id="avatar-upload"
                            />
                            <label
                              htmlFor="avatar-upload"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E1D8] rounded-xl text-sm font-bold text-[#6B665F] cursor-pointer hover:bg-gray-50 transition-all"
                            >
                              <Plus className="w-4 h-4" />
                              Chọn ảnh
                            </label>
                            <p className="text-[10px] text-[#A19D96] mt-2">Định dạng: JPG, PNG. Tối đa 1MB.</p>
                          </div>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Họ và tên</label>
                        <input
                          required
                          type="text"
                          value={formData.name || ""}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Thế hệ</label>
                        <select
                          required
                          value={formData.generation || 1}
                          onChange={(e) => setFormData({ ...formData, generation: Number(e.target.value) })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        >
                          {[...Array(30)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Giới tính</label>
                        <select
                          value={formData.gender || "Nam"}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        >
                          <option value="Nam">Nam</option>
                          <option value="Nữ">Nữ</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Ngày sinh</label>
                        <input
                          type="text"
                          placeholder="VD: 12/05/1980"
                          value={formData.birthDate || ""}
                          onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Trạng thái</label>
                        <select
                          value={formData.status || "Alive"}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        >
                          <option value="Alive">Còn sống</option>
                          <option value="Deceased">Đã mất</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Nơi sống</label>
                        <input
                          type="text"
                          placeholder="VD: Hà Nội, Việt Nam"
                          value={formData.address || ""}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Người Phối Ngẫu (cách nhau bởi dấu phẩy)</label>
                        <input
                          type="text"
                          placeholder="VD: Nguyễn Thị A, Trần Thị B"
                          value={formData.spouse || ""}
                          onChange={(e) => setFormData({ ...formData, spouse: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Tiểu sử</label>
                        <textarea
                          rows={3}
                          value={formData.biography || ""}
                          onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>

                      {/* Relationship Fields */}
                      <div className="md:col-span-2 border-t border-[#E5E1D8] pt-6 mt-2">
                        <h3 className="text-sm font-bold text-[#8B2323] mb-4">Mối quan hệ gia đình</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Cha (Father)</label>
                            <select
                              value={formData.fatherId || ""}
                              onChange={(e) => setFormData({ ...formData, fatherId: e.target.value })}
                              className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                            >
                              <option value="">Không có / Chưa rõ</option>
                              {members
                                .filter(m => m.id !== editingItem?.id && m.gender === "Nam")
                                .map(m => (
                                  <option key={m.id} value={m.id}>{m.name} (Thế hệ {m.generation})</option>
                                ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Mẹ (Mother)</label>
                            <select
                              value={formData.motherId || ""}
                              onChange={(e) => setFormData({ ...formData, motherId: e.target.value })}
                              className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                            >
                              <option value="">Không có / Chưa rõ</option>
                              {members
                                .filter(m => m.id !== editingItem?.id && m.gender === "Nữ")
                                .map(m => (
                                  <option key={m.id} value={m.id}>{m.name} (Thế hệ {m.generation})</option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Tiêu đề sự kiện</label>
                        <input
                          required
                          type="text"
                          value={formData.title || ""}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Thời gian</label>
                        <input
                          required
                          type="datetime-local"
                          value={formData.date ? formData.date.slice(0, 16) : ""}
                          onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Loại sự kiện</label>
                        <select
                          value={formData.type || "Kỵ nhật"}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        >
                          <option value="Kỵ nhật">Kỵ nhật</option>
                          <option value="Hội họp">Hội họp</option>
                          <option value="Khác">Khác</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Địa điểm</label>
                        <input
                          type="text"
                          value={formData.location || ""}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase text-[#A19D96] mb-2">Mô tả</label>
                        <textarea
                          rows={3}
                          value={formData.description || ""}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20"
                        />
                      </div>
                    </>
                  )}
                  </div>
                </div>

                <div className="p-6 pt-4 border-t border-[#E5E1D8] flex gap-4 bg-[#FDFCF9] sticky bottom-0 z-20">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-grow py-3 px-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-grow py-3 px-4 bg-[#8B2323] text-white rounded-2xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    Lưu thông tin
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-[#E5E1D8]"
          >
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6 mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-serif font-bold text-[#2D2A26] text-center mb-2">Xác nhận xóa</h3>
            <p className="text-[#6B665F] text-center mb-8">
              Bạn có chắc chắn muốn xóa <span className="font-bold text-[#2D2A26]">"{itemToDelete?.name}"</span>? 
              Hành động này không thể hoàn tác.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="py-3 px-6 bg-[#FDFCF9] border border-[#E5E1D8] text-[#6B665F] font-bold rounded-2xl hover:bg-white transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="py-3 px-6 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Admin;
