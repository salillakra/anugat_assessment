"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout";
import { api } from "@/lib/api";
import {
  Building2,
  DoorOpen,
  BookOpen,
  Users,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [utilisation, setUtilisation] = useState<any>(null);
  const [emptyProb, setEmptyProb] = useState<any>(null);
  const [underRunning, setUnderRunning] = useState<any>([]);
  const [emptyHours, setEmptyHours] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    const [sumRes, utilRes, probRes, underRes, hoursRes] = await Promise.all([
      api.get<any>("/analytics/summary"),
      api.get<any>("/analytics/room-utilisation"),
      api.get<any>("/analytics/empty-room-probability"),
      api.get<any>("/analytics/under-running-courses"),
      api.get<any>("/analytics/avg-empty-hours"),
    ]);

    if (sumRes.success) setSummary(sumRes.data);
    if (utilRes.success) setUtilisation(utilRes.data);
    if (probRes.success) setEmptyProb(probRes.data);
    if (underRes.success) setUnderRunning(underRes.data);
    if (hoursRes.success) setEmptyHours(hoursRes.data);

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  // Prep charts data
  const deptUtilData =
    utilisation?.byDepartment?.map((d: any) => ({
      name: d.departmentName,
      Utilisation: d.utilisationPct,
    })) || [];

  const emptyProbData =
    emptyProb?.byPeriod?.map((p: any) => ({
      name: `${p.dayOfWeek.substring(0, 3)} P${p.period}`,
      Probability: p.emptyProbability,
    })) || [];

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 lg:space-y-8 mobile:p-4">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Academic Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time university space utilization & scheduling analytics
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="btn-secondary py-2 px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Departments
                </p>
                <h3 className="text-2xl sm:text-2xl md:text-3xl font-bold mt-1 text-slate-900 dark:text-white">
                  {summary?.counts?.departments || 0}
                </h3>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <Building2 className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Total Rooms
                </p>
                <h3 className="text-3xl font-bold mt-1 text-slate-900 dark:text-white">
                  {summary?.counts?.rooms || 0}
                </h3>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <DoorOpen className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Courses
                </p>
                <h3 className="text-3xl font-bold mt-1 text-slate-900 dark:text-white">
                  {summary?.counts?.courses || 0}
                </h3>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Total Faculty
                </p>
                <h3 className="text-3xl font-bold mt-1 text-slate-900 dark:text-white">
                  {summary?.counts?.faculty || 0}
                </h3>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Highlight Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="premium-card p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 opacity-80" />
              <h4 className="text-sm font-semibold uppercase tracking-wider opacity-80">
                Room Utilisation Rate
              </h4>
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl font-black">
                {utilisation?.overall || 0}%
              </span>
              <span className="text-xs opacity-75">
                overall system occupancy
              </span>
            </div>
            <p className="mt-4 text-xs opacity-80 leading-relaxed">
              Calculated based on currently occupied rooms versus total rooms
              across all active day and period slots.
            </p>
          </div>

          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-indigo-500" />
              <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Average Empty Hours
              </h4>
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-5xl font-black text-slate-900 dark:text-white">
                {emptyHours?.averageEmptyHoursPerDay || 0} hrs
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                per room / day
              </span>
            </div>
            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              Average daily non-scheduled hours for rooms in active departments.
              Lower is better.
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Department Utilisation */}
          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Utilisation by Department
            </h3>
            <div className="h-80 w-full">
              {deptUtilData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptUtilData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip cursor={{ fill: "rgba(148, 163, 184, 0.05)" }} />
                    <Bar
                      dataKey="Utilisation"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Empty Room Probability */}
          <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Empty Room Probability
            </h3>
            <div className="h-80 w-full">
              {emptyProbData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={emptyProbData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis
                      dataKey="name"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="Probability"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Under-running Courses */}
        <div className="premium-card p-6 bg-white dark:bg-[#1e293b]">
          <div className="flex items-center gap-2 mb-4 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Under-running Courses
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--line-2)] text-[var(--ink-soft)] font-bold bg-[var(--canvas-2)]">
                  <th className="py-3 px-4 whitespace-nowrap">Code</th>
                  <th className="py-3 px-4">Course Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Department</th>
                  <th className="py-3 px-4 whitespace-nowrap">Credits</th>
                  <th className="py-3 px-4 whitespace-nowrap">
                    Scheduled Hours
                  </th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">
                    Gap (Hours)
                  </th>
                </tr>
              </thead>
              <tbody>
                {underRunning.length > 0 ? (
                  underRunning.map((course: any) => (
                    <tr
                      key={course.courseId}
                      className="border-b border-[var(--line)] hover:bg-[var(--canvas-2)]/20 text-[var(--ink)]"
                    >
                      <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                        {course.courseCode}
                      </td>
                      <td className="py-3.5 px-4">{course.courseName}</td>
                      <td className="py-3.5 px-4">{course.departmentName}</td>
                      <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        {course.credits}
                      </td>
                      <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                        {course.scheduledHours} hrs
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-600 font-semibold whitespace-nowrap">
                        -{course.gap} hrs
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-slate-400 italic"
                    >
                      No under-running courses flagged! All scheduled hours
                      match credits.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
