import React from 'react';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  avatarCol?: boolean;
  actionCol?: boolean;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 5,
  className = '',
  avatarCol = false,
  actionCol = true,
}) => {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {avatarCol && (
            <td className="py-3.5 px-4 w-12">
              <div className="w-8 h-8 rounded-xl bg-slate-200/80" />
            </td>
          )}
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-3.5 px-4">
              <div
                className="h-3.5 bg-slate-200/80 rounded-md"
                style={{
                  width: `${Math.max(40, 90 - (cIdx * 12 + (rIdx % 3) * 15))}%`,
                }}
              />
              {cIdx === 0 && (
                <div className="h-2.5 bg-slate-100 rounded-md w-1/2 mt-1.5" />
              )}
            </td>
          ))}
          {actionCol && (
            <td className="py-3.5 px-4 text-center w-16">
              <div className="w-7 h-7 rounded-lg bg-slate-200/70 mx-auto" />
            </td>
          )}
        </tr>
      ))}
    </tbody>
  );
};
