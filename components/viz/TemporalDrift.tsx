"use client";

interface DecadeData {
  decade: string;
  yesRate: number;
  noRate: number;
  abstainRate: number;
  sampleSize: number;
}

interface TemporalDriftProps {
  data: Record<string, DecadeData[]>;
  countryName: string;
}

export default function TemporalDrift({ data, countryName }: TemporalDriftProps) {
  const topics = Object.entries(data).filter(([_, decades]) => decades.length >= 2);

  if (topics.length === 0) {
    return (
      <div className="text-xs text-gray-500 p-4">
        Insufficient temporal data for {countryName}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xs uppercase tracking-wider text-gray-400">
        Voting Drift Over Time — {countryName}
      </h4>
      {topics.map(([topic, decades]) => (
        <div key={topic} className="space-y-2">
          <p className="text-[11px] text-gray-300">{topic}</p>
          <div className="flex items-end gap-1 h-16">
            {decades.map((d) => {
              const barHeight = Math.max(4, d.yesRate * 64);
              return (
                <div key={d.decade} className="flex flex-col items-center gap-1 flex-1">
                  <div className="relative w-full flex flex-col items-center">
                    <div
                      className="w-full max-w-[20px] rounded-t-sm bg-green-500/60 transition-all"
                      style={{ height: `${barHeight}px` }}
                      title={`${d.decade}: ${(d.yesRate * 100).toFixed(0)}% Yes (n=${d.sampleSize})`}
                    />
                  </div>
                  <span className="text-[9px] text-gray-600">{d.decade.slice(0, 4)}</span>
                </div>
              );
            })}
          </div>
          {/* Drift indicator */}
          {decades.length >= 2 && (
            <div className="flex items-center gap-1">
              {(() => {
                const first = decades[0].yesRate;
                const last = decades[decades.length - 1].yesRate;
                const drift = last - first;
                if (Math.abs(drift) < 0.05) return <span className="text-[10px] text-gray-500">→ Stable</span>;
                return (
                  <span className={`text-[10px] ${drift > 0 ? "text-green-400" : "text-red-400"}`}>
                    {drift > 0 ? "↑" : "↓"} {Math.abs(drift * 100).toFixed(0)}% shift ({decades[0].decade}→{decades[decades.length - 1].decade})
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
