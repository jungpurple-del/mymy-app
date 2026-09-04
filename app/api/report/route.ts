import { generateReportBuffer } from "@/lib/report-generator";
import type { AggregatedQuestion } from "@/lib/aggregate";
import type { SubjectiveResult } from "@/lib/subjective";

type ReportRequestBody = {
  educationName?: unknown;
  educationDate?: unknown;
  respondentCount?: unknown;
  objectiveResults?: unknown;
  subjectiveResults?: unknown;
  rawHeaders?: unknown;
  rawRows?: unknown;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRawRows(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => isStringArray(row));
}

function isAggregatedQuestions(value: unknown): value is AggregatedQuestion[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as AggregatedQuestion).title === "string" &&
        typeof (item as AggregatedQuestion).validCount === "number" &&
        typeof (item as AggregatedQuestion).averageScore === "number" &&
        Array.isArray((item as AggregatedQuestion).options),
    )
  );
}

function isSubjectiveResults(value: unknown): value is SubjectiveResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as SubjectiveResult).title === "string" &&
        isStringArray((item as SubjectiveResult).responses),
    )
  );
}

// 파일 이름에 쓸 수 없는 문자를 제거해 안전한 다운로드 파일명을 만든다.
function sanitizeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "").trim();
}

export async function POST(request: Request) {
  const body = (await request.json()) as ReportRequestBody;
  const {
    educationName,
    educationDate,
    respondentCount,
    objectiveResults,
    subjectiveResults,
    rawHeaders,
    rawRows,
  } = body;

  if (typeof educationName !== "string" || educationName.trim() === "") {
    return Response.json({ message: "교육명이 없어요." }, { status: 400 });
  }
  if (typeof educationDate !== "string" || educationDate.trim() === "") {
    return Response.json({ message: "교육일자가 없어요." }, { status: 400 });
  }
  if (typeof respondentCount !== "number") {
    return Response.json({ message: "응답자 수가 없어요." }, { status: 400 });
  }
  if (!isAggregatedQuestions(objectiveResults)) {
    return Response.json({ message: "객관식 집계 결과가 올바르지 않아요." }, { status: 400 });
  }
  if (!isSubjectiveResults(subjectiveResults)) {
    return Response.json({ message: "주관식 응답 결과가 올바르지 않아요." }, { status: 400 });
  }
  // 엑셀 업로드 경로에서만 원본 그리드가 함께 온다. 이미지 업로드 경로는 둘 다 없을 수 있다.
  const hasRawGrid = rawHeaders !== undefined || rawRows !== undefined;
  if (hasRawGrid && (!isStringArray(rawHeaders) || !isRawRows(rawRows))) {
    return Response.json({ message: "원본 응답 데이터가 올바르지 않아요." }, { status: 400 });
  }

  // 요청 처리에 필요한 데이터는 이 함수 호출 동안만 메모리에 존재하며, 디스크에 저장하지 않는다.
  const buffer = await generateReportBuffer({
    educationName,
    educationDate,
    respondentCount,
    objectiveResults,
    subjectiveResults,
    rawHeaders: hasRawGrid ? (rawHeaders as string[]) : undefined,
    rawRows: hasRawGrid ? (rawRows as string[][]) : undefined,
  });

  const fileName = `${sanitizeFileNamePart(educationName)}_${sanitizeFileNamePart(educationDate)}_결과보고서.xlsx`;
  const encodedFileName = encodeURIComponent(fileName);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encodedFileName}`,
    },
  });
}
