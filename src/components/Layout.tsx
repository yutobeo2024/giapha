import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Network, 
  Users, 
  Calendar, 
  Settings, 
  LogIn, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight 
} from "lucide-react";
import { auth } from "../firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { name: "Tổng quan", path: "/", icon: LayoutDashboard },
    { name: "Danh sách", path: "/members", icon: Users },
    { name: "Cây gia phả", path: "/tree", icon: Network },
    { name: "Sự kiện", path: "/events", icon: Calendar },
    { name: "Quản trị", path: "/admin", icon: Settings, adminOnly: true },
  ];

  const isAdminEmail = (email: string | null | undefined) => {
    return email?.toLowerCase().trim() === "hanhtoami@gmail.com";
  };

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdminEmail(user?.email));

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-[#2D2A26] font-sans">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#E5E1D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-[#8B2323] rounded-full flex items-center justify-center text-white font-serif text-xl">
                  N
                </div>
                <span className="font-serif text-xl font-bold tracking-tight hidden sm:block">
                  Nguyễn Nhuận
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                    location.pathname === item.path ? "text-[#8B2323]" : "text-[#6B665F] hover:text-[#2D2A26]"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
              {user ? (
                <div className="flex items-center gap-4 pl-4 border-l border-[#E5E1D8]">
                  <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-8 h-8 rounded-full border border-[#E5E1D8]" />
                  <button onClick={handleLogout} className="text-[#6B665F] hover:text-[#8B2323] transition-colors">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-[#8B2323] text-white rounded-full text-sm font-medium hover:bg-[#6B1B1B] transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-[#2D2A26]">
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-white z-50 shadow-2xl p-6 flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <span className="font-serif text-lg font-bold">Menu</span>
                <button onClick={() => setIsMenuOpen(false)}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex flex-col gap-4 flex-grow">
                {filteredNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                      location.pathname === item.path ? "bg-[#FDFCF9] text-[#8B2323]" : "text-[#6B665F] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </Link>
                ))}
              </div>
              <div className="pt-6 border-t border-[#E5E1D8]">
                {user ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-10 h-10 rounded-full" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate max-w-[120px]">{user.displayName}</span>
                        <span className="text-xs text-[#6B665F] truncate max-w-[120px]">{user.email}</span>
                      </div>
                    </div>
                    <button onClick={handleLogout} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#8B2323] text-white rounded-xl font-medium"
                  >
                    <LogIn className="w-5 h-5" />
                    Đăng nhập
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E1D8] py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-12 h-12 bg-[#8B2323] rounded-full flex items-center justify-center text-white font-serif text-2xl mx-auto mb-4">
            N
          </div>
          <h3 className="font-serif text-xl font-bold mb-2">Gia Phả Họ Nguyễn Nhuận</h3>
          <p className="text-[#6B665F] text-sm max-w-md mx-auto mb-8">
            Lưu giữ và phát huy truyền thống dòng họ Nguyễn Nhuận qua các thế hệ.
          </p>
          <div className="text-xs text-[#A19D96] uppercase tracking-widest">
            © {new Date().getFullYear()} Nguyễn Nhuận Family Tree
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
