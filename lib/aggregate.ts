import type { ParsedColumn } from "@/lib/excel-parser";

export type LikertOption = {
  score: number; // 1~5
  label: string; // 응답 원문에서 점수를 뺀 등급 텍스트 (예: "매우 만족")
  count: number;
  percentage: number; // validCount 기준 비율 (%), 소수 첫째자리
};

export type AggregatedQuestion = {
  title: string;
  validCount: number; // 무응답을 제외한 유효 응답자 수
  averageScore: number; // 소수 둘째자리
  options: LikertOption[]; // 점수 높은 순(5→1)으로 정렬
};

const LIKERT_ANSWER_PATTERN = /^([1-5])\s*점\s*[:：]\s*(.+)$/;

// 실제 응답이 없어 등급 텍스트를 알 수 없는 경우에 쓰는 통상적인 5점 척도 표현.
const STANDARD_LIKERT_LABELS: Record<number, string> = {
  5: "매우 만족",
  4: "만족",
  3: "보통",
  2: "불만족",
  1: "매우 불만족",
};

function parseLikertAnswer(value: string): { score: number; label: string } | null {
  const match = value.match(LIKERT_ANSWER_PATTERN);
  if (!match) return null;
  return { score: Number(match[1]), label: match[2].trim() };
}

// 응답자가 한 번도 선택하지 않은 등급도 결과보고서에 0명으로 항상 노출되도록,
// 1~5점을 모두 채운 뒤 점수 높은 순으로 정렬해서 돌려준다.
function fillMissingLikertLevels(
  options: { score: number; label: string; count: number }[],
): { score: number; label: string; count: number }[] {
  const byScore = new Map(options.map((option) => [option.score, option]));
  const filled: { score: number; label: string; count: number }[] = [];
  for (let score = 5; score >= 1; score -= 1) {
    filled.push(byScore.get(score) ?? { score, label: STANDARD_LIKERT_LABELS[score], count: 0 });
  }
  const extras = options.filter((option) => option.score < 1 || option.score > 5);
  return [...filled, ...extras];
}

export function aggregateObjectiveQuestion(column: ParsedColumn): AggregatedQuestion {
  const parsedAnswers = column.values
    .filter((value) => value !== "") // 무응답 제외
    .map(parseLikertAnswer)
    .filter((answer): answer is { score: number; label: string } => answer !== null);

  const validCount = parsedAnswers.length;

  const optionMap = new Map<string, { score: number; label: string; count: number }>();
  for (const { score, label } of parsedAnswers) {
    const key = `${score}:${label}`;
    const existing = optionMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      optionMap.set(key, { score, label, count: 1 });
    }
  }

  const options: LikertOption[] = fillMissingLikertLevels(Array.from(optionMap.values())).map(
    (option) => ({
      ...option,
      percentage: validCount === 0 ? 0 : Math.round((option.count / validCount) * 1000) / 10,
    }),
  );

  const scoreSum = parsedAnswers.reduce((sum, answer) => sum + answer.score, 0);
  const averageScore =
    validCount === 0 ? 0 : Math.round((scoreSum / validCount) * 100) / 100;

  return { title: column.title, validCount, averageScore, options };
}

export function aggregateObjectiveQuestions(
  columns: ParsedColumn[],
): AggregatedQuestion[] {
  return columns.map(aggregateObjectiveQuestion);
}

// 캡처 이미지 인식 결과처럼 등급별 응답수가 이미 집계된 형태로 들어올 때,
// 또는 담당자가 확인 화면에서 값을 수정했을 때 평균·비율을 다시 계산한다.
export function recomputeFromOptions(
  title: string,
  options: { score: number; label: string; count: number }[],
): AggregatedQuestion {
  const validCount = options.reduce((sum, option) => sum + option.count, 0);
  const scoreSum = options.reduce((sum, option) => sum + option.score * option.count, 0);

  const sortedOptions: LikertOption[] = fillMissingLikertLevels(options).map((option) => ({
    ...option,
    percentage: validCount === 0 ? 0 : Math.round((option.count / validCount) * 1000) / 10,
  }));

  return {
    title,
    validCount,
    averageScore: validCount === 0 ? 0 : Math.round((scoreSum / validCount) * 100) / 100,
    options: sortedOptions,
  };
}
