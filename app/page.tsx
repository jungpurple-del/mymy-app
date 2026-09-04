"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import ConfirmationScreen, {
  type AnalysisResult,
} from "@/components/ConfirmationScreen";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["xlsx", "jpg", "jpeg", "png"];

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export default function Home() {
  const [educationName, setEducationName] = useState("");
  const [educationDate, setEducationDate] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !fileInputRef.current) return;
    fileInputRef.current.files = event.dataTransfer.files;
    setSelectedFileName(file.name);
  }

  function handleClearFile(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedFileName("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      setErrorMessage("파일을 선택해주세요.");
      return;
    }

    const extension = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setErrorMessage("xlsx 또는 jpg, png 파일만 업로드할 수 있어요.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("파일 크기는 10MB를 넘을 수 없어요.");
      return;
    }

    const formData = new FormData();
    formData.append("educationName", educationName);
    formData.append("educationDate", educationDate);
    formData.append("file", file);

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message ?? "업로드 중 문제가 발생했어요.");
        return;
      }

      setAnalysis(data);
    } catch {
      setErrorMessage("업로드 중 문제가 발생했어요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            교육평가 결과보고서 자동생성기
          </h1>
          {!analysis && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              교육 정보를 입력하고, 응답 엑셀(.xlsx) 또는 캡처 이미지(.jpg,
              .png)를 업로드해주세요.
            </p>
          )}
        </div>

        {analysis ? (
          <ConfirmationScreen
            analysis={analysis}
            onReset={() => setAnalysis(null)}
          />
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="educationName"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              교육명
            </label>
            <input
              id="educationName"
              name="educationName"
              type="text"
              required
              value={educationName}
              onChange={(event) => setEducationName(event.target.value)}
              placeholder="예: CS리더교육과정"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="educationDate"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              교육일자
            </label>
            <input
              id="educationDate"
              name="educationDate"
              type="date"
              required
              value={educationDate}
              onChange={(event) => setEducationDate(event.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="file"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              응답 엑셀 또는 캡처 이미지
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDraggingOver
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-800"
                  : "border-zinc-300 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              }`}
            >
              <input
                ref={fileInputRef}
                id="file"
                name="file"
                type="file"
                required
                accept=".xlsx,.jpg,.jpeg,.png"
                onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}
                className="hidden"
              />
              {selectedFileName ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {selectedFileName}
                  </p>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    aria-label="선택한 파일 취소"
                    className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    여기로 파일을 끌어다 놓거나, 클릭해서 선택하세요
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    .xlsx, .jpg, .jpeg, .png (최대 10MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-300"
          >
            {isSubmitting ? "분석 중..." : "분석하기"}
          </button>
        </form>
        )}
      </main>
    </div>
  );
}
