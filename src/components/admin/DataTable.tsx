import { ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react';
import React from 'react';

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  searchPlaceholder = "Search...",
  onSearch,
  onRowClick
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" size={18} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low rounded-xl transition-colors whitespace-nowrap">
          <Filter size={18} />
          Filters
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10">
                {columns.map((column, i) => (
                  <th key={i} className="px-6 py-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-surface-container rounded-full w-24"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-on-surface-variant">
                    No records found
                  </td>
                </tr>
              ) : (
                data.map((item, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick?.(item)}
                    className={`hover:bg-surface-container-lowest transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {columns.map((column, j) => (
                      <td key={j} className="px-6 py-4 text-sm text-on-surface">
                        {column.cell ? column.cell(item) : (item[column.accessorKey as keyof T] as any)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <p className="text-xs text-on-surface-variant">
          Showing {data.length} records
        </p>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-surface-container rounded-lg transition-colors disabled:opacity-30" disabled>
            <ChevronLeft size={18} />
          </button>
          <button className="p-2 hover:bg-surface-container rounded-lg transition-colors disabled:opacity-30" disabled>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

