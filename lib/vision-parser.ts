import { recomputeFromOptions, type AggregatedQuestion } from "@/lib/aggregate";
import type { SubjectiveResult } from "@/lib/subjective";

export type VisionParsedResult = {
  respondentCount: number;
  objectiveResults: AggregatedQuestion[];
  subjectiveResults: SubjectiveResult[];
};

type VisionRawOption = { score: number; label: string; count: number };
type VisionRawObjectiveQuestion = { title: string; options: VisionRawOption[] };
type VisionRawSubjectiveQuestion = { title: string; responses: string[] };
type VisionRawResult = {
  respondentCount: number;
  objectiveQuestions: VisionRawObjectiveQuestion[];
  subjectiveQuestions: VisionRawSubjectiveQuestion[];
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    respondentCount: { type: "integer" },
    objectiveQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                score: { type: "integer" },
                label: { type: "string" },
                count: { type: "integer" },
              },
              required: ["score", "label", "count"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "options"],
        additionalProperties: false,
      },
    },
    subjectiveQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          responses: { type: "array", items: { type: "string" } },
        },
        required: ["title", "responses"],
        additionalProperties: false,
      },
    },
  },
  required: ["respondentCount", "objectiveQuestions", "subjectiveQuestions"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT =
  "너는 교육평가 설문 시스템 화면을 캡처한 이미지를 보고 문항과 응답 결과를 정확히 읽어내는 도우미야. " +
  "이미지에 실제로 보이는 글자와 숫자만 그대로 옮겨 적고, 보이지 않는 내용은 추측하거나 지어내지 마.";

const USER_PROMPT =
  "이 이미지는 교육평가 설문 결과 화면이야. 다음을 읽어서 구조화해줘.\n" +
  "1. 전체 응답자 수 (화면에 '총응답자수'처럼 표시된 값).\n" +
  "2. 객관식 문항: 문항 제목과, 실제 점수가 있는 등급별 응답수만 넣어줘 " +
  "(예: 매우만족/만족/보통/미흡·불만족/매우미흡·매우불만족). " +
  "등급이 '5점: 매우 만족'처럼 점수와 텍스트가 함께 있으면 score(점수)와 label(등급 텍스트)을 분리해줘. " +
  "점수를 알 수 없으면 score는 0으로 넣어줘. " +
  "'무응답'/'미응답' 열은 점수를 매길 수 없는 별도 항목이니 options 목록에 절대 포함하지 마 " +
  "(무응답 수는 응답자 수 계산에서 자동으로 제외되니 따로 다룰 필요 없어).\n" +
  "3. 주관식 문항: 문항 제목과 응답 원문 목록을 이미지에 보이는 그대로 나열해줘 (요약하거나 고쳐 쓰지 마). " +
  "'좋았던 점 (10건)'처럼 이미 여러 응답이 하나로 묶여 집계된 화면이면, 보이는 문구를 그대로 한 항목으로 옮겨 적어줘.";

function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export async function parseImageWithVision(
  base64Image: string,
  mimeType: string,
): Promise<VisionParsedResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않아요.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            { type: "image_url", image_url: { url: toDataUrl(base64Image, mimeType) } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "survey_extraction", schema: RESPONSE_SCHEMA, strict: true },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI Vision 호출에 실패했어요 (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI 응답 형식이 올바르지 않아요.");
  }

  const parsed = JSON.parse(content) as VisionRawResult;

  const objectiveResults = parsed.objectiveQuestions.map((question) =>
    recomputeFromOptions(question.title, question.options),
  );

  const subjectiveResults: SubjectiveResult[] = parsed.subjectiveQuestions.map((question) => ({
    title: question.title,
    responses: question.responses.filter((response) => response.trim() !== ""),
  }));

  return {
    respondentCount: parsed.respondentCount,
    objectiveResults,
    subjectiveResults,
  };
}
