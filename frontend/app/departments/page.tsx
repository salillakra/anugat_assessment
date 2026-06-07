"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout";
import { api } from "@/lib/api";
import { Plus, Edit2, Trash2, Search, X } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { type ColumnDef } from "@tanstack/react-table";

export default function DepartmentsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    const res = await api.get<any[]>(`/departments?page=${page}&limit=10&search=${search}`);
    if (res.success && res.data) {
      setData(res.data);
      if (res.pagination) {
        setTotal(res.pagination.total);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartments();
  }, [page, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const body = { name, code: code.toUpperCase().trim() };
    let res;

    if (editingId) {
      res = await api.put(`/departments/${editingId}`, body);
    } else {
      res = await api.post("/departments", body);
    }

    if (res.success) {
      setModalOpen(false);
      setName("");
      setCode("");
      setEditingId(null);
      fetchDepartments();
    } else {
      setFormError(res.error || "Save failed");
    }
  };

  const handleEdit = (dept: any) => {
    setEditingId(dept.id);
    setName(dept.name);
    setCode(dept.code);
    setFormError(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this department?")) {
      const res = await api.delete(`/departments/${id}`);
      if (res.success) {
        fetchDepartments();
      } else {
        alert(res.error || "Delete failed");
      }
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
      header: "Department Name",
      cell: ({ row }) => <span className="font-semibold text-slate-800 dark:text-slate-200">{row.original.name}</span>,
    },
    {
      id: "actions",
      header: () => <div className="text-right w-full">Actions</div>,
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-2">
          <button
            onClick={() => handleEdit(row.original)}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition-colors"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.original.id)}
            className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Title / Action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Departments Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Configure and edit university academic departments.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setName("");
              setCode("");
              setFormError(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm hover:shadow-md"
          >
            <Plus className="h-5 w-5" />
            Add Department
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center max-w-md relative">
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
            placeholder="Search departments..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingId ? "Edit Department" : "Add Department"}
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
                    Department Code
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. CS"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
      </div>
    </DashboardLayout>
  );
}
