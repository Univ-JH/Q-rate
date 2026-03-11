// src/services/geminiService.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// 환경변수에서 API 키 불러오기
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// 빠르고 저렴한 1.5 Flash 모델 사용
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * AI를 이용해 단일 문제를 생성하는 함수
 * @param {string} topic - 문제의 주제 또는 키워드
 * @param {string} type - 문제 유형 (MULTIPLE_CHOICE, SHORT_ANSWER, ESSAY)
 * @param {string} difficulty - 난이도 (EASY, MEDIUM, HARD)
 */
export const generateSingleQuestion = async (topic, type, difficulty) => {
  try {
    // 1. 문제 유형에 따른 프롬프트(지시어) 세팅
    let typeInstruction = '';
    if (type === 'MULTIPLE_CHOICE') {
      typeInstruction = `
        - 4지선다형 객관식 문제를 만들어주세요.
        - JSON 응답 형식: {"content": "문제 내용", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": "정답번호(1~4)"}
      `;
    } else if (type === 'SHORT_ANSWER') {
      typeInstruction = `
        - 단답형 주관식 문제를 만들어주세요. 정답은 한 단어 또는 짧은 명사형이어야 합니다.
        - JSON 응답 형식: {"content": "문제 내용", "answer": "정답 텍스트"}
      `;
    } else if (type === 'ESSAY') {
      typeInstruction = `
        - 서술형 문제를 만들어주세요.
        - JSON 응답 형식: {"content": "문제 내용", "answer": "채점 기준이 될 모범 답안 및 필수 포함 키워드"}
      `;
    }

    const prompt = `
      당신은 한국의 훌륭한 교육자이자 출제 위원입니다.
      다음 주제와 난이도에 맞춰 학생들을 평가할 수 있는 퀄리티 높은 문제를 1개 출제해 주세요.

      - 주제/키워드: ${topic}
      - 난이도: ${difficulty === 'HARD' ? '어려움' : difficulty === 'EASY' ? '쉬움' : '보통'}
      
      ${typeInstruction}

      반드시 마크다운 기호(\`\`\`json 등)를 제외하고, 순수한 JSON 객체(Object) 문자열로만 응답하세요. 다른 부가 설명은 절대 금지합니다.
    `;

    // 2. Gemini API 호출
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 3. 응답 텍스트에서 불필요한 마크다운 제거 후 JSON 파싱
    // (간혹 AI가 ```json {...} ``` 형태로 줄 때가 있어 이를 정제함)
    const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJsonString);

    return parsedData;

  } catch (error) {
    console.error("Gemini API 호출 에러:", error);
    throw new Error("AI 문제 생성에 실패했습니다. 키워드를 조금 더 구체적으로 적어주세요.");
  }
};