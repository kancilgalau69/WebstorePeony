"use client";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: PaginationProps) {
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const showAll = pageSize === 0;
  const from = showAll ? 1 : (currentPage - 1) * pageSize + 1;
  const to = showAll ? totalItems : Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        {/* Prev / Next */}
        {!showAll && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <span className="px-2.5 py-1.5 text-xs text-gray-600 min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}
        {/* Info */}
        <span className="text-xs text-gray-400">
          {totalItems > 0 ? `${from}-${to} dari ${totalItems}` : "0 data"}
        </span>
      </div>

      {/* Per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Tampilkan:</span>
        <div className="flex items-center gap-1">
          {pageSizeOptions.map((size) => (
            <button
              key={size}
              onClick={() => { onPageSizeChange(size); onPageChange(1); }}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                pageSize === size
                  ? "bg-[#5c63f2] text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {size}
            </button>
          ))}
          <button
            onClick={() => { onPageSizeChange(0); onPageChange(1); }}
            className={`px-2 py-1 rounded text-xs font-medium transition ${
              pageSize === 0
                ? "bg-[#5c63f2] text-white"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            All
          </button>
        </div>
      </div>
    </div>
  );
}
