---
template: plan
version: 1.3
feature: excel-upload
date: 2026-09-02
author: 정보라
project: mymy-app
version_project: 0.1.0
---

# excel-upload Planning Document

> **Summary**: 교육명·교육일자 입력 폼과, 응답 엑셀(.xlsx) 또는 교육평가 시스템 캡처 이미지(jpg/png)를 업로드하는 화면을 만든다.
>
> **Project**: mymy-app
> **Version**: 0.1.0
> **Author**: 정보라
> **Date**: 2026-09-02
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 결과보고서를 만들려면 먼저 교육 기본정보(교육명, 교육일자)를 입력하고 응답 엑셀 또는 캡처 이미지를 업로드해야 하는데, 현재 앱에는 이 화면이 없다. |
| **Solution** | 교육명·교육일자 입력 폼과, 확장자로 엑셀(.xlsx)/이미지(jpg, png)를 자동 구분하는 파일 업로드 버튼을 하나의 화면으로 제공한다. |
| **Function/UX Effect** | 담당자가 화면 하나에서 기본정보 입력과 파일 업로드를 끝내고, 다음 단계(자동 인식)로 넘어갈 수 있게 된다. |
| **Core Value** | PRD 3번 목표(수작업 재구성 0단계)로 가는 첫 관문 — 이후 모든 자동화 로직이 이 업로드 결과를 입력으로 삼는다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 교육마다 다른 응답 엑셀/캡처 화면을 매번 수작업으로 결과보고서 양식에 맞춰야 하는 반복 작업을 없애기 위함 |
| **WHO** | 교육을 운영하는 담당자 (병원 내부) |
| **RISK** | 잘못된 형식/손상된 파일 업로드 시 이후 처리 단계가 깨질 수 있음 |
| **SUCCESS** | 엑셀(.xlsx)과 이미지(jpg/png)를 하나의 업로드 버튼으로 받아, 확장자로 올바르게 구분해 다음 단계로 전달한다 |
| **SCOPE** | 입력 폼 + 업로드 UI까지만 (파싱·인식·집계·보고서 생성은 이후 PLAN.md 3~10번 단계) |

---

## 1. Overview

### 1.1 Purpose

교육명·교육일자를 입력받고, Google Forms 응답 엑셀 또는 교육평가 시스템 캡처 이미지를 업로드할 수 있는 화면을 만든다. 이 화면은 PLAN.md 2번 작업이며, 이후 문항 인식(3, 4번)·집계(5번)·결과보고서 생성(9, 10번) 단계의 입력을 만든다.

### 1.2 Background

PRD.md 4번(사용자와 이용 흐름), 5번(MUST 1) 요구사항에 따라, 이번 버전은 Google Forms 응답 엑셀뿐 아니라 교육평가 시스템 화면을 캡처한 이미지도 입력으로 지원하기로 했다 (2026-09-02 논의로 PRD에 반영). 이미지는 AI(OpenAI Vision)로 인식하되, 인식된 값은 담당자 확인 후에만 사용한다는 원칙이 있어, 업로드 단계에서부터 두 파일 유형을 구분해 이후 처리 경로(엑셀 파싱 vs AI 인식)로 나눌 수 있어야 한다.

### 1.3 Related Documents

- Requirements: [PRD.md](../../../PRD.md)
- References: [PLAN.md](../../../PLAN.md) (2번 작업)

---

## 2. Scope

### 2.1 In Scope

- [ ] 교육명, 교육일자 입력 필드
- [ ] 파일 업로드 버튼 1개 — 확장자로 엑셀(.xlsx)/이미지(jpg, png) 자동 구분
- [ ] 업로드 파일 크기 제한 (10MB)
- [ ] 허용되지 않는 형식·손상된 파일에 대한 간단한 에러 메시지 표시
- [ ] 제출 시 입력값과 파일을 서버(API route)로 전달하는 폼 구조

### 2.2 Out of Scope

- 실제 엑셀 파싱/객관식·주관식 구분 로직 (PLAN.md 3번)
- 캡처 이미지 AI 인식 로직 (PLAN.md 4번)
- 집계·주관식 정리 로직 (PLAN.md 5, 6번)
- 인식 결과 확인 화면, 값 수정 UI (PLAN.md 7번)
- 결과보고서 생성/다운로드 (PLAN.md 9, 10번)
- 여러 교육(파일 여러 개) 일괄 업로드 (PRD 6번 비범위)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 교육명, 교육일자를 입력하는 폼 필드를 제공한다 | High | Pending |
| FR-02 | 파일 업로드 버튼 하나로 .xlsx, .jpg, .png 파일을 받는다 | High | Pending |
| FR-03 | 업로드된 파일의 확장자를 기준으로 엑셀/이미지 종류를 판별해 서버로 전달한다 | High | Pending |
| FR-04 | 10MB를 초과하는 파일은 업로드를 막고 안내 메시지를 보여준다 | Medium | Pending |
| FR-05 | 허용되지 않는 확장자나 손상된 파일은 간단한 에러 메시지로 안내한다 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Security | 업로드 파일은 서버 디스크에 저장하지 않고 메모리에서만 처리 (PRD 7번) | 코드 리뷰로 파일시스템 저장 코드 없음을 확인 |
| Usability | 개발자가 아닌 담당자도 헷갈리지 않는 문구 사용 | 실제 화면 확인 (`npm run dev`) |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 교육명·교육일자 입력 폼과 업로드 버튼이 화면에 보인다
- [ ] .xlsx 파일 업로드 시 엑셀로, .jpg/.png 업로드 시 이미지로 서버에 올바르게 전달된다
- [ ] 10MB 초과 또는 허용되지 않는 형식 업로드 시 에러 메시지가 표시된다
- [ ] 코드 리뷰 완료

### 4.2 Quality Criteria

- [ ] `npm run lint` 오류 없음
- [ ] `npm run build` 성공
- [ ] `npm run dev`로 실제 화면에서 업로드 동작 확인

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 확장자만으로 파일 종류를 판별하면, 확장자가 위조된 파일이 잘못된 경로로 처리될 수 있음 | Medium | Low | 이후 파싱 단계(3, 4번)에서 실제 파일 내용을 검증하고 실패 시 에러 처리 |
| 10MB 제한이 실제 응답 엑셀/이미지보다 작아 업무에 지장을 줄 수 있음 | Low | Low | 실사용 중 문제 발생 시 담당자 피드백을 받아 제한값 조정 |

---

## 6. Impact Analysis

> 이 기능은 새 프로젝트의 첫 화면 기능이라 기존 코드에 미치는 영향은 없다.

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `app/page.tsx` | UI | Next.js 기본 스캐폴드 화면을 업로드 화면으로 교체 |
| `app/api/upload/route.ts` (신규) | API | 업로드된 파일을 받는 API route 신규 생성 |

### 6.2 Current Consumers

없음 (신규 기능, 기존 소비자 없음).

### 6.3 Verification

- [x] 신규 기능이라 기존 소비자 검증 불필요

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure (`components/`, `lib/`, `types/`) | Static sites, portfolios, landing pages | ☐ |
| **Dynamic** | Feature-based modules, BaaS integration (bkend.ai) | Web apps with backend, SaaS MVPs, fullstack apps | ☐ |
| **Enterprise** | Strict layer separation, DI, microservices | High-traffic systems, complex architectures | ☐ |

> PRD 8번에서 기술 스택을 Next.js(화면+API 한 프로젝트)로 고정했고, 로그인/DB 계정 없이 파일을 즉시 처리 후 버리는 구조라 위 3개 레벨 중 어디에도 정확히 들어맞지 않는다. bkend.ai 같은 BaaS나 별도 백엔드 없이, Next.js API route만으로 처리하는 최소 구조를 그대로 사용한다.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js / React / Vue | Next.js (App Router) | PRD 8번에 고정 |
| State Management | Context / Zustand / Redux / Jotai | React 기본 `useState` | 화면 하나짜리 폼이라 별도 상태관리 라이브러리 불필요 |
| API Client | fetch / axios / react-query | fetch | 업로드 1회성 요청이라 별도 라이브러리 불필요 |
| Form Handling | react-hook-form / formik / native | native (`<form>` + FormData) | 필드 수가 적어 라이브러리 없이 충분 |
| Styling | Tailwind / CSS Modules / styled-components | Tailwind | PRD 8번에 고정 |
| Testing | Jest / Vitest / Playwright | 없음 (수동 확인) | PRD/CLAUDE.md 검증 루프가 lint+build+dev 수동 확인 방식 |
| Backend | BaaS (bkend.ai) / Custom Server / Serverless | Next.js API Route | 계정/DB 없이 파일을 받아 즉시 처리 후 버리는 구조라 별도 백엔드 불필요 |

### 7.3 Clean Architecture Approach

```
Selected Level: (Starter/Dynamic/Enterprise 어디에도 정확히 속하지 않는 최소 구조)

폴더 구조:
app/
  page.tsx              — 입력 폼 + 업로드 화면
  api/upload/route.ts   — 업로드 파일을 받는 API route (신규)
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `CLAUDE.md` has coding conventions section
- [ ] `docs/01-plan/conventions.md` exists (Phase 2 output)
- [ ] `CONVENTIONS.md` exists at project root
- [x] ESLint configuration (`.eslintrc.*` → `eslint.config.mjs`)
- [ ] Prettier configuration (`.prettierrc`)
- [x] TypeScript configuration (`tsconfig.json`)

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **Naming** | missing | 파일 업로드 API route는 `app/api/upload/route.ts` | Medium |
| **Environment variables** | exists (`.env`) | 이번 작업(업로드 UI)에서는 신규 환경변수 없음 — Vision API 키는 PLAN 4번에서 사용 | Low |

### 8.3 Environment Variables Needed

이번 작업(업로드 UI)에서는 신규 환경변수가 필요 없다. `.env`의 `OPENAI_API_KEY`는 PLAN.md 4번(이미지 AI 인식) 단계에서 사용한다.

### 8.4 Pipeline Integration

해당 없음 (9-phase Development Pipeline 미사용).

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`excel-upload.design.md`)
2. [ ] 담당자 확인
3. [ ] 구현 시작 (PLAN.md 2번)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-09-02 | Initial draft | 정보라 |
