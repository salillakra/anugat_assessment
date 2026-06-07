"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type TableState,
  type Updater,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;

  // Controlled states for synchronizing with URL/Server/Product UI
  state?: Partial<TableState>;
  onSortingChange?: (updater: Updater<SortingState>) => void;
  onColumnFiltersChange?: (updater: Updater<ColumnFiltersState>) => void;
  onColumnVisibilityChange?: (updater: Updater<VisibilityState>) => void;
  onRowSelectionChange?: (updater: Updater<RowSelectionState>) => void;
  onGlobalFilterChange?: (updater: Updater<unknown>) => void;

  // Server-side pagination
  serverPagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    totalCount: number;
    onPageChange: (index: number) => void;
  };

  enableRowSelection?: boolean | ((row: unknown) => boolean);
}

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  state: controlledState,
  onSortingChange,
  onColumnFiltersChange,
  onColumnVisibilityChange,
  onRowSelectionChange,
  onGlobalFilterChange,
  serverPagination,
  enableRowSelection,
}: DataTableProps<TData>) {
  // Internal fallback states for uncontrolled usage
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalColumnFilters, setInternalColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] =
    useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});
  const [internalGlobalFilter, setInternalGlobalFilter] = useState<unknown>("");

  const sorting = controlledState?.sorting ?? internalSorting;
  const columnFilters = controlledState?.columnFilters ?? internalColumnFilters;
  const columnVisibility =
    controlledState?.columnVisibility ?? internalColumnVisibility;
  const rowSelection = controlledState?.rowSelection ?? internalRowSelection;
  const globalFilter = controlledState?.globalFilter ?? internalGlobalFilter;

  // Setup TanStack Table
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      ...(serverPagination
        ? {
            pagination: {
              pageIndex: serverPagination.pageIndex - 1, // 0-based inside hook
              pageSize: serverPagination.pageSize,
            },
          }
        : {}),
      ...controlledState, // Spread any other state overrides
    },
    // Bind change handlers (prioritize controlled props, fallback to internal state updates)
    onSortingChange: onSortingChange ?? setInternalSorting,
    onColumnFiltersChange: onColumnFiltersChange ?? setInternalColumnFilters,
    onColumnVisibilityChange:
      onColumnVisibilityChange ?? setInternalColumnVisibility,
    onRowSelectionChange: onRowSelectionChange ?? setInternalRowSelection,
    onGlobalFilterChange: onGlobalFilterChange ?? setInternalGlobalFilter,

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),

    // Client-side pagination config (only runs if serverPagination is omitted)
    getPaginationRowModel: serverPagination
      ? undefined
      : getPaginationRowModel(),
    manualPagination: !!serverPagination,
    pageCount: serverPagination?.pageCount ?? -1,

    enableRowSelection: enableRowSelection ?? false,
  });

  const pageIndex = serverPagination
    ? serverPagination.pageIndex
    : table.getState().pagination.pageIndex + 1;
  const pageSize = serverPagination
    ? serverPagination.pageSize
    : table.getState().pagination.pageSize;
  const totalCount = serverPagination
    ? serverPagination.totalCount
    : data.length;
  const pageCount = serverPagination
    ? serverPagination.pageCount
    : table.getPageCount();

  const handlePageChange = (newPageIndex: number) => {
    if (serverPagination) {
      serverPagination.onPageChange(newPageIndex);
    } else {
      table.setPageIndex(newPageIndex - 1);
    }
  };

  const hasNextPage = serverPagination
    ? pageIndex < pageCount
    : table.getCanNextPage();

  const hasPreviousPage = serverPagination
    ? pageIndex > 1
    : table.getCanPreviousPage();

  return (
    <div className="premium-card bg-white dark:bg-[#1e293b] overflow-hidden border border-slate-200 dark:border-slate-800">
      {loading ? (
        <div className="flex h-64 items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortState = header.column.getIsSorted();

                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        onClick={
                          canSort
                            ? header.column.getToggleSortingHandler()
                            : undefined
                        }
                        className={
                          canSort
                            ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                            : ""
                        }
                        aria-sort={
                          sortState === "asc"
                            ? "ascending"
                            : sortState === "desc"
                              ? "descending"
                              : "none"
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          {canSort && !header.isPlaceholder && (
                            <span className="text-slate-400">
                              {sortState === "asc" ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : sortState === "desc" ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium italic"
                  >
                    No records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalCount > (serverPagination?.pageSize ?? 10) && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/10 gap-4">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Showing {Math.max(1, (pageIndex - 1) * pageSize + 1)} to{" "}
                {Math.min(pageIndex * pageSize, totalCount)} of {totalCount}{" "}
                entries
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pageIndex - 1)}
                  disabled={!hasPreviousPage}
                  className="px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pageCount) }).map(
                    (_, idx) => {
                      let pageNum = idx + 1;
                      if (pageIndex > 3 && pageCount > 5) {
                        pageNum = pageIndex - 3 + idx;
                        if (pageNum + (4 - idx) > pageCount) {
                          pageNum = pageCount - 4 + idx;
                        }
                      }
                      if (pageNum > pageCount || pageNum < 1) return null;

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            pageIndex === pageNum
                              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                              : "bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>

                <button
                  onClick={() => handlePageChange(pageIndex + 1)}
                  disabled={!hasNextPage}
                  className="px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
