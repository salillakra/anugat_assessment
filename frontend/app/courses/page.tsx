"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Plus, Edit2, Trash2, Search, X, Upload } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";

export default function CoursesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [semFilter, setSemFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal / Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [credits, setCredits] = useState<number>(3);
  const [type, setType] = useState("THEORY");
  const [semester, setSemester] = useState<number>(1);
  const [branchId, setBranchId] = useState("");

  // CSV Import States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditor = user?.role === "ADMIN" || user?.role === "HOD";
  const isDeleter = user?.role === "ADMIN";

  const fetchCourses = async () => {
    setLoading(true);
    let url = `/courses?page=${page}&limit=10&search=${search}`;
    if (branchFilter) url += `&branchId=${branchFilter}`;
    if (semFilter) url += `&semester=${semFilter}`;
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

  const fetchBranches = async () => {
    const res = await api.get<any[]>("/branches?limit=100");
    if (res.success && res.data) {
      setBranches(res.data);
      if (res.data.length > 0 && !branchId) {
        setBranchId(res.data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [page, search, branchFilter, semFilter, typeFilter]);

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const body = {
      code: code.toUpperCase().trim(),
      name: name.trim(),
      credits: Number(credits),
      type,
      semester: Number(semester),
      branchId,
    };

    let res;
    if (editingId) {
      res = await api.put(`/courses/${editingId}`, body);
    } else {
      res = await api.post("/courses", body);
    }

    if (res.success) {
      setModalOpen(false);
      setCode("");
      setName("");
      setCredits(3);
      setType("THEORY");
      setSemester(1);
      setEditingId(null);
      fetchCourses();
    } else {
      setFormError(res.error || "Failed to save course details");
    }
  };

  const handleEdit = (course: any) => {
    setEditingId(course.id);
    setCode(course.code);
    setName(course.name);
    setCredits(course.credits);
    setType(course.type);
    setSemester(course.semester);
    setBranchId(course.branchId);
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this course?")) {
      const res = await api.delete(`/courses/${id}`);
      if (res.success) {
        fetchCourses();
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
      const res = await api.post<any>("/courses/import/csv", formData);

      if (res.success && res.data) {
        setImportResult(res.data);
        setCsvFile(null);
        fetchCourses();
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
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-bold text-slate-900 dark:text-white">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Course Name",
      cell: ({ row }) => <span className="font-semibold text-slate-800 dark:text-slate-200">{row.original.name}</span>,
    },
    {
      accessorKey: "credits",
      header: "Credits",
      cell: ({ row }) => <span className="font-semibold text-slate-600 dark:text-slate-400">{row.original.credits} credits</span>,
    },
    {
      accessorKey: "semester",
      header: "Semester",
      cell: ({ row }) => <span className="font-semibold text-slate-600 dark:text-slate-400">Semester {row.original.semester}</span>,
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 rounded whitespace-nowrap">
            {row.original.branch?.code || "N/A"}
          </span>
          <span className="font-medium text-xs text-slate-500 whitespace-nowrap">
            {row.original.branch?.department?.code || "N/A"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.original.type === "THEORY"
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            : row.original.type === "LAB"
            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
            : "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400"
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
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {isDeleter && (
                  <button
                    onClick={() => handleDelete(row.original.id)}
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 transition-colors"
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
              Courses Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure and edit university curriculum subjects and credits.
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
                    setCode("");
                    setName("");
                    setCredits(3);
                    setType("THEORY");
                    setSemester(1);
                    if (branches.length > 0) setBranchId(branches[0].id);
                    setFormError(null);
                    setModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                  <Plus className="h-5 w-5" />
                  Add Course
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
              placeholder="Search by code or name..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} - {b.name}
              </option>
            ))}
          </select>

          <select
            value={semFilter}
            onChange={(e) => {
              setSemFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
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
            <option value="THEORY">Theory</option>
            <option value="LAB">Lab</option>
            <option value="TUTORIAL">Tutorial</option>
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
                  {editingId ? "Edit Course" : "Add Course"}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Code
                    </label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. CS333"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Credits
                    </label>
                    <input
                      type="number"
                      required
                      step="0.5"
                      min={0.5}
                      max={20}
                      value={credits}
                      onChange={(e) => setCredits(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Course Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Compiler Design"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-955 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Semester
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={12}
                      value={semester}
                      onChange={(e) => setSemester(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-955 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="THEORY">Theory</option>
                      <option value="LAB">Lab</option>
                      <option value="TUTORIAL">Tutorial</option>
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
                  Bulk Import Courses
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
                  <p className="mt-1">Courses Created: {importResult.createdCount ?? 0}</p>
                  <p>Courses Skipped/Updated: {importResult.updatedCount ?? 0}</p>
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
                      Columns required: `code`, `name`, `credits`, `type` (THEORY, LAB, TUTORIAL), `semester`, `branchCode`
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
