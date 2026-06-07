"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  UploadCloud,
  Building2,
  DoorOpen,
  BookOpen,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Image from "next/image";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f8fafc] dark:bg-[#0f172a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const role = user.role;
  const isAdmin = role === "ADMIN";
  const isCoordinator = role === "COORDINATOR" || isAdmin;
  const isHodOrDean = role === "HOD" || role === "DEAN" || isAdmin;

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, show: isHodOrDean },
    { name: "Timetables", href: "/timetables", icon: Calendar, show: true },
    { name: "Imports", href: "/imports", icon: UploadCloud, show: isCoordinator },
    { name: "Departments", href: "/departments", icon: Building2, show: isAdmin },
    { name: "Rooms", href: "/rooms", icon: DoorOpen, show: isAdmin || role === "COORDINATOR" },
    { name: "Courses", href: "/courses", icon: BookOpen, show: isAdmin || role === "HOD" },
    { name: "Faculty", href: "/faculty", icon: Users, show: isAdmin || role === "HOD" },
  ];

  return (
    <div className="flex h-screen bg-[#CFE1F5] dark:bg-[#0b0b0d] p-4 gap-4 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 bg-white dark:bg-[#1a1a1c] rounded-3xl shadow-sm border border-slate-100 dark:border-[#2a2a2c] flex-col md:flex">
        {/* Logo */}
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-slate-900 dark:text-white">
            <Image src="/anugat_logo.png" className="rounded-lg h-8 w-8" height={100} width={100} alt="Anugat Logo" />
            <span className="text-2xl font-extrabold">
              Anugat AI
            </span>
          </Link>
        </div>

        {/* Navign */}
        <nav className="flex-1 space-y-1.5 px-4 py-2 overflow-y-auto">
          {navigation.map((item, idx) => {
            if (!item.show) return null;
            const active = pathname === item.href;

            // Header/HOD/Admin partition line
            const isElevatedStart = item.name === "Departments" || (item.name === "Rooms" && !navigation[idx - 1]?.show);

            return (
              <React.Fragment key={item.name}>
                {isElevatedStart && <hr className="border-slate-100 dark:border-[#2a2a2c] my-3 mx-2" />}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold transition-all ${
                    active
                      ? "bg-brand-gradient text-white shadow-sm"
                      : "text-[#7C8294] dark:text-[#94a3b8] hover:bg-[#E6F0FA] dark:hover:bg-slate-800 hover:text-[#232635] dark:hover:text-white"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </React.Fragment>
            );
          })}
        </nav>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-slate-100 dark:border-[#2a2a2c]">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E6F0FA] text-[#256199] font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-bold text-[#232635] dark:text-white">{user.name}</p>
              <p className="truncate text-xs text-[#7C8294] font-medium">{role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#0B0B0D] hover:bg-black text-white rounded-full font-bold text-sm transition-all"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="relative z-50 md:hidden">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-[#1a1a1c] p-6 shadow-md rounded-r-3xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2.5">
                <Image src="/anugat_logo.png" className="rounded-lg h-8 w-8" height={100} width={100} alt="Anugat Logo" />
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-wider">ANUGAT AI</span>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {navigation.map((item, idx) => {
                if (!item.show) return null;
                const active = pathname === item.href;
                const isElevatedStart = item.name === "Departments" || (item.name === "Rooms" && !navigation[idx - 1]?.show);

                return (
                  <React.Fragment key={item.name}>
                    {isElevatedStart && <hr className="border-slate-100 dark:border-[#2a2a2c] my-3" />}
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold transition-all ${
                        active
                          ? "bg-brand-gradient text-white"
                          : "text-[#7C8294] dark:text-[#94a3b8] hover:bg-[#E6F0FA] dark:hover:bg-slate-800 hover:text-[#232635] dark:hover:text-white"
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="border-t border-slate-200 dark:border-[#2a2a2c] pt-4">
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E6F0FA] text-[#256199] font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#0B0B0D] hover:bg-black text-white rounded-full font-bold text-sm transition-all"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-[#1a1a1c] rounded-3xl shadow-sm border border-slate-100 dark:border-[#2a2a2c]">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-100 dark:border-[#2a2a2c] px-6 md:px-8 bg-white dark:bg-[#1a1a1c] rounded-t-3xl shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => setMobileOpen(true)}>
              <Menu className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </button>
            <div className="text-sm font-bold text-[#256199] bg-[#E6F0FA] px-4 py-1.5 rounded-full">
              Spring 2026 Session
            </div>
          </div>
          <div className="text-xs font-bold bg-[#0B0B0D] text-white px-4 py-2 rounded-full tracking-wider uppercase">
            {role} Portal
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 dark:bg-[#121214]">
          {children}
        </main>
      </div>
    </div>
  );
}
