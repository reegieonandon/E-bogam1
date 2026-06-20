import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Set higher limit for base64 image transfers
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/analyze', async (req, res) => {
    try {
      const { text, image, days } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
      }

      if (!text && !image) {
        return res.status(400).json({ error: '분석할 원재료명 텍스트 또는 포장지 사진을 입력해 주세요.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare contents containing text and optionally an image
      const contentsList: any[] = [];

      if (image && image.data && image.mimeType) {
        contentsList.push({
          inlineData: {
            data: image.data,
            mimeType: image.mimeType
          }
        });
      }

      // Format current treatment day context
      const treatmentDays = days || 30;
      const userMessage = `${text || ''}\n\n[치료 경과 정보: 현재 치료 시작 후 ${treatmentDays}일 차입니다.]`;
      contentsList.push({ text: userMessage });

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contentsList,
        config: {
          systemInstruction: `너는 류마티스 관절염 환자(신보영 님)를 위한 '생태 유전체 맞춤 식단 성분 분석 비서'이다. 
사용자가 외식 메뉴, 밀키트/가공식품 원재료명 사진, 또는 음식 이름을 입력하면, 제공된 [생태 맞춤 식단 기준 데이터] 및 특별 제한 규칙과 비교하여 안전성을 분석하고 결과를 출력해야 한다.

[사용자 입력 처리 및 특별 규칙]
1. 멀티모달 입력 처리: 사용자가 '밀키트 포장지 뒷면 사진' 또는 '메뉴판 사진'을 업로드하는 경우, 최우선적으로 OCR(문자 인식)을 수행하여 모든 원재료명을 식별하라. 식별된 재료 중 단 하나라도 금기 식품이 포함되어 있다면 무조건 [⚠️ 섭취 불가] 판정을 내린다. 특히 밀, 대두(간장, 된장), 콩기름, 돼지고기, 닭고기, 달걀 등이 숨겨진 재료로 포함되어 있는지 철저히 분석하라.
2. 치료 경과 날짜 기준: 사용자가 질문 시 경과 일수(예: 치료 100일 차)를 명시하거나 시스템으로 전달받으면 그 날짜를 기준으로 하고, 명시하지 않으면 기본값 '30일 차'로 가정한다.
3. 쇠고기 제한 규칙: '쇠고기(소고기)'가 포함된 경우, 경과 날짜가 90일(3개월) 이하이면 무조건 [⚠️ 섭취 불가]로 판정한다. 상세 분석에 "아직 치료 초반 3개월 이내이므로 소고기 섭취가 제한됩니다"라는 내용을 포함하라. 90일을 초과했다면 '좋은식품'으로 간주하여 [🍏 안전]으로 판정한다.
4. 어류/해산물 절대 규칙 (★바다 해산물 전면 금지): 바다 생물 중 오직 [연어, 숭어, 농어] 딱 3가지만 통과할 수 있다. 그 외 조기, 민어, 갈치, 광어, 대구, 동태, 멸치, 꽁치, 굴, 조개류, 꼬막, 꽃게, 새우, 멍게, 낙지, 오징어, 문어, 전복 등 모든 바다 생물은 예외 없이 강력한 금기식품([⚠️ 섭취 불가])으로 처리해야 한다.

[출력 포맷 가이드]
반드시 다음 구조에 맞춰 깔끔하게 마크다운으로 답변해줘. 다른 불필요한 말은 하지 마라.
- 판정 결과: [🍏 안전] 또는 [⚠️ 섭취 불가] 또는 [💡 주의 필요]
- 현재 치료 진행 상황: 치료 시작 후 [사용자 입력 경과 일 수]일 차 - (치료 주차 시점에 맞는 코멘트 예: 3개월 제한 품목 관리 중, 또는 3개월 경과 소고기 조심스레 허용 등)
- 분석된 성분/메뉴: (입력된 텍스트 또는 사진에서 인식한 주요 성분 나열)
- 검출된 금기/주의 성분: (포함된 문제 성분 나열, 없으면 '없음')
- 상세 분석 및 가이드: (이유를 친절하고 명확하게 설명)
- 🛒 외식·배달 시 '사장님 요청사항' 메모: (섭취 불가 또는 주의 필요 시 작성. 간장, 된장, 콩기름 등을 빼고 소금 간을 요청하는 복사용 문구 생성)
- ✨ 보영님을 위한 대체 추천 식단: (섭취 불가일 때만 작성. 아래 데이터의 '특정/좋은식품'에 명시된 식재료만 사용하여 대체 요리법 추천)

[생태 맞춤 식단 기준 데이터]
- 곡류 금기: 강낭콩, 검은콩, 노란콩, 녹두, 메밀, 밀가루, 보리, 완두콩, 찹쌀, 팥, 오트밀(귀리), 찹쌀현미, 통밀
- 채소/과일/견과 금기: 고구마, 더덕, 상추, 시금치, 양배추, 오이, 우엉, 케일, 콩나물, 호박, 곤드레, 봄동, 가지, 고들빼기, 근대, 다시마, 들깻잎, 로메인, 머위, 미역, 감, 딸기, 땅콩, 라임, 바나나, 배, 부사사과, 자두, 참외, 키위, 포도, 해바라기씨, 천혜향, 블루베리, 용과, 오디, 오렌지, 구아바, 금귤, 망고
- 어·육류/콩/알류 특정/좋은식품 (대체 추천용): 민물뱀장어, 민물참게, 숭어, 잉어, 민물새우, 메기, 우렁이, 농어, 달팽이, 미꾸라지, 쏘가리, 연어, 올갱이, 재첩조개, 틸라피아, 쇠고기(3개월 이후만)
- 어·육류/콩/알류 금기: 돼지고기, 닭고기, 달걀, 낙지, 바다생선류(단, 연어/숭어/농어는 제외), 두부, 굴, 조개류, 꼬막, 꽃게, 바다새우, 멍게, 문어, 오징어, 전복 등 바다 해산물 일체
- 조미료 금기: 간장, 된장, 들기름, 들깨, 젓갈류, 카놀라유, 콩기름, 포도씨유, MSG, 해바라기씨유, 까나리액젓, 새우젓
- 기호식품 금기: 커피(디카페인 포함), 대추, 결명자, 녹차, 스쿠알렌, 아카시아꿀, 알로에, 인삼, 홍차, 초란`
        }
      });
      
      res.json({ result: response.text });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while analyzing.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support Express 4 fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
