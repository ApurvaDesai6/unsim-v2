"use client";

interface VoteComparisonProps {
  predicted: { yes: number; no: number; abstain: number };
  actual: { yes: number; no: number; abstain: number };
  predictedPassed: boolean;
  actualPassed: boolean;
  title?: string;
}

export default function VoteComparison({
  predicted,
  actual,
  predictedPassed,
  actualPassed,
  title,
}: VoteComparisonProps) {
  const predTotal = predicted.yes + predicted.no + predicted.abstain;
  const actTotal = actual.yes + actual.no + actual.abstain;

  const accuracy = predTotal > 0 && actTotal > 0
    ? ((predictedPassed === actualPassed ? 1 : 0) * 100).toFixed(0)
    : null;

  const yesError = actTotal > 0 ? Math.abs(predicted.yes / predTotal - actual.yes / actTotal) : 0;
  const noError = actTotal > 0 ? Math.abs(predicted.no / predTotal - actual.no / actTotal) : 0;

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">{title}</h4>
          {accuracy !== null && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              predictedPassed === actualPassed
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}>
              {predictedPassed === actualPassed ? "✓ Outcome Match" : "✗ Outcome Mismatch"}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Predicted */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">KG Prediction</span>
            <span className={`text-xs font-medium ${predictedPassed ? "text-green-400" : "text-red-400"}`}>
              {predictedPassed ? "PASSES" : "FAILS"}
            </span>
          </div>
          <VoteBar yes={predicted.yes} no={predicted.no} abstain={predicted.abstain} total={predTotal} />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span className="text-green-400">{predicted.yes} Yes</span>
            <span className="text-red-400">{predicted.no} No</span>
            <span className="text-yellow-400">{predicted.abstain} Abs</span>
          </div>
        </div>

        {/* Actual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">Actual Result</span>
            <span className={`text-xs font-medium ${actualPassed ? "text-green-400" : "text-red-400"}`}>
              {actualPassed ? "PASSED" : "FAILED"}
            </span>
          </div>
          <VoteBar yes={actual.yes} no={actual.no} abstain={actual.abstain} total={actTotal} />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span className="text-green-400">{actual.yes} Yes</span>
            <span className="text-red-400">{actual.no} No</span>
            <span className="text-yellow-400">{actual.abstain} Abs</span>
          </div>
        </div>
      </div>

      {/* Error metrics */}
      <div className="flex items-center gap-4 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">Yes error:</span>
          <span className={`text-[10px] ${yesError < 0.1 ? "text-green-400" : yesError < 0.2 ? "text-yellow-400" : "text-red-400"}`}>
            {(yesError * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">No error:</span>
          <span className={`text-[10px] ${noError < 0.1 ? "text-green-400" : noError < 0.2 ? "text-yellow-400" : "text-red-400"}`}>
            {(noError * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function VoteBar({ yes, no, abstain, total }: { yes: number; no: number; abstain: number; total: number }) {
  if (total === 0) return <div className="h-4 rounded-full bg-white/5" />;

  return (
    <div className="flex h-4 rounded-full overflow-hidden bg-white/5">
      <div className="bg-green-500/80 transition-all" style={{ width: `${(yes / total) * 100}%` }} />
      <div className="bg-red-500/80 transition-all" style={{ width: `${(no / total) * 100}%` }} />
      <div className="bg-yellow-500/60 transition-all" style={{ width: `${(abstain / total) * 100}%` }} />
    </div>
  );
}
