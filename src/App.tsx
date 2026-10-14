import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./hooks/AuthContext";
import Dashboard from "./pages/Dashboard";
import MemberList from "./pages/MemberList";
import FamilyTree from "./pages/FamilyTree";
import Events from "./pages/Events";
import Admin from "./pages/Admin";
import Biography from "./pages/Biography";

// Trang 3D tải riêng: three.js không làm nặng các trang khác
const Intro = lazy(() => import("./pages/Intro"));

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<MemberList />} />
              <Route path="/tree" element={<FamilyTree />} />
              <Route path="/events" element={<Events />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/biography" element={<Biography />} />
              <Route
                path="/gioi-thieu"
                element={
                  <Suspense fallback={<div className="fixed inset-0 bg-[#0b0a12]" />}>
                    <Intro />
                  </Suspense>
                }
              />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
