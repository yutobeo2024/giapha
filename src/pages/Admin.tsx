import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Lock,
  Unlock,
  Download,
  UserCheck,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { useAuthContext } from "../hooks/AuthContext";
import { uploadPhoto } from "../lib/image";
import { avatarUrl } from "../lib/avatar";
import { SEED_MEMBERS } from "../data/seedMembers";
import { ROLE_LABEL, STATUS_LABEL, type FamilyMember, type FamilyEvent, type UserDoc, type UserRole } from "../types";

type Tab = "members" | "events" | "users";
type FormState = Partial<Omit<FamilyMember, "id">> & Partial<Omit<FamilyEvent, "id">>;
type Message = { type: "success" | "error"; text: string };

const inputCls =
  "w-full px-4 py-3 bg-[#FDFCF9] border border-[#E5E1D8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B2323]/20";
const labelCls = "block text-xs font-bold uppercase text-[#A19D96] mb-2";

const Admin: React.FC = () => {
  const { user, isEditor, isAdmin, isSuperAdmin, loading: authLoading, login } = useAuthContext();

  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [userFilter, setUserFilter] = useState<"all" | "pending">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FamilyMember | FamilyEvent | null>(null);
  const [formData, setFormData] = useState<FormState>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // ---------- Subscriptions ----------
  useEffect(() => {
    if (!user || !isEditor) return;

    const unsubMembers = onSnapshot(
      query(collection(db, "members"), orderBy("generation", "asc"), orderBy("name", "asc")),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyMember)),
      (err) => setMessage({ type: "error", text: handleFirestoreError(err, OperationType.LIST, "members") })
    );
    const unsubEvents = onSnapshot(
      query(collection(db, "events"), orderBy("date", "desc")),
      (snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FamilyEvent)),
      (err) => setMessage({ type: "error", text: handleFirestoreError(err, OperationType.LIST, "events") })
    );
    return () => {
      unsubMembers();
      unsubEvents();
    };
  }, [user, isEditor]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const unsubUsers = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "desc")),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserDoc)),
      (err) => setMessage({ type: "error", text: handleFirestoreError(err, OperationType.LIST, "users") })
    );
    return () => unsubUsers();
  }, [user, isAdmin]);

  // Editor không có tab users: nếu đang ở tab đó thì quay về members
  useEffect(() => {
    if (activeTab === "users" && !isAdmin) setActiveTab("members");
  }, [activeTab, isAdmin]);

  const pendingCount = useMemo(() => users.filter((u) => u.role === "user").length, [users]);
  const visibleUsers = useMemo(() => {
    const list = userFilter === "pending" ? users.filter((u) => u.role === "user") : users;
    // Chờ duyệt lên đầu, trong mỗi nhóm giữ thứ tự createdAt desc
    return [...list].sort((a, b) => Number(b.role === "user") - Number(a.role === "user"));
  }, [users, userFilter]);

  // ---------- Guards ----------
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#8B2323]/20 border-t-[#8B2323] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !isEditor) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-600 mb-6">
          {user ? <Clock className="w-10 h-10 text-amber-600" /> : <AlertTriangle className="w-10 h-10" />}
        </div>
        <h2 className="text-3xl font-serif font-bold mb-4">{user ? "Tài khoản đang chờ duyệt" : "Truy cập bị từ chối"}</h2>
        <p className="text-[#6B665F] max-w-md mb-8">
          {user
            ? "Quản trị viên sẽ duyệt quyền chỉnh sửa cho bạn. Trong lúc chờ, bạn vẫn xem được toàn bộ gia phả."
            : "Vui lòng đăng nhập bằng tài khoản Google. Sau khi quản trị viên duyệt, bạn sẽ được quyền chỉnh sửa."}
        </p>
        {!user && (
          <button
            onClick={login}
            className="px-8 py-3 bg-[#8B2323] text-white rounded-xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20"
          >
            Đăng nhập ngay
          </button>
        )}
      </div>
    );
  }

  // ---------- Helpers ----------
  const logActivity = async (action: string) => {
    try {
      await addDoc(collection(db, "activities"), {
        userName: user.displayName || user.email,
        userPhoto: user.photoURL,
        action,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Không ghi được nhật ký:", err);
    }
  };

  /** Firestore không nhận undefined: loại bỏ các key undefined/"" trước khi ghi. */
  const clean = <T extends object>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")) as T;

  const openModal = (item: FamilyMember | FamilyEvent | null = null) => {
    setEditingItem(item);
    setFormData(
      item
        ? { ...item }
        : activeTab === "members"
          ? { gender: "Nam", generation: 1, status: "Alive" }
          : { type: "Kỵ nhật" }
    );
    setImagePreview((item as FamilyMember | null)?.photoUrl || null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({});
    setImagePreview(null);
  };

  // ---------- Actions ----------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setLoading(true);
    setMessage(null);

    const col = activeTab === "members" ? "members" : "events";
    const label = activeTab === "members" ? `thành viên: ${formData.name}` : `sự kiện: ${formData.title}`;
    // Không ghi trường id vào document (id đã là document id); loại bỏ key rỗng/undefined
    const { id: _ignored, ...rest } = formData as FormState & { id?: string };
    const payload = clean(rest);

    try {
      if (editingItem) {
        await updateDoc(doc(db, col, editingItem.id), payload);
        await logActivity(`đã cập nhật ${label}`);
      } else {
        await addDoc(collection(db, col), payload);
        await logActivity(`đã thêm mới ${label}`);
      }
      setMessage({ type: "success", text: "Lưu thành công!" });
      closeModal();
    } catch (err) {
      setMessage({
        type: "error",
        text: handleFirestoreError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, col),
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete || activeTab === "users") return;
    const { id, name } = itemToDelete;
    setLoading(true);
    try {
      await deleteDoc(doc(db, activeTab, id));
      await logActivity(`đã xóa ${activeTab === "members" ? "thành viên" : "sự kiện"}: ${name}`);
      setMessage({ type: "success", text: "Xóa thành công!" });
      setItemToDelete(null);
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, OperationType.DELETE, activeTab) });
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (target: UserDoc, patch: Partial<Pick<UserDoc, "role" | "isLocked">>, action: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", target.id), patch);
      await logActivity(`${action}: ${target.displayName || target.email}`);
      setMessage({ type: "success", text: "Cập nhật thành công!" });
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, OperationType.UPDATE, "users") });
    } finally {
      setLoading(false);
    }
  };

  const setRole = (target: UserDoc, role: UserRole) => {
    const verbs: Record<UserRole, string> = {
      editor: "đã duyệt quyền biên tập cho",
      user: "đã thu hồi quyền biên tập của",
      admin: "đã nâng quyền quản trị cho",
    };
    return updateUser(target, { role }, verbs[role]);
  };

  const toggleLock = (target: UserDoc) =>
    updateUser(target, { isLocked: !target.isLocked }, target.isLocked ? "đã mở khóa" : "đã khóa");

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setMessage(null);
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    try {
      const url = await uploadPhoto(file, user);
      setFormData((prev) => ({ ...prev, photoUrl: url }));
      setImagePreview(url);
    } catch (err) {
      setImagePreview(formData.photoUrl || null);
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Tải ảnh thất bại." });
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
    }
  };

  const importSeedData = async () => {
    setShowSeedConfirm(false);
    setLoading(true);
    setMessage(null);
    try {
      const batch = writeBatch(db);
      for (const { id, ...data } of SEED_MEMBERS) {
        batch.set(doc(db, "members", id), clean(data), { merge: true });
      }
      await batch.commit();
      await logActivity(`đã nạp dữ liệu gốc (${SEED_MEMBERS.length} thành viên, 22 đời)`);
      setMessage({ type: "success", text: `Đã nạp ${SEED_MEMBERS.length} thành viên.` });
    } catch (err) {
      setMessage({ type: "error", text: handleFirestoreError(err, OperationType.WRITE, "members") });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Render ----------
  const tabs: { key: Tab; label: string; icon: React.ElementType; count: number; adminOnly?: boolean }[] = [
    { key: "members", label: "Thành viên", icon: Users, count: members.length },
    { key: "events", label: "Sự kiện", icon: Calendar, count: events.length },
    { key: "users", label: "Người dùng", icon: Shield, count: users.length, adminOnly: true },
  ];

  const roleBadge = (role: UserRole) =>
    role === "admin"
      ? "bg-purple-50 text-purple-600"
      : role === "editor"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-amber-50 text-amber-700";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="font-serif text-4xl font-bold mb-2">Quản trị Hệ thống</h1>
          <p className="text-[#6B665F]">
            {isAdmin ? "Quản lý thành viên, sự kiện và duyệt người dùng." : "Quản lý danh sách thành viên và sự kiện gia đình."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeTab === "members" && isAdmin && (
            <button
              onClick={() => setShowSeedConfirm(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-[#E5E1D8] text-[#6B665F] rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
              title="Nạp 92 thành viên 22 đời từ dữ liệu gốc (ghi đè theo id, không xóa dữ liệu khác)"
            >
              <Download className="w-4 h-4" />
              Nạp dữ liệu gốc
            </button>
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
        {tabs
          .filter((t) => !t.adminOnly || isAdmin)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-6 py-4 font-bold text-sm transition-all relative whitespace-nowrap ${
                activeTab === t.key ? "text-[#8B2323]" : "text-[#A19D96] hover:text-[#2D2A26]"
              }`}
            >
              <div className="flex items-center gap-2">
                <t.icon className="w-4 h-4" />
                {t.label} ({t.count})
                {t.key === "users" && pendingCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                    {pendingCount} chờ duyệt
                  </span>
                )}
              </div>
              {activeTab === t.key && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#8B2323] rounded-t-full" />
              )}
            </button>
          ))}
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-red-50 text-red-700 border border-red-100"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="font-medium">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto" aria-label="Đóng">
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users filter */}
      {activeTab === "users" && (
        <div className="flex gap-2">
          {(["all", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setUserFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                userFilter === f ? "bg-[#8B2323] text-white" : "bg-white border border-[#E5E1D8] text-[#6B665F]"
              }`}
            >
              {f === "all" ? `Tất cả (${users.length})` : `Chờ duyệt (${pendingCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
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
              {activeTab === "members" &&
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={member.photoUrl || avatarUrl(member.name, { gender: member.gender })}
                          alt=""
                          className="w-10 h-10 rounded-full border border-[#E5E1D8] object-cover"
                        />
                        <div className="font-bold text-[#2D2A26]">{member.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6B665F]">Thế hệ {member.generation}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          member.gender === "Nam" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                        }`}
                      >
                        {member.gender}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          member.status === "Alive" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABEL[member.status || "Deceased"]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(member)}
                          className="p-2 text-[#6B665F] hover:text-[#8B2323] hover:bg-[#8B2323]/5 rounded-lg transition-all"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setItemToDelete({ id: member.id, name: member.name })}
                            className="p-2 text-[#6B665F] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {activeTab === "events" &&
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#2D2A26]">{event.title}</td>
                    <td className="px-6 py-4 text-sm text-[#6B665F]">{format(new Date(event.date), "HH:mm, d/M/yyyy")}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-[#FDFCF9] border border-[#E5E1D8] rounded text-[10px] font-bold uppercase text-[#8B2323]">
                        {event.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(event)}
                          className="p-2 text-[#6B665F] hover:text-[#8B2323] hover:bg-[#8B2323]/5 rounded-lg transition-all"
                          title="Sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setItemToDelete({ id: event.id, name: event.title })}
                            className="p-2 text-[#6B665F] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {activeTab === "users" &&
                visibleUsers.map((u) => {
                  const isSelf = u.id === user.uid;
                  const canTouch = !isSelf && (isSuperAdmin || u.role !== "admin");
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${u.role === "user" ? "bg-amber-50/40" : ""}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.photoURL || avatarUrl(u.displayName || u.email)}
                            alt=""
                            className="w-10 h-10 rounded-full border border-[#E5E1D8]"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex flex-col">
                            <div className="font-bold text-[#2D2A26]">
                              {u.displayName}
                              {isSelf && <span className="ml-2 text-[10px] text-[#A19D96]">(bạn)</span>}
                            </div>
                            <div className="text-xs text-[#6B665F]">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${roleBadge(u.role)}`}>
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            !u.isLocked ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          }`}
                        >
                          {!u.isLocked ? "Hoạt động" : "Bị khóa"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6B665F]">
                        {u.lastLogin?.toDate ? format(u.lastLogin.toDate(), "d/M/yyyy") : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canTouch && (
                          <div className="flex items-center justify-end gap-1">
                            {u.role === "user" && (
                              <button
                                onClick={() => setRole(u, "editor")}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                                title="Duyệt quyền biên tập"
                              >
                                <UserCheck className="w-3.5 h-3.5" /> Duyệt
                              </button>
                            )}
                            {u.role === "editor" && (
                              <button
                                onClick={() => setRole(u, "user")}
                                disabled={loading}
                                className="p-2 text-[#6B665F] hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                title="Thu hồi quyền biên tập"
                              >
                                <ShieldOff className="w-4 h-4" />
                              </button>
                            )}
                            {isSuperAdmin && u.role === "editor" && (
                              <button
                                onClick={() => setRole(u, "admin")}
                                disabled={loading}
                                className="p-2 text-[#6B665F] hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                                title="Nâng lên quản trị"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            )}
                            {isSuperAdmin && u.role === "admin" && (
                              <button
                                onClick={() => setRole(u, "editor")}
                                disabled={loading}
                                className="p-2 text-[#6B665F] hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                                title="Hạ xuống biên tập"
                              >
                                <ShieldOff className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => toggleLock(u)}
                              disabled={loading}
                              className={`p-2 rounded-lg transition-all ${
                                u.isLocked ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"
                              }`}
                              title={u.isLocked ? "Mở khóa" : "Khóa tài khoản"}
                            >
                              {u.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {((activeTab === "members" && members.length === 0) ||
                (activeTab === "events" && events.length === 0) ||
                (activeTab === "users" && visibleUsers.length === 0)) && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#A19D96]">
                    Chưa có dữ liệu.
                  </td>
                </tr>
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
              onClick={closeModal}
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
                  <button type="button" onClick={closeModal} className="text-[#A19D96] hover:text-[#2D2A26]" aria-label="Đóng">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-8 overflow-y-auto flex-grow">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeTab === "members" ? (
                      <>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Hình ảnh đại diện</label>
                          <div className="flex items-center gap-4">
                            <div className="relative w-20 h-20 rounded-full border-2 border-dashed border-[#E5E1D8] flex items-center justify-center overflow-hidden bg-[#FDFCF9]">
                              {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover" alt="Xem trước" />
                              ) : (
                                <Users className="w-8 h-8 text-[#A19D96] opacity-20" />
                              )}
                              {uploading && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                                  <div className="w-6 h-6 border-2 border-[#8B2323]/20 border-t-[#8B2323] rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                            <div className="flex-grow">
                              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="avatar-upload" disabled={uploading} />
                              <label
                                htmlFor="avatar-upload"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E1D8] rounded-xl text-sm font-bold text-[#6B665F] cursor-pointer hover:bg-gray-50 transition-all"
                              >
                                <Plus className="w-4 h-4" />
                                {uploading ? "Đang tải lên..." : "Chọn ảnh"}
                              </label>
                              <p className="text-[10px] text-[#A19D96] mt-2">JPG, PNG, WebP. Ảnh sẽ được thu nhỏ về 800px và lưu trên máy chủ.</p>
                            </div>
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Họ và tên</label>
                          <input
                            required
                            type="text"
                            value={formData.name || ""}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Thế hệ</label>
                          <select
                            required
                            value={formData.generation || 1}
                            onChange={(e) => setFormData({ ...formData, generation: Number(e.target.value) })}
                            className={inputCls}
                          >
                            {[...Array(30)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Giới tính</label>
                          <select
                            value={formData.gender || "Nam"}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value as FamilyMember["gender"] })}
                            className={inputCls}
                          >
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Ngày sinh</label>
                          <input
                            type="text"
                            placeholder="VD: 12/05/1980"
                            value={formData.birthDate || ""}
                            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Trạng thái</label>
                          <select
                            value={formData.status || "Alive"}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as FamilyMember["status"] })}
                            className={inputCls}
                          >
                            <option value="Alive">Còn sống</option>
                            <option value="Deceased">Đã mất</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Ngày mất</label>
                          <input
                            type="text"
                            placeholder="VD: 20/03/2010 hoặc Kỵ 16-9 ÂL"
                            value={formData.deathDate || ""}
                            onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Chi tộc</label>
                          <input
                            type="text"
                            placeholder="VD: Chi ông Niệm"
                            value={formData.branch || ""}
                            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Nơi sống</label>
                          <input
                            type="text"
                            placeholder="VD: Hà Nội, Việt Nam"
                            value={formData.address || ""}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Người phối ngẫu (cách nhau bởi dấu phẩy)</label>
                          <input
                            type="text"
                            placeholder="VD: Nguyễn Thị A, Trần Thị B"
                            value={formData.spouse || ""}
                            onChange={(e) => setFormData({ ...formData, spouse: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Tiểu sử</label>
                          <textarea
                            rows={3}
                            value={formData.biography || ""}
                            onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                            className={inputCls}
                          />
                        </div>

                        <div className="md:col-span-2 border-t border-[#E5E1D8] pt-6 mt-2">
                          <h3 className="text-sm font-bold text-[#8B2323] mb-4">Mối quan hệ gia đình</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className={labelCls}>Cha</label>
                              <select
                                value={formData.fatherId || ""}
                                onChange={(e) => setFormData({ ...formData, fatherId: e.target.value })}
                                className={inputCls}
                              >
                                <option value="">Không có / Chưa rõ</option>
                                {members
                                  .filter((m) => m.id !== editingItem?.id && m.gender === "Nam")
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} (Thế hệ {m.generation})
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Mẹ</label>
                              <select
                                value={formData.motherId || ""}
                                onChange={(e) => setFormData({ ...formData, motherId: e.target.value })}
                                className={inputCls}
                              >
                                <option value="">Không có / Chưa rõ</option>
                                {members
                                  .filter((m) => m.id !== editingItem?.id && m.gender === "Nữ")
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} (Thế hệ {m.generation})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Tiêu đề sự kiện</label>
                          <input
                            required
                            type="text"
                            value={formData.title || ""}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Thời gian</label>
                          <input
                            required
                            type="datetime-local"
                            value={formData.date ? format(new Date(formData.date), "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) =>
                              setFormData({ ...formData, date: e.target.value ? new Date(e.target.value).toISOString() : "" })
                            }
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Loại sự kiện</label>
                          <select
                            value={formData.type || "Kỵ nhật"}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value as FamilyEvent["type"] })}
                            className={inputCls}
                          >
                            <option value="Kỵ nhật">Kỵ nhật</option>
                            <option value="Hội họp">Hội họp</option>
                            <option value="Khác">Khác</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Địa điểm</label>
                          <input
                            type="text"
                            value={formData.location || ""}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelCls}>Mô tả</label>
                          <textarea
                            rows={3}
                            value={formData.description || ""}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-6 pt-4 border-t border-[#E5E1D8] flex gap-4 bg-[#FDFCF9] sticky bottom-0 z-20">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-grow py-3 px-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploading}
                    className="flex-grow py-3 px-4 bg-[#8B2323] text-white rounded-2xl font-bold hover:bg-[#6B1B1B] transition-colors shadow-lg shadow-[#8B2323]/20 flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Delete confirm */}
      {itemToDelete && (
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
              Bạn có chắc chắn muốn xóa <span className="font-bold text-[#2D2A26]">"{itemToDelete.name}"</span>? Hành động này không thể hoàn tác.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setItemToDelete(null)}
                className="py-3 px-6 bg-[#FDFCF9] border border-[#E5E1D8] text-[#6B665F] font-bold rounded-2xl hover:bg-white transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="py-3 px-6 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {loading ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Seed confirm */}
      {showSeedConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-[#E5E1D8]"
          >
            <div className="w-16 h-16 bg-[#FDFCF9] rounded-2xl flex items-center justify-center text-[#8B2323] mb-6 mx-auto">
              <Download className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-serif font-bold text-[#2D2A26] text-center mb-2">Nạp dữ liệu gốc</h3>
            <p className="text-[#6B665F] text-center mb-8 text-sm">
              Sẽ ghi {SEED_MEMBERS.length} thành viên (22 đời) vào hệ thống theo id cố định. Thành viên trùng id sẽ được
              cập nhật các trường có trong dữ liệu gốc, các trường khác (ảnh, địa chỉ bạn đã nhập) được giữ nguyên.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowSeedConfirm(false)}
                className="py-3 px-6 bg-[#FDFCF9] border border-[#E5E1D8] text-[#6B665F] font-bold rounded-2xl hover:bg-white transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={importSeedData}
                disabled={loading}
                className="py-3 px-6 bg-[#8B2323] text-white font-bold rounded-2xl hover:bg-[#6B1B1B] transition-all disabled:opacity-50"
              >
                {loading ? "Đang nạp..." : "Nạp dữ liệu"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Admin;
