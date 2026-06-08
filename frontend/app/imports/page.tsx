"use client";

import React, { useState, useEffect } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import DashboardLayout from "@/components/layout";
import { api } from "@/lib/api";
import { useImportProgress } from "@/lib/hooks/use-socket";
import {
  FileUp,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Database,
  Building,
  Users,
  BookOpen,
  DoorOpen,
  Calendar,
  GitMerge,
} from "lucide-react";

export default function ImportsPage() {
  // PDF upload states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // CSV upload states
  const [csvEntity, setCsvEntity] = useState("departments");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<any>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Job queue & history states
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [integratingJobId, setIntegratingJobId] = useState<string | null>(null);
  const [integrateResult, setIntegrateResult] = useState<Record<string, any>>(
    {},
  );
  const [integrateError, setIntegrateError] = useState<Record<string, string>>(
    {},
  );

  // Listen to realtime Socket.IO updates
  const progressData = useImportProgress(activeJobId);

  const displayStatus = progressData?.status ?? activeJob?.status ?? "QUEUED";
  const displayProgress =
    progressData?.progress ?? (displayStatus === "COMPLETED" ? 100 : 0);
  const displaySummary = progressData?.summary ?? activeJob?.summary;
  const displayError = progressData?.error ?? activeJob?.errorMsg;

  const fetchJobs = async () => {
    setLoadingJobs(true);
    const res = await api.get<any>("/imports/jobs?limit=10");
    if (res.success && res.data) {
      setJobs(res.data);
      // Auto-recovery of active job on load:
      // If there is any job with a running status, set it as activeJobId
      const runningJob = res.data.find((job: any) =>
        [
          "QUEUED",
          "PARSING",
          "OCR_PROCESSING",
          "GEMINI_PARSING",
          "INTEGRATING",
        ].includes(job.status),
      );
      if (runningJob && !activeJobId) {
        setActiveJobId(runningJob.id);
        setActiveJob(runningJob);
      }
    }
    setLoadingJobs(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // Sync activeJob with updated jobs list if its status changes in background
  useEffect(() => {
    if (activeJobId && jobs.length > 0) {
      const match = jobs.find((j) => j.id === activeJobId);
      if (match) {
        setActiveJob(match);
      }
    }
  }, [activeJobId, jobs]);

  // Refresh history list when socket progress completes or fails
  useEffect(() => {
    if (
      progressData?.status === "COMPLETED" ||
      progressData?.status === "FAILED"
    ) {
      fetchJobs();
    }
  }, [progressData?.status]);

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;

    setPdfUploading(true);
    setPdfError(null);
    setActiveJobId(null);
    setActiveJob(null);

    const formData = new FormData();
    formData.append("file", pdfFile);

    const res = await api.post<{ importJobId: string; status: string }>(
      "/imports/pdf",
      formData,
    );

    if (res.success && res.data) {
      setActiveJobId(res.data.importJobId);
      setActiveJob({ id: res.data.importJobId, status: "QUEUED" });
      fetchJobs();
    } else {
      setPdfError(res.error || "Upload failed");
    }
    setPdfUploading(false);
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setCsvUploading(true);
    setCsvError(null);
    setCsvResult(null);

    const formData = new FormData();
    formData.append("file", csvFile);

    const res = await api.post<any>(`/imports/csv/${csvEntity}`, formData);

    if (res.success && res.data) {
      setCsvResult(res.data);
    } else {
      setCsvError(res.error || "CSV upload failed");
    }
    setCsvUploading(false);
  };

  const handleRetryJob = async (id: string) => {
    setPdfError(null);
    const res = await api.post<{ importJobId: string; status: string }>(
      `/imports/jobs/${id}/retry`,
      {},
    );
    if (res.success && res.data) {
      setActiveJobId(res.data.importJobId);
      setActiveJob({ id: res.data.importJobId, status: "QUEUED" });
      fetchJobs();
    } else {
      setPdfError(res.error || "Retry failed");
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to delete this import job? This will also delete scanned data associated with it.",
      )
    ) {
      const res = await api.delete(`/imports/jobs/${id}`);
      if (res.success) {
        if (activeJobId === id) {
          setActiveJobId(null);
          setActiveJob(null);
        }
        fetchJobs();
      } else {
        setPdfError(res.error || "Delete failed");
      }
    }
  };

  const handleIntegrateJob = async (id: string) => {
    setIntegratingJobId(id);
    setIntegrateError((prev) => ({ ...prev, [id]: "" }));
    const res = await api.post<any>(`/imports/jobs/${id}/integrate`, {});
    if (res.success && res.data) {
      setIntegrateResult((prev) => ({ ...prev, [id]: res.data }));
    } else {
      setIntegrateError((prev) => ({
        ...prev,
        [id]: res.error || "Integration failed",
      }));
    }
    setIntegratingJobId(null);
  };

  const handleDismissActiveTracker = () => {
    setActiveJobId(null);
    setActiveJob(null);
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "filename",
      header: "Filename",
      cell: ({ row }) => {
        const originalName = row.original.filename.replace(
          /^[0-9a-f]{32}_/,
          "",
        );
        return (
          <span
            className="font-bold text-slate-900 dark:text-white max-w-xs truncate"
            title={originalName}
          >
            {originalName}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const isRunning = [
          "QUEUED",
          "PARSING",
          "OCR_PROCESSING",
          "GEMINI_PARSING",
          "INTEGRATING",
        ].includes(row.original.status);
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              row.original.status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                : row.original.status === "FAILED"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
            }`}
          >
            {isRunning && (
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            )}
            {row.original.status}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => (
        <span className="text-slate-500 text-xs font-semibold">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "details",
      header: "Details",
      cell: ({ row }) => {
        const job = row.original;
        return (
          <div
            className="text-xs max-w-[200px] truncate font-semibold"
            title={job.status === "FAILED" ? job.errorMsg : undefined}
          >
            {job.status === "FAILED" ? (
              <span className="text-rose-500 font-semibold">
                {job.errorMsg}
              </span>
            ) : job.status === "COMPLETED" && job.summary ? (
              <span className="text-slate-600 dark:text-slate-400 font-semibold">
                Parsed Sem {job.summary.semester} {job.summary.branch}
              </span>
            ) : (
              <span className="text-slate-400">
                Processing in background...
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right w-full">Actions</div>,
      cell: ({ row }) => {
        const job = row.original;
        const isRunning = [
          "QUEUED",
          "PARSING",
          "OCR_PROCESSING",
          "GEMINI_PARSING",
          "INTEGRATING",
        ].includes(job.status);
        const isIntegrating = integratingJobId === job.id;
        const integrated = integrateResult[job.id];
        const intError = integrateError[job.id];
        return (
          <div className="flex flex-col gap-1.5 items-end">
            <div className="flex justify-end items-center gap-2">
              {isRunning ? (
                <button
                  onClick={() => {
                    setActiveJobId(job.id);
                    setActiveJob(job);
                  }}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 rounded-md text-xs font-semibold transition-colors"
                >
                  Track
                </button>
              ) : (
                <button
                  onClick={() => {
                    setActiveJobId(job.id);
                    setActiveJob(job);
                  }}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-semibold transition-colors"
                >
                  View Summary
                </button>
              )}
              {job.status === "FAILED" && (
                <button
                  onClick={() => handleRetryJob(job.id)}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 rounded-md text-xs font-semibold transition-colors"
                >
                  Retry
                </button>
              )}
              {job.status === "COMPLETED" && !integrated && (
                <button
                  onClick={() => handleIntegrateJob(job.id)}
                  disabled={isIntegrating}
                  className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 rounded-md text-xs font-semibold transition-colors disabled:opacity-60 flex items-center gap-1"
                  title="Convert scanned data into real Timetable records"
                >
                  {isIntegrating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <GitMerge className="h-3 w-3" />
                  )}
                  Integrate
                </button>
              )}
              <button
                onClick={() => handleDeleteJob(job.id)}
                className="px-2.5 py-1 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/20 dark:hover:text-red-400 text-slate-500 dark:text-slate-400 rounded-md text-xs font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
            {integrated && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold text-right">
                ✓ {integrated.integratedCount ?? 1} timetable(s) integrated
              </p>
            )}
            {intError && (
              <p
                className="text-[10px] text-rose-500 font-semibold text-right max-w-[200px] truncate"
                title={intError}
              >
                ✗ {intError}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Data Ingestion Portal
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Import timetable PDFs or bulk seed departments, rooms, courses, and
            faculty using CSV templates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PDF Timetable Ingestion */}
          <div className="premium-card p-6 bg-white dark:bg-[#1e293b] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
                <FileUp className="h-6 w-6" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Timetable PDF Parser
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Upload a structured PDF (like the BIT Mesra timetable). The
                system will queue, parse, and integrate it into PostgreSQL
                asynchronously.
              </p>

              <form onSubmit={handlePdfUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select PDF File
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pdfUploading || !pdfFile}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 text-white rounded-lg font-semibold text-sm disabled:cursor-no-drop cursor-pointer"
                >
                  {pdfUploading ? "Uploading..." : "Start Import"}
                </button>
              </form>
            </div>

            {/* Realtime PDF Progress Tracker */}
            {activeJobId && (
              <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    Real-time Progress
                  </h3>
                </div>

                {/* State display */}
                <div className="flex items-center gap-3 mb-4">
                  {displayStatus !== "COMPLETED" &&
                  displayStatus !== "FAILED" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  ) : displayStatus === "COMPLETED" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-600" />
                  )}
                  <span className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {displayStatus}
                  </span>
                  {displayStatus !== "COMPLETED" &&
                    displayStatus !== "FAILED" &&
                    displayProgress !== undefined && (
                      <span className="text-sm font-bold text-slate-500 ml-auto">
                        {displayProgress}%
                      </span>
                    )}
                </div>

                {/* Progress bar */}
                {displayStatus !== "COMPLETED" &&
                  displayStatus !== "FAILED" && (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-4">
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${displayProgress}%` }}
                      />
                    </div>
                  )}

                {/* Integration summary */}
                {displayStatus === "COMPLETED" && displaySummary && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-[#0f172a] rounded-lg p-4 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <p className="font-bold text-slate-800 dark:text-white mb-2">
                        Import Results Summary:
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 dark:text-slate-400">
                        <p className="flex items-center gap-1.5">
                          <Database className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>Timetables:</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-auto">
                            {displaySummary.created?.timetables ?? 0}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span>Slots:</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-auto">
                            {displaySummary.created?.slots ?? 0}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <DoorOpen className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span>Rooms:</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-auto">
                            {displaySummary.created?.rooms ?? 0}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>Courses:</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-auto">
                            {displaySummary.created?.courses ?? 0}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                          <span>Faculty:</span>
                          <span className="font-bold text-slate-800 dark:text-white ml-auto">
                            {displaySummary.created?.faculty ?? 0}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDismissActiveTracker}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Clear and Import Another PDF
                    </button>
                  </div>
                )}

                {/* Error */}
                {displayStatus === "FAILED" && (
                  <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 rounded-lg p-3 text-xs border border-red-200 dark:border-red-900/20 font-medium break-words">
                      Error: {displayError || "Failed to process PDF file."}
                    </div>

                    <button
                      onClick={handleDismissActiveTracker}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Clear and Import Another PDF
                    </button>
                  </div>
                )}
              </div>
            )}

            {pdfError && (
              <div className="mt-4 flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200 dark:border-rose-900/30 text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {pdfError}
              </div>
            )}
          </div>

          {/* CSV Bulk Ingestion */}
          <div className="premium-card p-6 bg-white dark:bg-[#1e293b] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="h-6 w-6" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  CSV Entity Importer
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Bulk upload system configuration entities using CSV data. Select
                an entity type and upload its matching template.
              </p>

              <form onSubmit={handleCsvUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Entity Type
                  </label>
                  <select
                    value={csvEntity}
                    onChange={(e) => setCsvEntity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="departments">Departments</option>
                    <option value="rooms">Rooms</option>
                    <option value="courses">Courses</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-slate-800 dark:file:text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={csvUploading || !csvFile}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 text-white rounded-lg font-semibold text-sm disabled:cursor-no-drop cursor-pointer"
                >
                  {csvUploading ? "Uploading..." : "Import CSV"}
                </button>
              </form>
            </div>

            {/* CSV Import Results summary */}
            {csvResult && (
              <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 rounded-lg p-4 border border-emerald-200 dark:border-emerald-900/30 text-xs">
                  <div className="flex items-center gap-2 mb-2 font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    CSV Import Succeeded!
                  </div>
                  <p>
                    Processed:{" "}
                    <span className="font-bold">{csvResult.processed}</span>{" "}
                    rows
                  </p>
                  <p>
                    Imported:{" "}
                    <span className="font-bold">{csvResult.created}</span> new
                    entities
                  </p>
                  {csvResult.errors && csvResult.errors.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                      <p className="font-bold text-rose-600 dark:text-rose-400">
                        Failed rows ({csvResult.errors.length}):
                      </p>
                      <ul className="list-disc list-inside text-rose-500 mt-1 max-h-20 overflow-y-auto">
                        {csvResult.errors.map((e: any, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {csvError && (
              <div className="mt-4 flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200 dark:border-rose-900/30 text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {csvError}
              </div>
            )}
          </div>
        </div>

        {/* Job Ingestion History & Queue Section */}
        <div className="premium-card p-6 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Ingestion Queue & History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                View and manage previous and active timetable import pipelines.
              </p>
            </div>
            <button
              onClick={fetchJobs}
              disabled={loadingJobs}
              className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
            >
              {loadingJobs ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
              ) : null}
              Refresh Queue
            </button>
          </div>

          <DataTable columns={columns} data={jobs} loading={loadingJobs} />
        </div>
      </div>
    </DashboardLayout>
  );
}
