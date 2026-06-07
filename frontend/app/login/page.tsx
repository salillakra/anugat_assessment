"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, ShieldAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || "Invalid credentials");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("demo123");
    setError(null);
    setSubmitting(true);

    try {
      const res = await login(demoEmail, "demo123");
      if (!res.success) {
        setError(res.error || "Demo login failed");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred during demo login");
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts = [
    {
      role: "Admin",
      email: "admin@samayak.demo",
      color: "bg-[#0B0B0D] hover:bg-black text-white",
    },
    {
      role: "Dean",
      email: "dean@samayak.demo",
      color: "bg-[#2E7CC1] hover:bg-[#256199] text-white",
    },
    {
      role: "HOD (CS)",
      email: "hod.cs@samayak.demo",
      color:
        "bg-white text-[#256199] border border-slate-200 hover:bg-[#E6F0FA]",
    },
  ];

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#CFE1F5] dark:bg-[#0b0b0d] px-4 font-sans">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-4 grid place-items-center">
          <div className="p-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 text-slate-900 dark:text-white"
            >
              <Image
                src="/anugat_logo.png"
                className="rounded-lg h-10 w-10"
                height={100}
                width={100}
                alt="Anugat Logo"
              />
              <span className="text-3xl font-extrabold">Anugat AI</span>
            </Link>
          </div>
        </div>

        {/* Card */}
        <div className="card-samayak p-8">
          <h2 className="text-2xl font-extrabold mb-6 text-[#256199] dark:text-white tracking-tight">
            Sign In
          </h2>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-[14px] bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800 text-[#EF4655] dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="text-sm font-semibold">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7C8294] dark:text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                  <Mail className="h-5 w-5 mr-5" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@university.edu"
                  className="form-input with-icon"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#7C8294] dark:text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="form-input with-icon"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3.5 text-sm cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Demo Login Assist */}
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h3 className="text-xs font-bold text-[#7C8294] dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#3DA1FF]" />
              Demo Login Accounts
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  onClick={() => handleDemoLogin(account.email)}
                  disabled={submitting}
                  className={`py-2 px-1 text-center rounded-[10px] text-xs font-extrabold transition-all shadow-sm ${account.color}`}
                >
                  {account.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
