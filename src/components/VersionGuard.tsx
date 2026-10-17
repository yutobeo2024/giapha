import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { BUILD_ID, canReloadNow, isNewBuild } from "../lib/buildVersion";

/** Không hỏi server dày hơn mức này khi chuyển mục liên tục */
const MIN_GAP_MS = 15_000;
/** Nhớ bản đã tải lại vì nó, để không tải lại vòng vô tận nếu CDN còn trả bản cũ */
const RELOADED_KEY = "giapha:reloadedFor";

type Reason = "route" | "visible";

/**
 * Canh bản mới: mỗi lần chuyển mục hoặc tab hiện lại thì hỏi /version.json; khác bản đang chạy thì tải lại trang.
 * Trang quản trị có thể đang nhập dở nên chỉ đánh dấu, tải lại ở lần chuyển mục kế tiếp.
 * Không render gì. Bỏ qua ở bản dev (không có version.json).
 */
export default function VersionGuard() {
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  const lastCheck = useRef(0);
  const pendingBuild = useRef<string | null>(null);
  const firstRoute = useRef(true);
  pathRef.current = pathname;

  const check = async (reason: Reason) => {
    if (import.meta.env.DEV) return;
    // Chuyển mục mà đã biết có bản mới: tải lại ngay, không cần hỏi lại
    if (reason === "route" && pendingBuild.current) {
      reloadFor(pendingBuild.current);
      return;
    }
    const now = Date.now();
    if (now - lastCheck.current < MIN_GAP_MS) return;
    lastCheck.current = now;
    try {
      const res = await fetch(`/version.json?t=${now}`, { cache: "no-store" });
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (!isNewBuild(BUILD_ID, data)) return;
      const build = (data as { build: string }).build;
      if (reason === "route" || canReloadNow(pathRef.current)) reloadFor(build);
      else pendingBuild.current = build;
    } catch {
      /* mất mạng hoặc server lỗi: lần sau thử lại */
    }
  };

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void check("visible");
    };
    // pageshow persisted: Safari lấy trang từ bộ nhớ "lùi/tiến"
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void check("visible");
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Lần đầu tải trang thì đang là bản mới nhất, không cần hỏi
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    void check("route");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

function reloadFor(build: string) {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === build) return; // đã tải lại vì bản này mà vẫn cũ: thôi, tránh lặp
    sessionStorage.setItem(RELOADED_KEY, build);
  } catch {
    /* chế độ riêng tư chặn storage: vẫn tải lại một lần */
  }
  window.location.reload();
}
