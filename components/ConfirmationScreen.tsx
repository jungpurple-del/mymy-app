import { useState } from "react";
import { recomputeFromOptions, type AggregatedQuestion } from "@/lib/aggregate";
import type { SubjectiveResult } from "@/lib/subjective";

export type AnalysisResult = {
  fileName: string;
  fileKind: "excel" | "image";
  educationName?: string;
  educationDate?: string;
  respondentCount?: number;
  objectiveResults?: AggregatedQuestion[];
  subjectiveResults?: SubjectiveResult[];
  rawHeaders?: string[];
  rawRows?: string[][];
};

type SubjectiveDraft = { title: string; responsesText: string };

type ConfirmationScreenProps = {
  analysis: AnalysisResult;
  onReset: () => void;
};

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export default function ConfirmationScreen({
  analysis,
  onReset,
}: ConfirmationScreenProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const isImage = analysis.fileKind === "image";
  const hasResults =
    analysis.respondentCount !== undefined &&
    analysis.objectiveResults !== undefined &&
    analysis.subjectiveResults !== undefined;

  const [respondentCount, setRespondentCount] = useState(analysis.respondentCount ?? 0);
  const [objectiveDraft, setObjectiveDraft] = useState<AggregatedQuestion[]>(
    analysis.objectiveResults ?? [],
  );
  const [subjectiveDraft, setSubjectiveDraft] = useState<SubjectiveDraft[]>(
    (analysis.subjectiveResults ?? []).map((question) => ({
      title: question.title,
      responsesText: question.responses.join("\n"),
    })),
  );

  function updateObjectiveTitle(questionIndex: number, title: string) {
    setObjectiveDraft((prev) =>
      prev.map((question, index) => (index === questionIndex ? { ...question, title } : question)),
    );
  }

  function updateOptionField(
    questionIndex: number,
    optionIndex: number,
    field: "label" | "count",
    value: string,
  ) {
    setObjectiveDraft((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        const rawOptions = question.options.map((option, oIndex) => ({
          score: option.score,
          label: oIndex === optionIndex && field === "label" ? value : option.label,
          count:
            oIndex === optionIndex && field === "count"
              ? Math.max(0, Number(value) || 0)
              : option.count,
        }));
        return recomputeFromOptions(question.title, rawOptions);
      }),
    );
  }

  function updateSubjectiveTitle(questionIndex: number, title: string) {
    setSubjectiveDraft((prev) =>
      prev.map((question, index) => (index === questionIndex ? { ...question, title } : question)),
    );
  }

  function updateSubjectiveResponses(questionIndex: number, responsesText: string) {
    setSubjectiveDraft((prev) =>
      prev.map((question, index) =>
        index === questionIndex ? { ...question, responsesText } : question,
      ),
    );
  }

  async function handleGenerateReport() {
    setGenerateError("");
    setIsGenerating(true);
    try {
      const finalSubjectiveResults: SubjectiveResult[] = subjectiveDraft.map((question) => ({
        title: question.title,
        responses: question.responsesText
          .split("\n")
          .map((response) => response.trim())
          .filter((response) => response !== ""),
      }));

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          educationName: analysis.educationName,
          educationDate: analysis.educationDate,
          respondentCount,
          objectiveResults: objectiveDraft,
          subjectiveResults: finalSubjectiveResults,
          rawHeaders: analysis.rawHeaders,
          rawRows: analysis.rawRows,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setGenerateError(data?.message ?? "결과보고서 생성 중 문제가 발생했어요.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
      const downloadName = fileNameMatch
        ? decodeURIComponent(fileNameMatch[1])
        : `${analysis.educationName ?? "결과보고서"}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setGenerateError("결과보고서 생성 중 문제가 발생했어요.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          인식 결과 확인
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {analysis.fileName} ({analysis.fileKind === "excel" ? "엑셀" : "이미지"})
        </p>
      </div>

      {!hasResults && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200">
          인식 결과를 불러오지 못했어요. 다시 업로드해주세요.
        </div>
      )}

      {hasResults && (
        <>
          {isImage && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              AI가 이미지에서 인식한 값이에요. 정확한지 확인하고, 틀린 부분이 있으면 아래에서 직접 수정한 뒤 결과보고서를 생성해주세요.
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
            응답자 수:{" "}
            {isImage ? (
              <input
                type="number"
                min={0}
                value={respondentCount}
                onChange={(event) => setRespondentCount(Math.max(0, Number(event.target.value) || 0))}
                className={`${inputClass} w-24`}
              />
            ) : (
              <span className="font-medium">{respondentCount}</span>
            )}
            명
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              객관식 문항 ({objectiveDraft.length}개)
            </h3>
            <ul className="flex flex-col gap-2">
              {objectiveDraft.map((question, questionIndex) => (
                <li
                  key={questionIndex}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {isImage ? (
                    <input
                      type="text"
                      value={question.title}
                      onChange={(event) => updateObjectiveTitle(questionIndex, event.target.value)}
                      className={`${inputClass} w-full font-medium`}
                    />
                  ) : (
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{question.title}</p>
                  )}

                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    유효 응답 {question.validCount}명 · 평균 {question.averageScore}점
                  </p>

                  {isImage ? (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={option.label}
                            onChange={(event) =>
                              updateOptionField(questionIndex, optionIndex, "label", event.target.value)
                            }
                            className={`${inputClass} w-28`}
                          />
                          <input
                            type="number"
                            min={0}
                            value={option.count}
                            onChange={(event) =>
                              updateOptionField(questionIndex, optionIndex, "count", event.target.value)
                            }
                            className={`${inputClass} w-20`}
                          />
                          <span className="text-xs text-zinc-500 dark:text-zinc-500">
                            명 ({option.percentage}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      {question.options
                        .map((option) => `${option.label} ${option.count}명(${option.percentage}%)`)
                        .join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              주관식 문항 ({subjectiveDraft.length}개)
            </h3>
            <ul className="flex flex-col gap-2">
              {subjectiveDraft.map((question, questionIndex) => (
                <li
                  key={questionIndex}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {isImage ? (
                    <>
                      <input
                        type="text"
                        value={question.title}
                        onChange={(event) => updateSubjectiveTitle(questionIndex, event.target.value)}
                        className={`${inputClass} w-full font-medium`}
                      />
                      <p className="mt-1 mb-1 text-xs text-zinc-500 dark:text-zinc-500">
                        응답 한 줄에 하나씩 입력하세요.
                      </p>
                      <textarea
                        value={question.responsesText}
                        onChange={(event) =>
                          updateSubjectiveResponses(questionIndex, event.target.value)
                        }
                        rows={4}
                        className={`${inputClass} w-full`}
                      />
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{question.title}</p>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                        응답{" "}
                        {
                          question.responsesText.split("\n").filter((r) => r.trim() !== "").length
                        }
                        건
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {generateError && (
        <p className="text-sm text-red-600 dark:text-red-400">{generateError}</p>
      )}

      <div className="flex gap-3">
        {hasResults && (
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            {isGenerating ? "결과보고서 생성 중..." : "결과보고서 생성"}
          </button>
        )}

        <button
          type="button"
          onClick={onReset}
          className="self-start rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          다시 업로드
        </button>
      </div>
    </div>
  );
}
