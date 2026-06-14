// dom-chromium-ai의 타입 라이브러리 명세와 크롬 실제 런타임 간의 스펙 불일치(Spec Drift)를 보완합니다.
// LanguageModel.create() 및 availability() 옵션에 런타임 필수 요구 값인 outputLanguage 속성을 병합 주입합니다.

interface LanguageModelCreateCoreOptions {
  outputLanguage?: string;
}
