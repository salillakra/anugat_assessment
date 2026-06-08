"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout";
import { api } from "@/lib/api";
import { Calendar, MapPin, User } from "lucide-react";

export default function TimetablesPage() {
  const [loadingList, setLoadingList] = useState(true);
  const [timetables, setTimetables] = useState<any[]>([]);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>("");
  const [timetableData, setTimetableData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  const fetchList = async () => {
    setLoadingList(true);
    // paginatedOk returns { success, data: Timetable[], pagination }
    const res = await api.get<any[]>("/timetables?limit=100");
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      setTimetables(res.data);
      setSelectedTimetableId(res.data[0].id);
    } else {
      setTimetables([]);
    }
    setLoadingList(false);
  };

  const fetchTimetable = async (id: string) => {
    setLoadingData(true);
    setTimetableData(null);
    const res = await api.get<any>(`/timetables/${id}`);
    if (res.success && res.data) {
      setTimetableData(res.data);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (selectedTimetableId) {
      fetchTimetable(selectedTimetableId);
    }
  }, [selectedTimetableId]);

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const PERIOD_HEADERS = [
    { id: 1, name: "I", time: "08:00–08:50" },
    { id: 2, name: "II", time: "09:00–09:50" },
    { id: 3, name: "III", time: "10:00–10:50" },
    { id: 4, name: "IV", time: "11:00–11:50" },
    { id: 5, name: "V", time: "12:00–12:50" },
    { id: 6, name: "VI", time: "13:30–14:20" },
    { id: 7, name: "VII", time: "14:30–15:20" },
    { id: 8, name: "VIII", time: "15:30–16:20" },
    { id: 9, name: "IX", time: "16:30–17:20" },
  ];

  // Build grid: { [DAY]: { [period]: slot[] } }
  const grid: Record<string, Record<number, any[]>> = {};
  for (const d of days) {
    grid[d] = {};
    for (const p of periods) grid[d][p] = [];
  }

  if (Array.isArray(timetableData?.slots)) {
    for (const slot of timetableData.slots) {
      // Normalise day to uppercase in case the DB returns lowercase
      const day: string = (slot.dayOfWeek as string)?.toUpperCase();
      // Period can come back as string from JSON
      const period: number = Number(slot.period);
      if (grid[day] && grid[day][period] !== undefined) {
        grid[day][period].push(slot);
      }
    }
  }

  // Deterministic colour palette keyed on course code
  const getCourseBg = (code: string) => {
    if (!code)
      return "bg-slate-50 border-slate-200 dark:bg-slate-800/20 dark:border-slate-800";
    const h = [...code].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const colors = [
      "bg-blue-50    border-blue-200    text-blue-800    dark:bg-blue-950/20    dark:border-blue-900    dark:text-blue-300",
      "bg-indigo-50  border-indigo-200  text-indigo-800  dark:bg-indigo-950/20  dark:border-indigo-900  dark:text-indigo-300",
      "bg-violet-50  border-violet-200  text-violet-800  dark:bg-violet-950/20  dark:border-violet-900  dark:text-violet-300",
      "bg-amber-50   border-amber-200   text-amber-800   dark:bg-amber-950/20   dark:border-amber-900   dark:text-amber-300",
      "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300",
      "bg-teal-50    border-teal-200    text-teal-800    dark:bg-teal-950/20    dark:border-teal-900    dark:text-teal-300",
      "bg-rose-50    border-rose-200    text-rose-800    dark:bg-rose-950/20    dark:border-rose-900    dark:text-rose-300",
    ];
    return colors[h % colors.length];
  };

  // Label shown in the selector dropdown
  const timetableLabel = (tt: any) =>
    tt.name ||
    [
      tt.branch?.name ?? tt.branch?.code ?? "—",
      `Sem ${tt.semester}`,
      `Sec ${tt.section}`,
    ].join(" · ");

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-8 w-8 text-blue-600" />
              Timetable Schedule Viewer
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Select a department branch and section to view its weekly schedule
              grid.
            </p>
          </div>

          {/* Timetable selector */}
          {!loadingList && timetables.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-500 shrink-0">
                Timetable:
              </label>
              <select
                value={selectedTimetableId}
                onChange={(e) => setSelectedTimetableId(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timetables.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {timetableLabel(tt)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Timetable Grid Card ── */}
        <div className="premium-card p-6 bg-white dark:bg-[#1e293b] overflow-x-auto">
          {loadingList ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : timetables.length === 0 ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              No timetables available. Upload a PDF timetable first!
            </div>
          ) : loadingData ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : timetableData ? (
            <div className="min-w-[900px] space-y-4">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Branch
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    {timetableData.branch?.name}
                    {timetableData.branch?.code
                      ? ` (${timetableData.branch.code})`
                      : ""}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Department
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    {timetableData.branch?.department?.name ?? "—"}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Semester
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    Semester {timetableData.semester}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Section
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    Section {timetableData.section}
                  </p>
                </div>
                {Array.isArray(timetableData.slots) && (
                  <>
                    <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                    <div>
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        Slots
                      </p>
                      <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                        {timetableData.slots.length}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Weekly Grid — 10 columns: 1 day label + 9 periods */}
              <div className="grid grid-cols-10 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden text-[11px]">
                {/* Header row */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 text-center font-bold text-slate-500 border-r border-b border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  Day
                </div>
                {PERIOD_HEADERS.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-50 dark:bg-slate-800/40 p-2 text-center border-b border-r border-slate-200 dark:border-slate-800 last:border-r-0"
                  >
                    <p className="font-bold text-slate-900 dark:text-white">
                      P{p.name}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5 whitespace-nowrap">
                      {p.time}
                    </p>
                  </div>
                ))}

                {/* Data rows */}
                {days.map((day, dayIdx) => (
                  <React.Fragment key={day}>
                    {/* Day label */}
                    <div
                      className={`bg-slate-50 dark:bg-slate-800/20 p-2 text-center border-r border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center ${dayIdx < days.length - 1 ? "border-b" : ""}`}
                    >
                      {day.substring(0, 3)}
                    </div>

                    {/* Period cells */}
                    {periods.map((p, pIdx) => {
                      const slots: any[] = grid[day]?.[p] ?? [];
                      const isLastRow = dayIdx === days.length - 1;
                      const isLastCol = pIdx === periods.length - 1;

                      return (
                        <div
                          key={p}
                          className={[
                            "p-1 border-slate-200 dark:border-slate-800 flex flex-col justify-center min-h-[88px]",
                            !isLastRow ? "border-b" : "",
                            !isLastCol ? "border-r" : "",
                          ].join(" ")}
                        >
                          {slots.length > 0 ? (
                            <div className="space-y-1 h-full flex flex-col justify-center">
                              {slots.map((slot: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`p-1.5 rounded border text-left flex flex-col justify-between h-full ${getCourseBg(slot.course?.code)}`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="font-bold tracking-wide truncate">
                                        {slot.course?.code ?? "—"}
                                      </p>
                                      {slot.room?.roomNumber && (
                                        <span className="text-[9px] font-semibold bg-white/60 dark:bg-black/30 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                          <MapPin className="h-2 w-2" />
                                          {slot.room.roomNumber}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[9px] font-medium leading-tight mt-0.5 line-clamp-2 opacity-80">
                                      {slot.course?.name ?? ""}
                                    </p>
                                  </div>
                                  {slot.faculty?.name && (
                                    <div className="flex items-center gap-1 mt-1 border-t border-black/5 dark:border-white/5 pt-1">
                                      <User className="h-2 w-2 opacity-60 shrink-0" />
                                      <p className="text-[8px] font-semibold opacity-70 truncate">
                                        {slot.faculty.name.replace(
                                          /^(Prof\.|Dr\.)\s*/,
                                          "",
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-semibold italic text-center select-none block w-full">
                              –
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Empty-slots notice */}
              {Array.isArray(timetableData.slots) &&
                timetableData.slots.length === 0 && (
                  <p className="text-center text-slate-400 text-sm pt-4">
                    This timetable has no slots assigned yet.
                  </p>
                )}
            </div>
          ) : (
            <div className="flex h-96 items-center justify-center text-slate-400">
              Select a timetable above to view its schedule.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
