import ExcelJS from "exceljs";

export type ParsedColumn = {
  title: string;
  values: string[]; // 응답자 순서대로. 무응답은 빈 문자열("")
};

export type ParsedExcel = {
  respondentCount: number;
  objectiveQuestions: ParsedColumn[];
  subjectiveQuestions: ParsedColumn[];
  rawHeaders: string[]; // 결과보고서의 "원본 응답" 시트 복원용, 타임스탬프 포함 원본 열 순서 그대로
  rawRows: string[][];
};

const TIMESTAMP_HEADERS = ["타임스탬프", "timestamp"];
// Google Forms 5점 척도 응답의 실제 형식: "5점: 매우 만족" 처럼 "N점" 뒤에 등급 텍스트가 붙는다.
const LIKERT_PATTERN = /^[1-5]\s*점\s*[:：]/;

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value) {
      return cellToText(value.result as ExcelJS.CellValue);
    }
  }
  return String(value).trim();
}

function isObjectiveColumn(values: string[]): boolean {
  const answered = values.filter((value) => value !== "");
  if (answered.length === 0) return false; // 응답이 하나도 없으면 주관식으로 취급 (안전한 기본값)
  return answered.every((value) => LIKERT_PATTERN.test(value));
}

export async function parseExcelFile(
  file: ArrayBuffer | Buffer,
): Promise<ParsedExcel> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file as ArrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("엑셀 파일에서 시트를 찾을 수 없어요.");
  }

  const headerRow = worksheet.getRow(1);
  const columnCount = worksheet.actualColumnCount;

  const headers: string[] = [];
  for (let col = 1; col <= columnCount; col += 1) {
    headers.push(cellToText(headerRow.getCell(col).value));
  }

  const totalRows = worksheet.actualRowCount;
  const dataRowIndexes: number[] = [];
  for (let row = 2; row <= totalRows; row += 1) {
    const rowValues = worksheet.getRow(row);
    const hasAnyValue = headers.some(
      (_, colIndex) => cellToText(rowValues.getCell(colIndex + 1).value) !== "",
    );
    if (hasAnyValue) dataRowIndexes.push(row);
  }

  const objectiveQuestions: ParsedColumn[] = [];
  const subjectiveQuestions: ParsedColumn[] = [];

  headers.forEach((title, index) => {
    const col = index + 1;
    if (TIMESTAMP_HEADERS.includes(title.toLowerCase())) return; // 타임스탬프 열은 문항이 아니므로 제외

    const values = dataRowIndexes.map((row) =>
      cellToText(worksheet.getRow(row).getCell(col).value),
    );

    const column: ParsedColumn = { title, values };
    if (isObjectiveColumn(values)) {
      objectiveQuestions.push(column);
    } else {
      subjectiveQuestions.push(column);
    }
  });

  const rawRows = dataRowIndexes.map((row) =>
    headers.map((_, index) => cellToText(worksheet.getRow(row).getCell(index + 1).value)),
  );

  return {
    respondentCount: dataRowIndexes.length,
    objectiveQuestions,
    subjectiveQuestions,
    rawHeaders: headers,
    rawRows,
  };
}
