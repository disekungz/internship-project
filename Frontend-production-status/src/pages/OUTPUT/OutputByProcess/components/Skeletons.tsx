import React from "react";

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-[400px] flex flex-col gap-6 p-2">
      {/* Legend Skeleton */}
      <div className="flex justify-center items-center gap-3 w-full animate-pulse">
        <div className="h-3.5 w-12 bg-base-300 rounded"></div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-4.5 w-16 bg-base-300 rounded-full"></div>
          ))}
        </div>
      </div>

      {/* Bars Skeleton */}
      <div className="flex-1 flex items-end gap-3 md:gap-5 h-[350px] border-b border-l border-base-300 pb-2 pl-2 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(i => {
          const heights = ["60%", "85%", "40%", "75%", "90%", "50%", "65%", "80%", "35%", "70%", "55%", "45%"];
          return (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full">
              <div className="w-full bg-base-300/40 rounded-t" style={{ height: heights[(i - 1) % heights.length] }}>
                <div className="w-full bg-base-300/60 h-[30%] rounded-t"></div>
                <div className="w-full bg-base-300/40 h-[40%]"></div>
              </div>
              <div className="h-3 w-8 bg-base-200 rounded self-center mt-1"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 p-4 animate-pulse w-full">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="w-full h-16 bg-base-200/50 rounded-xl border border-base-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-base-300"></div>
            <div className="w-32 h-4 rounded bg-base-300"></div>
          </div>
          <div className="flex gap-4">
            <div className="w-16 h-4 rounded bg-base-300"></div>
            <div className="w-16 h-4 rounded bg-base-300"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
