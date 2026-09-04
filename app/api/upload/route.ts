import { parseExcelFile } from "@/lib/excel-parser";
import { aggregateObjectiveQuestions } from "@/lib/aggregate";
import { summarizeSubjectiveQuestions } from "@/lib/subjective";
import { parseImageWithVision } from "@/lib/vision-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const EXCEL_EXTENSIONS = ["xlsx"];
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const educationName = formData.get("educationName");
  const educationDate = formData.get("educationDate");
  const file = formData.get("file");

  if (typeof educationName !== "string" || educationName.trim() === "") {
    return Response.json({ message: "교육명을 입력해주세요." }, { status: 400 });
  }

  if (typeof educationDate !== "string" || educationDate.trim() === "") {
    return Response.json({ message: "교육일자를 입력해주세요." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ message: "파일을 선택해주세요." }, { status: 400 });
  }

  const extension = getExtension(file.name);
  const fileKind = EXCEL_EXTENSIONS.includes(extension)
    ? "excel"
    : IMAGE_EXTENSIONS.includes(extension)
      ? "image"
      : null;

  if (!fileKind) {
    return Response.json(
      { message: "xlsx 또는 jpg, png 파일만 업로드할 수 있어요." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { message: "파일 크기는 10MB를 넘을 수 없어요." },
      { status: 400 },
    );
  }

  // 업로드된 파일은 디스크에 저장하지 않고, 이 요청 처리가 끝나면 메모리에서도 사라진다.
  if (fileKind === "excel") {
    try {
      const parsed = await parseExcelFile(await file.arrayBuffer());
      const objectiveResults = aggregateObjectiveQuestions(parsed.objectiveQuestions);
      const subjectiveResults = summarizeSubjectiveQuestions(parsed.subjectiveQuestions);
      return Response.json({
        fileName: file.name,
        fileKind,
        educationName,
        educationDate,
        respondentCount: parsed.respondentCount,
        objectiveResults,
        subjectiveResults,
        rawHeaders: parsed.rawHeaders,
        rawRows: parsed.rawRows,
      });
    } catch {
      return Response.json(
        { message: "엑셀 파일을 읽을 수 없어요. 손상되지 않았는지 확인해주세요." },
        { status: 400 },
      );
    }
  }

  // 이미지는 디스크에 저장하지 않고, base64로 변환해 OpenAI Vision에 전달한 뒤
  // 이 요청 처리가 끝나면 메모리에서도 사라진다. AI가 읽은 값은 서버에서 확정하지 않고
  // 화면에서 담당자가 확인·수정한 뒤에만 결과보고서 생성에 사용한다.
  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = extension === "png" ? "image/png" : "image/jpeg";
    const parsed = await parseImageWithVision(base64Image, mimeType);
    return Response.json({
      fileName: file.name,
      fileKind,
      educationName,
      educationDate,
      respondentCount: parsed.respondentCount,
      objectiveResults: parsed.objectiveResults,
      subjectiveResults: parsed.subjectiveResults,
    });
  } catch {
    return Response.json(
      { message: "이미지에서 문항·응답을 인식하지 못했어요. 이미지를 다시 확인해주세요." },
      { status: 400 },
    );
  }
}
