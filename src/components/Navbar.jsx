// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { healthCheck } from "../services/api";

export default function Navbar() {
  const location = useLocation();
  const [systemOnline, setSystemOnline] = useState(null);

  useEffect(() => {
    healthCheck()
      .then(() => setSystemOnline(true))
      .catch(() => setSystemOnline(false));
  }, []);

  return (
    <header className="border-b border-brand-midgray bg-brand-darkgray sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red flex items-center justify-center rounded-[25%]">
            <span className="font-display text-xs font-medium text-white">
              1/1
            </span>
          </div>
          <div>
            <span className="font-display text-sm text-white tracking-wider">
              ONEOFONE
            </span>
            <span className="font-body text-xs text-gray-500 ml-2">
              SPORTS PREDICTION
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { path: "/", label: "DASHBOARD" },
            { path: "/predict", label: "PREDICT" },
            { path: "/history", label: "HISTORY" },
            { path: "/metrics", label: "METRICS" },
            { path: "/chat", label: "AI CHAT" },
          ].map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`font-display text-xs tracking-widest px-4 py-2 transition-colors duration-200 ${
                location.pathname === path
                  ? "text-brand-red border-b border-brand-red"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              systemOnline === null
                ? "bg-gray-500 animate-pulse"
                : systemOnline
                  ? "bg-brand-green animate-pulse-slow"
                  : "bg-brand-red"
            }`}
          />
          <span className="font-display text-xs text-gray-500">
            {systemOnline === null
              ? "CONNECTING"
              : systemOnline
                ? "SYSTEM ONLINE"
                : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
