"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  FileSearch, 
  Briefcase, 
  KanbanSquare, 
  Menu, 
  X,
  Cpu,
  User,
  Zap,
  Activity,
  Sun,
  Moon
} from "lucide-react";

const links = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/analyze", label: "AI Analysis", icon: FileSearch },
  { href: "/jobs", label: "Job Matches", icon: Briefcase },
  { href: "/tracker", label: "Task Tracker", icon: KanbanSquare },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setIsClient(true);
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  if (!isClient) return null;

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="mobile-header">
        <Link href="/" className="logo-wrapper">
          <span className="logo-mark">
            <Zap size={16} fill="var(--accent-primary-light)" color="var(--accent-primary-light)" />
          </span>
          <span className="logo-text">JobFlow AI</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button 
            onClick={toggleTheme} 
            className="mobile-theme-btn" 
            aria-label="Toggle Theme"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 8,
              display: "flex",
              alignItems: "center"
            }}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`sidebar-nav ${mobileOpen ? "mobile-visible" : ""}`}>
        {/* Brand/Logo Area */}
        <div className="brand-area">
          <Link href="/" className="logo-wrapper" onClick={() => setMobileOpen(false)}>
            <div className="logo-mark-lg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="url(#sidebar-bolt-grad)" />
                <defs>
                  <linearGradient id="sidebar-bolt-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818cf8" />
                    <stop offset="1" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="logo-meta">
              <span className="logo-text-lg">JobFlow AI</span>
              <span className="logo-tag">AGENT ENGINE</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="nav-menu">
          <ul>
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`nav-item ${isActive ? "active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="nav-icon-wrapper">
                      <Icon size={18} />
                    </span>
                    <span className="nav-label">{link.label}</span>
                    {isActive && <span className="active-indicator" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Theme Toggle Button */}
        <div className="sidebar-theme-toggle">
          <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle Theme">
            {theme === "dark" ? (
              <>
                <Sun size={14} />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon size={14} />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>

        {/* AI System Telemetry Tag */}
        <div className="sidebar-telemetry">
          <div className="telemetry-badge">
            <span className="telemetry-ping" />
            <Cpu size={12} style={{ color: "var(--accent-primary-light)" }} />
            <span>AI Node: online</span>
          </div>
        </div>

        {/* User Profile Card */}
        <div className="sidebar-profile">
          <div className="profile-inner">
            <div className="profile-avatar">
              <span>AN</span>
            </div>
            <div className="profile-info">
              <h5>Aryan Nishen</h5>
              <p>Software Engineer</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
