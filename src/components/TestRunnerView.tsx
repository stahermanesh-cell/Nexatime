import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { toPersianDigits } from '../utils/jalali';
import { CheckCircle2, XCircle, Play, ShieldCheck, RefreshCw } from 'lucide-react';

export const TestRunnerView: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    passedAll: boolean;
    totalTests: number;
    passedCount: number;
    results: { testNumber: number; title: string; passed: boolean; message: string }[];
  } | null>(null);

  const runTests = async () => {
    try {
      setRunning(true);
      const res = await api.runAllTests();
      setResults(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            مجموعه آزمون‌های خودکار معیارهای پذیرش سامانه (Acceptance Test Suite)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            اعتبارسنجی زنده قواعد حضور، مرخصی ساعتی، شیفت‌های چرخشی، موتور زادروز، تقویم شمسی و سطوح دسترسی
          </p>
        </div>

        <button
          onClick={runTests}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-[#102D3A] hover:bg-[#1A4456] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[#D9C28D] ${running ? 'animate-spin' : ''}`} />
          <span>{running ? 'در حال اجرای تست‌ها...' : 'اجرای مجدد آزمون‌های سامانه'}</span>
        </button>
      </div>

      {/* Summary Score Card */}
      {results && (
        <div
          className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            results.passedAll
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {results.passedAll
                  ? `تمامی ${toPersianDigits(results.totalTests)} معیار پذیرش معماری و کارکرد با موفقیت تایید شدند`
                  : 'برخی از تست‌ها نیازمند بررسی هستند'}
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                تعداد تست‌های پاس‌شده: {toPersianDigits(results.passedCount)} از {toPersianDigits(results.totalTests)} آزمون
              </p>
            </div>
          </div>

          <div className="text-xs font-bold px-3 py-1.5 bg-white rounded-lg shadow-xs border border-emerald-300/50">
            نرخ قبولی: {toPersianDigits(Math.round((results.passedCount / results.totalTests) * 100))}٪
          </div>
        </div>
      )}

      {/* Test List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {running && !results ? (
          <div className="py-12 text-center text-xs text-slate-400">در حال اجرای آزمون‌های سرور...</div>
        ) : (
          results?.results.map((test) => (
            <div
              key={test.testNumber}
              className="p-4 hover:bg-slate-50/60 transition-colors flex items-start justify-between gap-4 text-xs"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {test.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      معیار {toPersianDigits(test.testNumber)}: {test.title}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">{test.message}</p>
                </div>
              </div>

              <div className="shrink-0 text-left">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    test.passed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {test.passed ? 'قبول' : 'مردود'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
