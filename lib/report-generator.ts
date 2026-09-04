import ExcelJS from "exceljs";
import type { AggregatedQuestion } from "@/lib/aggregate";
import type { SubjectiveResult } from "@/lib/subjective";
import { injectPieCharts, type PieChartSpec } from "@/lib/chart-injector";

export type ReportInput = {
  educationName: string;
  educationDate: string;
  respondentCount: number;
  objectiveResults: AggregatedQuestion[];
  subjectiveResults: SubjectiveResult[];
  // 엑셀 업로드 경로에서만 존재 (원본 응답 시트 복원용). 이미지 업로드 경로는 원본 그리드가 없어 생략한다.
  rawHeaders?: string[];
  rawRows?: string[][];
};

const RAW_SHEET_NAME = "원본 응답";
const SUMMARY_SHEET_NAME = "01_교육평가 요약";
const SUBJECTIVE_SHEET_NAME = "02_주관식 의견";

const BANNER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3F3FA0" } };
const SUBTITLE_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAEAF7" } };
const TABLE_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

const BANNER_FONT: Partial<ExcelJS.Font> = {
  name: "맑은 고딕",
  bold: true,
  size: 20, // 맨 위 진한 배너("{교육명} 설문결과") 글자 — 1단 배치(3문항 이하) 기준 크기
  color: { argb: "FFFFFFFF" },
};
// 2단 배치는 폭이 2배로 넓어져 인쇄 시 더 축소되므로, 배너도 1단의 2배로 키워서 인쇄했을 때 비슷한 크기로 보이게 한다.
const PAIRED_BANNER_FONT: Partial<ExcelJS.Font> = { ...BANNER_FONT, size: 40 };
const SUBTITLE_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕", bold: true, size: 11 };
const QUESTION_TITLE_FONT: Partial<ExcelJS.Font> = {
  name: "맑은 고딕",
  bold: true,
  size: 17,
  color: { argb: "FF2E2E7A" },
};
// 2단 배치(4문항 이상) 전용 글자 크기 — 사용자가 직접 지정한 값
const PAIRED_QUESTION_TITLE_FONT: Partial<ExcelJS.Font> = { ...QUESTION_TITLE_FONT, size: 20 };
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕", bold: true };
const BODY_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕" };
// 2단 배치 표(구분/응답수/비율) 안 글자
const PAIRED_TABLE_HEADER_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕", bold: true, size: 20 };
const PAIRED_TABLE_BODY_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕", size: 20 };
// 2단 배치 원형 차트 안 퍼센트 숫자
const PAIRED_CHART_DATA_LABEL_SIZE = 18;
// 2단 배치 원형 차트 아래 범례 — 기존 8pt가 너무 작아서 2~2.5배로 (2~3줄로 줄바꿈되어도 됨)
const PAIRED_CHART_LEGEND_SIZE = 20;
// 2단 배치일 때 부제(교육일자·응답자수·범례)
const PAIRED_SUBTITLE_FONT: Partial<ExcelJS.Font> = { ...SUBTITLE_FONT, size: 22 };
// 2단 배치일 때 맨 위 평가항목 요약표(평가항목/평균/4~5점 비율)
const PAIRED_SUMMARY_TABLE_HEADER_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕", bold: true, size: 20 };
const PAIRED_SUMMARY_TABLE_BODY_FONT: Partial<ExcelJS.Font> = { name: "맑은 고딕", size: 20 };

const BORDER_STYLE = { style: "thin", color: { argb: "FFD0D0D0" } } as const; // 연한 회색 (너무 진하지 않게)
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: BORDER_STYLE,
  left: BORDER_STYLE,
  bottom: BORDER_STYLE,
  right: BORDER_STYLE,
};

const PERCENT_FORMAT = '0.0"%"';
const LEGEND_TEXT = "5점 매우 만족 · 4점 만족 · 3점 보통 · 2점 불만족 · 1점 매우 불만족";

const SOLO_CHART_HEIGHT_ROWS = 8; // 1단 배치(3문항 이하) 차트 박스 높이 — 차트 내부 레이아웃을 꽉 채우도록 손봐서 상자는 더 작아도 원은 더 크게 보인다
const PAIRED_CHART_HEIGHT_ROWS = 20; // 2단 배치(4문항 이상) 차트 높이 — 원이 크고 둥글게 보이도록 넉넉하게
const CHART_FROM_COL = 3; // 표 옆 3번째 열 (D, 빈 칸 없이 표 바로 옆)
const CHART_TO_COL = 9; // 차트 너비 — 표 옆 9번째 열(J)까지, 7칸
const SLOT_WIDTH = 10; // 문항 한 세트(표3칸+차트7칸)가 차지하는 열 수 — 2단 배치 시 다음 세트 시작 오프셋
const PAIR_THRESHOLD = 4; // 객관식 문항이 이 개수 이상이면 2개씩 나란히 배치 (빈 공간 없이 바로 옆에 붙여서)
// A4 기준으로 문항 세트(가로 2개) 4번째 줄부터는 범례 끝부분이 페이지 경계에 걸쳐 다음 페이지로
// 잘려 넘어가는 걸 실제로 확인해서, 3줄마다 강제로 페이지를 나눈다.
const PAIRED_ROW_GROUPS_PER_PAGE = 3;

// 응답은 있지만 사실상 "없음"에 가까운 형식적인 답변은 결과보고서 주관식 목록에서 제외한다.
const MEANINGLESS_RESPONSE_WORDS = new Set([
  "없음", "없어요", "없습니다", "없다", "무", "x", "해당없음", "해당 없음",
]);
const PUNCTUATION_ONLY_PATTERN = /^[.,ㆍ·\-ㅡ~!?\s]+$/;

function isMeaninglessResponse(response: string): boolean {
  const trimmed = response.trim();
  if (trimmed === "") return true;
  if (PUNCTUATION_ONLY_PATTERN.test(trimmed)) return true;
  return MEANINGLESS_RESPONSE_WORDS.has(trimmed.toLowerCase());
}

function colLetter(index0: number): string {
  return String.fromCharCode(65 + index0);
}

// 점수별 파이 차트 조각 색상 — 엑셀 기본 테마색 대신 산뜻한 색으로 고정
const SCORE_COLORS: Record<number, string> = {
  5: "4C6EF5", // 파랑
  4: "22B8CF", // 청록
  3: "FFD43B", // 노랑
  2: "FF922B", // 주황
  1: "FA5252", // 빨강
};

// 인쇄 시 세로 방향(A4), 가로 한 페이지에 맞추기 (세로 페이지 수는 제한하지 않음)
const PRINT_PAGE_SETUP: Partial<ExcelJS.PageSetup> = {
  orientation: "portrait",
  paperSize: 9, // A4 — 페이지 나눔 위치를 예측 가능하게 고정
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
};

function highSatisfactionRate(question: AggregatedQuestion): number {
  const highCount = question.options
    .filter((option) => option.score >= 4)
    .reduce((sum, option) => sum + option.count, 0);
  return question.validCount === 0 ? 0 : Math.round((highCount / question.validCount) * 1000) / 10;
}

function applyBorder(sheet: ExcelJS.Worksheet, rowFrom: number, rowTo: number, colFrom: string, colTo: string) {
  for (let row = rowFrom; row <= rowTo; row += 1) {
    for (const col of columnRange(colFrom, colTo)) {
      sheet.getCell(`${col}${row}`).border = THIN_BORDER;
    }
  }
}

function columnRange(from: string, to: string): string[] {
  const fromCode = from.charCodeAt(0);
  const toCode = to.charCodeAt(0);
  const cols: string[] = [];
  for (let code = fromCode; code <= toCode; code += 1) {
    cols.push(String.fromCharCode(code));
  }
  return cols;
}

function buildRawSheet(workbook: ExcelJS.Workbook, input: ReportInput) {
  if (!input.rawHeaders || !input.rawRows) return; // 이미지 업로드 경로: 원본 그리드 없음

  const sheet = workbook.addWorksheet(RAW_SHEET_NAME);
  const headerRow = sheet.addRow(input.rawHeaders);
  headerRow.eachCell((cell) => {
    cell.font = HEADER_FONT;
  });
  input.rawRows.forEach((row) => {
    const addedRow = sheet.addRow(row);
    addedRow.eachCell((cell) => {
      cell.font = BODY_FONT;
    });
  });
  input.rawHeaders.forEach((_, index) => {
    sheet.getColumn(index + 1).width = 22;
  });
}

// 객관식 문항 한 개의 표+차트 블록을 그리고, 차트 스펙과 블록이 끝난 행을 돌려준다.
// colOffset을 SLOT_WIDTH(10)만큼 옮기면 같은 행에 두 번째 문항을 빈 칸 없이 바로 옆에 그릴 수 있다.
function renderQuestionBlock(
  sheet: ExcelJS.Worksheet,
  question: AggregatedQuestion,
  questionNumber: number,
  startRow: number,
  colOffset: number,
  chartHeightRows: number,
  titleFont: Partial<ExcelJS.Font>,
  headerFont: Partial<ExcelJS.Font>,
  bodyFont: Partial<ExcelJS.Font>,
  chartDataLabelFontSize: number | undefined,
  chartLegendFontSize: number | undefined,
): { chartSpec: PieChartSpec | null; bottomRow: number } {
  const labelCol = colLetter(colOffset);
  const countCol = colLetter(colOffset + 1);
  const percentCol = colLetter(colOffset + 2);
  let cursor = startRow;

  const titleRow = cursor;
  const titleEndCol = colLetter(colOffset + SLOT_WIDTH - 1);
  sheet.mergeCells(`${labelCol}${titleRow}:${titleEndCol}${titleRow}`); // 제목이 커도 옆 문항 칸과 겹치지 않도록 슬롯 전체 폭으로 병합
  sheet.getCell(`${labelCol}${titleRow}`).value =
    `${questionNumber}. ${question.title}  ·  평균 ${question.averageScore}점`;
  sheet.getCell(`${labelCol}${titleRow}`).font = titleFont;
  sheet.getCell(`${labelCol}${titleRow}`).alignment = { vertical: "middle" };
  sheet.getRow(titleRow).height = (titleFont.size ?? 17) * 1.4;
  cursor += 1;

  sheet.getCell(`${labelCol}${cursor}`).value = `유효 응답 ${question.validCount}명`;
  sheet.getCell(`${labelCol}${cursor}`).font = bodyFont;
  cursor += 1;

  const headerRow = cursor;
  sheet.getCell(`${labelCol}${headerRow}`).value = "구분";
  sheet.getCell(`${countCol}${headerRow}`).value = "응답 수";
  sheet.getCell(`${percentCol}${headerRow}`).value = "비율";
  [labelCol, countCol, percentCol].forEach((col) => {
    const cell = sheet.getCell(`${col}${headerRow}`);
    cell.font = headerFont;
    cell.fill = TABLE_HEADER_FILL;
    cell.alignment = { horizontal: "center" };
  });
  cursor += 1;

  const dataStartRow = cursor;
  question.options.forEach((option) => {
    sheet.getCell(`${labelCol}${cursor}`).value = `${option.score}점: ${option.label}`;
    sheet.getCell(`${labelCol}${cursor}`).font = bodyFont;
    const countCell = sheet.getCell(`${countCol}${cursor}`);
    countCell.value = option.count;
    countCell.font = bodyFont;
    countCell.alignment = { horizontal: "center" };
    const percentCell = sheet.getCell(`${percentCol}${cursor}`);
    percentCell.value = option.percentage;
    percentCell.numFmt = PERCENT_FORMAT;
    percentCell.font = bodyFont;
    percentCell.alignment = { horizontal: "center" };
    cursor += 1;
  });
  const dataEndRow = cursor - 1;
  applyBorder(sheet, headerRow, dataEndRow, labelCol, percentCol);

  const chartFromRow0 = headerRow - 1; // 0-based
  const chartToRow0 = chartFromRow0 + chartHeightRows;

  let chartSpec: PieChartSpec | null = null;
  if (question.options.length > 0) {
    chartSpec = {
      title: question.title,
      categoriesFormula: `'${SUMMARY_SHEET_NAME}'!$${labelCol}$${dataStartRow}:$${labelCol}$${dataEndRow}`,
      categories: question.options.map((option) => `${option.score}점: ${option.label}`),
      valuesFormula: `'${SUMMARY_SHEET_NAME}'!$${countCol}$${dataStartRow}:$${countCol}$${dataEndRow}`,
      values: question.options.map((option) => option.count),
      anchor: {
        fromCol: colOffset + CHART_FROM_COL,
        fromRow: chartFromRow0,
        toCol: colOffset + CHART_TO_COL,
        toRow: chartToRow0,
      },
      colors: question.options.map((option) => SCORE_COLORS[option.score] ?? "ADB5BD"),
      dataLabelFontSize: chartDataLabelFontSize,
      legendFontSize: chartLegendFontSize,
    };
  }

  return { chartSpec, bottomRow: Math.max(dataEndRow, chartToRow0) };
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  input: ReportInput,
): PieChartSpec[] {
  const sheet = workbook.addWorksheet(SUMMARY_SHEET_NAME);
  sheet.pageSetup = { ...sheet.pageSetup, ...PRINT_PAGE_SETUP };
  const chartSpecs: PieChartSpec[] = [];

  const usePairing = input.objectiveResults.length >= PAIR_THRESHOLD;
  const summarySpanEndColumn = colLetter((usePairing ? SLOT_WIDTH : 0) + CHART_TO_COL);
  const chartHeightRows = usePairing ? PAIRED_CHART_HEIGHT_ROWS : SOLO_CHART_HEIGHT_ROWS;
  const blockTitleFont = usePairing ? PAIRED_QUESTION_TITLE_FONT : QUESTION_TITLE_FONT;
  const blockHeaderFont = usePairing ? PAIRED_TABLE_HEADER_FONT : HEADER_FONT;
  const blockBodyFont = usePairing ? PAIRED_TABLE_BODY_FONT : BODY_FONT;
  const subtitleFont = usePairing ? PAIRED_SUBTITLE_FONT : SUBTITLE_FONT;
  const summaryTableHeaderFont = usePairing ? PAIRED_SUMMARY_TABLE_HEADER_FONT : HEADER_FONT;
  const summaryTableBodyFont = usePairing ? PAIRED_SUMMARY_TABLE_BODY_FONT : BODY_FONT;
  const bannerFont = usePairing ? PAIRED_BANNER_FONT : BANNER_FONT;
  const chartDataLabelFontSize = usePairing ? PAIRED_CHART_DATA_LABEL_SIZE : undefined;
  const chartLegendFontSize = usePairing ? PAIRED_CHART_LEGEND_SIZE : undefined;

  // 제목 배너: "{교육명} 설문결과"
  sheet.mergeCells(`A1:${summarySpanEndColumn}1`);
  const bannerCell = sheet.getCell("A1");
  bannerCell.value = `${input.educationName} 설문결과`;
  bannerCell.font = bannerFont;
  bannerCell.fill = BANNER_FILL;
  bannerCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = (bannerFont.size ?? 20) * 1.4;

  // 부제: 교육일자 · 응답자 수 · 등급 범례
  sheet.mergeCells(`A2:${summarySpanEndColumn}2`);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = `교육일자 ${input.educationDate}  |  응답 ${input.respondentCount}명  |  ${LEGEND_TEXT}`;
  subtitleCell.font = subtitleFont;
  subtitleCell.fill = SUBTITLE_FILL;
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(2).height = (subtitleFont.size ?? 11) * 1.6;

  let cursor = 4;

  // 문항별 평균·4~5점 비율 요약표
  if (input.objectiveResults.length > 0) {
    const summaryHeaderRow = cursor;
    sheet.getCell(`A${summaryHeaderRow}`).value = "평가항목";
    sheet.getCell(`B${summaryHeaderRow}`).value = "평균";
    sheet.getCell(`C${summaryHeaderRow}`).value = "4~5점 비율";
    ["A", "B", "C"].forEach((col) => {
      const cell = sheet.getCell(`${col}${summaryHeaderRow}`);
      cell.font = summaryTableHeaderFont;
      cell.fill = TABLE_HEADER_FILL;
      cell.alignment = { horizontal: "center" };
    });
    sheet.getRow(summaryHeaderRow).height = (summaryTableHeaderFont.size ?? 11) * 1.6;
    cursor += 1;

    input.objectiveResults.forEach((question) => {
      sheet.getCell(`A${cursor}`).value = question.title;
      sheet.getCell(`A${cursor}`).font = summaryTableBodyFont;
      sheet.getCell(`B${cursor}`).value = question.averageScore;
      sheet.getCell(`B${cursor}`).font = summaryTableBodyFont;
      sheet.getCell(`B${cursor}`).alignment = { horizontal: "center" };
      const rateCell = sheet.getCell(`C${cursor}`);
      rateCell.value = highSatisfactionRate(question);
      rateCell.numFmt = PERCENT_FORMAT;
      rateCell.font = summaryTableBodyFont;
      rateCell.alignment = { horizontal: "center" };
      sheet.getRow(cursor).height = (summaryTableBodyFont.size ?? 11) * 1.6;
      cursor += 1;
    });

    applyBorder(sheet, summaryHeaderRow, cursor - 1, "A", "C");
    cursor += 2;
  }

  const pairSize = usePairing ? 2 : 1;
  let rowGroupCount = 0;
  for (let i = 0; i < input.objectiveResults.length; i += pairSize) {
    const rowStart = cursor;
    const first = renderQuestionBlock(
      sheet,
      input.objectiveResults[i],
      i + 1,
      rowStart,
      0,
      chartHeightRows,
      blockTitleFont,
      blockHeaderFont,
      blockBodyFont,
      chartDataLabelFontSize,
      chartLegendFontSize,
    );
    if (first.chartSpec) chartSpecs.push(first.chartSpec);
    let bottomRow = first.bottomRow;

    if (usePairing && i + 1 < input.objectiveResults.length) {
      const second = renderQuestionBlock(
        sheet,
        input.objectiveResults[i + 1],
        i + 2,
        rowStart,
        SLOT_WIDTH,
        chartHeightRows,
        blockTitleFont,
        blockHeaderFont,
        blockBodyFont,
        chartDataLabelFontSize,
        chartLegendFontSize,
      );
      if (second.chartSpec) chartSpecs.push(second.chartSpec);
      bottomRow = Math.max(bottomRow, second.bottomRow);
    }

    rowGroupCount += 1;
    // 2단 배치는 문항 세트가 너무 많으면 마지막 줄의 범례가 페이지 경계에 걸려 다음 페이지로
    // 잘려 넘어갈 수 있어, 일정 개수(PAIRED_ROW_GROUPS_PER_PAGE)마다 강제로 페이지를 나눈다.
    if (usePairing && rowGroupCount % PAIRED_ROW_GROUPS_PER_PAGE === 0 && i + pairSize < input.objectiveResults.length) {
      sheet.getRow(bottomRow).addPageBreak();
    }

    cursor = bottomRow + 2;
  }

  // 2단 배치는 표 글자가 20pt로 커서 "5점: 매우 불만족" 같은 긴 라벨이 잘리지 않도록 A/B/C열을 더 넓힌다.
  const colAWidth = usePairing ? 28 : 20;
  const colBWidth = usePairing ? 14 : 10;
  const colCWidth = usePairing ? 22 : 12;
  sheet.getColumn(1).width = colAWidth;
  sheet.getColumn(2).width = colBWidth;
  sheet.getColumn(3).width = colCWidth;
  if (usePairing) {
    sheet.getColumn(SLOT_WIDTH + 1).width = colAWidth;
    sheet.getColumn(SLOT_WIDTH + 2).width = colBWidth;
    sheet.getColumn(SLOT_WIDTH + 3).width = colCWidth;
  }

  return chartSpecs;
}

function buildSubjectiveSheet(workbook: ExcelJS.Workbook, input: ReportInput) {
  const sheet = workbook.addWorksheet(SUBJECTIVE_SHEET_NAME);
  sheet.pageSetup = { ...sheet.pageSetup, ...PRINT_PAGE_SETUP };

  // 인쇄 시 한 페이지에 맞추기 쉽도록 A열만 사용한다 (다른 열로 병합하지 않음).
  const bannerCell = sheet.getCell("A1");
  bannerCell.value = `${input.educationName} 주관식 응답`;
  bannerCell.font = BANNER_FONT;
  bannerCell.fill = BANNER_FILL;
  bannerCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = (BANNER_FONT.size ?? 20) * 1.4;

  let cursor = 3;

  input.subjectiveResults.forEach((question: SubjectiveResult, questionIndex) => {
    sheet.getCell(`A${cursor}`).value = `문항 ${questionIndex + 1}. ${question.title}`;
    sheet.getCell(`A${cursor}`).font = QUESTION_TITLE_FONT;
    cursor += 1;

    const meaningfulResponses = question.responses.filter((response) => !isMeaninglessResponse(response));

    if (meaningfulResponses.length === 0) {
      sheet.getCell(`A${cursor}`).value = "(응답 없음)";
      sheet.getCell(`A${cursor}`).font = BODY_FONT;
      cursor += 1;
    } else {
      meaningfulResponses.forEach((response, responseIndex) => {
        const cell = sheet.getCell(`A${cursor}`);
        cell.value = `${responseIndex + 1}. ${response}`;
        cell.font = BODY_FONT;
        cell.alignment = { wrapText: true, vertical: "top" };
        cursor += 1;
      });
    }
    cursor += 1;
  });

  sheet.getColumn(1).width = 100;
}

export async function generateReportBuffer(input: ReportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "교육평가 결과보고서 자동생성기";

  buildRawSheet(workbook, input);
  const chartSpecs = buildSummarySheet(workbook, input);
  buildSubjectiveSheet(workbook, input);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return injectPieCharts(buffer, SUMMARY_SHEET_NAME, chartSpecs);
}
