"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Plus, Edit2, Trash2, Search, X, Upload } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";

export default function RoomsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal / Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Fields
  const [roomNumber, setRoomNumber] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [capacity, setCapacity] = useState<number>(30);
  const [type, setType] = useState("CLASSROOM");
  
  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditor = user?.role === "ADMIN" || user?.role === "COORDINATOR";
  const isDeleter = user?.role === "ADMIN";

  const fetchRooms = async () => {
    setLoading(true);
    let url = `/rooms?page=${page}&limit=10&search=${search}`;
    if (deptFilter) url += `&departmentId=${deptFilter}`;
    if (typeFilter) url += `&type=${typeFilter}`;
    
    const res = await api.get<any[]>(url);
    if (res.success && res.data) {
      setData(res.data);
      if (res.pagination) {
        setTotal(res.pagination.total);
      }
    }
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const res = await api.get<any[]>("/departments?limit=100");
    if (res.success && res.data) {
      setDepartments(res.data);
      if (res.data.length > 0 && !departmentId) {
        setDepartmentId(res.data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [page, search, deptFilter, typeFilter]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const body = {
      roomNumber: roomNumber.trim(),
      departmentId,
      capacity: Number(capacity),
      type,
    };

    let res;
    if (editingId) {
      res = await api.put(`/rooms/${editingId}`, body);
    } else {
      res = await api.post("/rooms", body);
    }

    if (res.success) {
      setModalOpen(false);
      setRoomNumber("");
      setCapacity(30);
      setType("CLASSROOM");
      setEditingId(null);
      fetchRooms();
    } else {
      setFormError(res.error || "Failed to save room details");
    }
  };

  const handleEdit = (room: any) => {
    setEditingId(room.id);
    setRoomNumber(room.roomNumber);
    setDepartmentId(room.departmentId);
    setCapacity(room.capacity);
    setType(room.type);
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this room?")) {
      const res = await api.delete(`/rooms/${id}`);
      if (res.success) {
        fetchRooms();
      } else {
        alert(res.error || "Delete failed");
      }
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const res = await api.post<any>("/rooms/import/csv", formData);

      if (res.success && res.data) {
        setImportResult(res.data);
        setCsvFile(null);
        fetchRooms();
      } else {
        setImportError(res.error || "Import failed");
      }
    } catch (err: any) {
      setImportError(err.message || "An unexpected error occurred during import");
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "roomNumber",
      header: "Room Number",
      cell: ({ row }) => <span className="font-bold text-slate-900 dark:text-white">{row.original.roomNumber}</span>,
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded whitespace-nowrap">
            {row.original.department?.code || "N/A"}
          </span>
          <span className="font-medium text-xs text-slate-500 whitespace-nowrap">
            {row.original.department?.name}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "capacity",
      header: "Capacity",
      cell: ({ row }) => <span className="font-semibold text-slate-600 dark:text-slate-400">{row.original.capacity} seats</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.original.type === "CLASSROOM"
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : row.original.type === "LAB"
            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
            : row.original.type === "SEMINAR"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
        }`}>
          {row.original.type}
        </span>
      ),
    },
    ...(isEditor
      ? [
          {
            id: "actions",
            header: () => <div className="text-right w-full">Actions</div>,
            cell: ({ row }: any) => (
              <div className="flex justify-end items-center gap-2">
                <button
                  onClick={() => handleEdit(row.original)}
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-855 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {isDeleter && (
                  <button
                    onClick={() => handleDelete(row.original.id)}
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-855 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Title / Action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Rooms Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure and allocate physical classrooms, labs, and seminar halls.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isEditor && (
              <>
                <button
                  onClick={() => {
                    setImportError(null);
                    setImportResult(null);
                    setCsvFile(null);
                    setImportModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Import CSV
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setRoomNumber("");
                    if (departments.length > 0) setDepartmentId(departments[0].id);
                    setCapacity(30);
                    setType("CLASSROOM");
                    setFormError(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                  <Plus className="h-5 w-5" />
                  Add Room
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center w-full md:max-w-xs relative">
            <span className="absolute left-3 text-slate-400">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search rooms..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="CLASSROOM">Classroom</option>
            <option value="LAB">Lab</option>
            <option value="SEMINAR">Seminar Hall</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          serverPagination={{
            pageIndex: page,
            pageSize: 10,
            pageCount: Math.ceil(total / 10),
            totalCount: total,
            onPageChange: (index) => setPage(index),
          }}
        />


        {/* Create/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingId ? "Edit Room" : "Add Room"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-900/30">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Room Number / Name
                  </label>
                  <input
                    type="text"
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 219, Lab 3, G3"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} - {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Capacity (Seats)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={2000}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Room Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CLASSROOM">Classroom</option>
                      <option value="LAB">Lab</option>
                      <option value="SEMINAR">Seminar Hall</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow-md"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import CSV Modal */}
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Bulk Import Rooms
                </h3>
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {importError && (
                <div className="mb-4 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-900/30">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="mb-4 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-900/30">
                  <p className="font-bold">Import Completed Successfully!</p>
                  <p className="mt-1">Rooms Created: {importResult.createdCount ?? 0}</p>
                  <p>Rooms Skipped/Updated: {importResult.updatedCount ?? 0}</p>
                </div>
              )}

              <form onSubmit={handleImportCsv} className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                    <Upload className="mx-auto h-10 w-10 text-slate-400" />
                    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {csvFile ? csvFile.name : "Choose CSV File"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Columns required: `roomNumber`, `departmentCode`, `capacity`, `type` (CLASSROOM, LAB, SEMINAR, OTHER)
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e293b] rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!csvFile || importing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {importing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Importing...
                      </>
                    ) : (
                      "Upload & Import"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
