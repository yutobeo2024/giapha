import React from "react";
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
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
