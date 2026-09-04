import type { ParsedColumn } from "@/lib/excel-parser";

export type SubjectiveResult = {
  title: string;
  responses: string[]; // 무응답을 제외한 원문 그대로, 응답 순서 유지
};

export function summarizeSubjectiveQuestion(column: ParsedColumn): SubjectiveResult {
  return {
    title: column.title,
    responses: column.values.filter((value) => value !== ""),
  };
}

export function summarizeSubjectiveQuestions(
  columns: ParsedColumn[],
): SubjectiveResult[] {
  return columns.map(summarizeSubjectiveQuestion);
}
