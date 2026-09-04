import JSZip from "jszip";

// exceljs에는 차트를 만드는 기능이 없어서, exceljs가 만든 xlsx 파일(zip)을 열어
// 엑셀 정품 차트가 사용하는 OOXML 조각(chart/drawing XML)을 직접 끼워 넣는다.
// 외부 서비스로 데이터를 보내지 않고 서버 메모리 안에서만 처리한다.

export type PieChartSpec = {
  title: string;
  // "'시트명'!$B$5:$B$7" 형태의 카테고리(등급) 셀 범위 수식
  categoriesFormula: string;
  categories: string[];
  // "'시트명'!$C$5:$C$7" 형태의 값(응답수) 셀 범위 수식
  valuesFormula: string;
  values: number[];
  // 차트를 앉힐 위치 (0-based 열/행 인덱스)
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
  // 조각별 색상 (RRGGBB, "#" 없이). 생략하면 엑셀 기본 테마 색을 사용한다.
  colors?: string[];
  // 원 안에 표시되는 퍼센트 숫자 크기(pt). 생략하면 엑셀 기본 크기를 사용한다.
  dataLabelFontSize?: number;
  // 차트 아래 범례 글자 크기(pt). 생략하면 기본 8pt를 사용한다.
  legendFontSize?: number;
};

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildChartXml(spec: PieChartSpec): string {
  const catPts = spec.categories
    .map((label, index) => `<c:pt idx="${index}"><c:v>${xmlEscape(label)}</c:v></c:pt>`)
    .join("");
  const valPts = spec.values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`)
    .join("");

  const dPts = (spec.colors ?? [])
    .map(
      (color, index) =>
        `<c:dPt><c:idx val="${index}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:dPt>`,
    )
    .join("");

  // 응답 0명(0%)인 조각은 데이터 라벨을 표시하지 않는다.
  const hiddenLabels = spec.values
    .map((value, index) => (value === 0 ? index : null))
    .filter((index): index is number => index !== null)
    .map((index) => `<c:dLbl><c:idx val="${index}"/><c:delete val="1"/></c:dLbl>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:autoTitleDeleted val="1"/>
    <c:plotArea>
      <c:layout>
        <c:manualLayout>
          <c:layoutTarget val="inner"/>
          <c:xMode val="edge"/>
          <c:yMode val="edge"/>
          <c:x val="0.02"/>
          <c:y val="0.02"/>
          <c:w val="0.96"/>
          <c:h val="0.8"/>
        </c:manualLayout>
      </c:layout>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          ${dPts}
          <c:dLbls>
            ${hiddenLabels}
            ${
              spec.dataLabelFontSize
                ? `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${Math.round(spec.dataLabelFontSize * 100)}" b="1"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p></c:txPr>`
                : ""
            }
            <c:showLegendKey val="0"/>
            <c:showVal val="0"/>
            <c:showCatName val="0"/>
            <c:showSerName val="0"/>
            <c:showPercent val="1"/>
            <c:showBubbleSize val="0"/>
          </c:dLbls>
          <c:cat>
            <c:strRef>
              <c:f>${xmlEscape(spec.categoriesFormula)}</c:f>
              <c:strCache>
                <c:ptCount val="${spec.categories.length}"/>
                ${catPts}
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${xmlEscape(spec.valuesFormula)}</c:f>
              <c:numCache>
                <c:formatCode>General</c:formatCode>
                <c:ptCount val="${spec.values.length}"/>
                ${valPts}
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>
        <c:firstSliceAng val="0"/>
      </c:pieChart>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
      <c:overlay val="0"/>
      <c:txPr>
        <a:bodyPr/>
        <a:lstStyle/>
        <a:p><a:pPr><a:defRPr sz="${Math.round((spec.legendFontSize ?? 8) * 100)}"/></a:pPr><a:endParaRPr lang="ko-KR"/></a:p>
      </c:txPr>
    </c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function buildDrawingXml(chartCount: number, anchors: PieChartSpec["anchor"][]): string {
  const frames = anchors
    .map((anchor, index) => {
      const id = index + 2;
      const rId = `rId${index + 1}`;
      return `<xdr:twoCellAnchor>
    <xdr:from><xdr:col>${anchor.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${anchor.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="${id}" name="Chart ${index + 1}"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
    })
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  ${frames}
</xdr:wsDr>`;
}

function buildDrawingRelsXml(chartCount: number): string {
  const rels = Array.from({ length: chartCount }, (_, index) => {
    const chartNumber = index + 1;
    return `<Relationship Id="rId${chartNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNumber}.xml"/>`;
  }).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
</Relationships>`;
}

/**
 * exceljs가 생성한 xlsx 버퍼의 특정 시트에 원형(파이) 차트들을 심어서 반환한다.
 * sheetName은 워크북 안에서 유일해야 하며, 시트가 실제로 저장된 sheetN.xml 파일을
 * xl/workbook.xml → xl/_rels/workbook.xml.rels 관계를 따라가 정확히 찾아낸다.
 */
export async function injectPieCharts(
  buffer: Buffer,
  sheetName: string,
  charts: PieChartSpec[],
): Promise<Buffer> {
  if (charts.length === 0) return buffer;

  const zip = await JSZip.loadAsync(buffer);

  const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
  const sheetNameEscaped = xmlEscape(sheetName);
  const sheetTagMatch = workbookXml.match(
    new RegExp(`<sheet[^>]*name="${sheetNameEscaped}"[^>]*r:id="(rId\\d+)"[^>]*/>`),
  );
  if (!sheetTagMatch) {
    throw new Error(`워크북에서 시트를 찾을 수 없어요: ${sheetName}`);
  }
  const workbookRId = sheetTagMatch[1];

  const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const relMatch = workbookRelsXml.match(
    new RegExp(`<Relationship[^>]*Id="${workbookRId}"[^>]*Target="([^"]+)"[^>]*/>`),
  );
  if (!relMatch) {
    throw new Error("워크북 관계 정보에서 시트 파일을 찾을 수 없어요.");
  }
  const sheetTarget = relMatch[1].replace(/^\//, "").replace(/^worksheets\//, "");
  const sheetPath = `xl/worksheets/${sheetTarget}`;
  const sheetRelsPath = `xl/worksheets/_rels/${sheetTarget}.rels`;

  // 차트/드로잉 XML 추가
  charts.forEach((spec, index) => {
    const chartNumber = index + 1;
    zip.file(`xl/charts/chart${chartNumber}.xml`, buildChartXml(spec));
  });
  zip.file(
    "xl/drawings/drawing1.xml",
    buildDrawingXml(
      charts.length,
      charts.map((c) => c.anchor),
    ),
  );
  zip.file("xl/drawings/_rels/drawing1.xml.rels", buildDrawingRelsXml(charts.length));

  // 시트 XML에 <drawing r:id="..."/> 참조 추가
  let sheetXml = await zip.file(sheetPath)!.async("string");
  const drawingRId = "rIdDrawing1";
  const drawingTag = `<drawing r:id="${drawingRId}"/>`;
  if (/<(tableParts|extLst)[ >]/.test(sheetXml)) {
    sheetXml = sheetXml.replace(/<(tableParts|extLst)[ >]/, (match) => `${drawingTag}${match}`);
  } else {
    sheetXml = sheetXml.replace(/<\/worksheet>\s*$/, `${drawingTag}</worksheet>`);
  }
  zip.file(sheetPath, sheetXml);

  // 시트 관계 파일에 drawing1.xml 관계 추가 (없으면 새로 생성)
  const existingRelsFile = zip.file(sheetRelsPath);
  const drawingRelationship = `<Relationship Id="${drawingRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>`;
  if (existingRelsFile) {
    const existingRelsXml = await existingRelsFile.async("string");
    const updatedRelsXml = existingRelsXml.replace(
      /<\/Relationships>\s*$/,
      `${drawingRelationship}</Relationships>`,
    );
    zip.file(sheetRelsPath, updatedRelsXml);
  } else {
    zip.file(
      sheetRelsPath,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${drawingRelationship}
</Relationships>`,
    );
  }

  // [Content_Types].xml에 drawing/chart 파트 타입 등록
  let contentTypesXml = await zip.file("[Content_Types].xml")!.async("string");
  const overrides = [
    `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    ...charts.map(
      (_, index) =>
        `<Override PartName="/xl/charts/chart${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    ),
  ].join("");
  contentTypesXml = contentTypesXml.replace(
    /<\/Types>\s*$/,
    `${overrides}</Types>`,
  );
  zip.file("[Content_Types].xml", contentTypesXml);

  return zip.generateAsync({ type: "nodebuffer" });
}
