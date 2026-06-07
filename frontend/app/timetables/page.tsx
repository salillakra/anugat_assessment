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
    const res = await api.get<any[]>("/timetables?limit=100");
    if (res.success && res.data) {
      setTimetables(res.data);
      if (res.data.length > 0) {
        setSelectedTimetableId(res.data[0].id);
      }
    }
    setLoadingList(false);
  };

  const fetchTimetable = async (id: string) => {
    setLoadingData(true);
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
    { id: 1, name: "I", time: "08:00 - 08:50" },
    { id: 2, name: "II", time: "09:00 - 09:50" },
    { id: 3, name: "III", time: "10:00 - 10:50" },
    { id: 4, name: "IV", time: "11:00 - 11:50" },
    { id: 5, name: "V", time: "12:00 - 12:50" },
    { id: 6, name: "VI", time: "13:30 - 14:20" },
    { id: 7, name: "VII", time: "14:30 - 15:20" },
    { id: 8, name: "VIII", time: "15:30 - 16:20" },
    { id: 9, name: "IX", time: "16:30 - 17:20" },
  ];

  // Group slots by dayOfWeek and period
  const grid: Record<string, Record<number, any[]>> = {};
  days.forEach((d) => {
    grid[d] = {};
    periods.forEach((p) => {
      grid[d][p] = [];
    });
  });

  if (timetableData?.slots) {
    timetableData.slots.forEach((slot: never) => {
      if (grid[slot.dayOfWeek] && grid[slot.dayOfWeek][slot.period]) {
        grid[slot.dayOfWeek][slot.period].push(slot);
      }
    });
  }

  // Generate color palette based on course code
  const getCourseBg = (code: string) => {
    if (!code)
      return "bg-slate-50 border-slate-200 dark:bg-slate-800/20 dark:border-slate-800";
    const h = code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-300",
      "bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/20 dark:border-indigo-900 dark:text-indigo-300",
      "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-950/20 dark:border-violet-900 dark:text-violet-300",
      "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-300",
      "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-300",
      "bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/20 dark:border-teal-900 dark:text-teal-300",
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-300",
    ];
    return colors[h % colors.length];
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
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

          {/* Timetable Selector */}
          {!loadingList && timetables.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-500">
                Timetable:
              </label>
              <select
                value={selectedTimetableId}
                onChange={(e) => setSelectedTimetableId(e.target.value)}
                className="px-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timetables.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Timetable Grid Card */}
        <div className="premium-card p-6 bg-white dark:bg-[#1e293b] overflow-x-auto">
          {loadingData ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : timetableData ? (
            <div className="min-w-[1000px] space-y-4">
              {/* Header Details */}
              <div className="flex items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Branch
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    {timetableData.branch?.name} ({timetableData.branch?.code})
                  </p>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Semester
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    Semester {timetableData.semester}
                  </p>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800" />
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Section
                  </p>
                  <p className="text-base font-bold text-slate-800 dark:text-white mt-1">
                    Section {timetableData.section}
                  </p>
                </div>
              </div>

              {/* Weekly Timetable Grid */}
              <div className="grid grid-cols-10 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {/* Column Headers */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 text-center text-xs font-bold text-slate-500 border-r border-b border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  Days
                </div>
                {PERIOD_HEADERS.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-50 dark:bg-slate-800/40 p-3 text-center border-b border-r last:border-r-0 border-slate-200 dark:border-slate-800"
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Period {p.name}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {p.time}
                    </p>
                  </div>
                ))}

                {/* Grid Rows */}
                {days.map((day) => (
                  <React.Fragment key={day}>
                    {/* Day Cell */}
                    <div className="bg-slate-50 dark:bg-slate-800/20 p-3 text-center border-r border-b last:border-b-0 border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center">
                      {day.substring(0, 3)}
                    </div>

                    {/* Periods Cells */}
                    {periods.map((p) => {
                      const slots = grid[day][p] || [];
                      const isLunch = p === 6; // VI period starts after lunch (13:30)

                      return (
                        <div
                          key={p}
                          className="p-1 border-r border-b last:border-r-0 last:border-b-0 border-slate-200 dark:border-slate-800 flex flex-col justify-center min-h-[90px] relative"
                        >
                          {/* If Lunch Break marker (render between V and VI columns implicitly) */}
                          {/* Actually, periods are 1-9. Monday period V is 12:00-12:50. Lunch is 12:50-13:30. VI is 13:30-14:20 */}
                          {slots.length > 0 ? (
                            <div className="space-y-1 h-full flex flex-col justify-center">
                              {slots.map((slot: unknown, idx: number) => (
                                <div
                                  key={idx}
                                  className={`p-2 rounded border text-left h-full flex flex-col justify-between ${getCourseBg(
                                    slot.course?.code,
                                  )}`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="text-xs font-bold tracking-wide truncate">
                                        {slot.course?.code || "COURSE"}
                                      </p>
                                      {slot.room?.roomNumber && (
                                        <span className="text-[9px] font-semibold bg-white/60 dark:bg-black/30 px-1 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                                          <MapPin className="h-2 w-2" />
                                          {slot.room.roomNumber}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[9px] font-medium leading-tight mt-0.5 line-clamp-1">
                                      {slot.course?.name || "No Name"}
                                    </p>
                                  </div>

                                  {slot.faculty?.name && (
                                    <div className="flex items-center gap-1 mt-1 border-t border-black/5 dark:border-white/5 pt-1">
                                      <User className="h-2 w-2 opacity-65 shrink-0" />
                                      <p className="text-[8px] font-semibold opacity-75 truncate">
                                        {slot.faculty.name.replace(
                                          /(Prof\.|Dr\.)\s*/,
                                          "",
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-700 font-semibold italic text-center select-none">
                              -
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-96 items-center justify-center text-slate-400">
              No timetables available. Upload a PDF timetable first!
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
