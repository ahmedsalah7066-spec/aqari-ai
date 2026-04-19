import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/analyze-rental', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    const prompt = `
      أنت محامٍ خبير في القانون المصري. قم بتحليل عقد الإيجار هذا واستخرج:
      1. قيمة الإيجار الشهري.
      2. مدة الإيجار.
      3. نصيحة قانونية للمؤجر.

      الاستجابة JSON فقط:
      {
        "rentalAmount": 1000,
        "duration": "سنة واحدة",
        "advice": "نصيحة..."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }] }
      ],
      config: { responseMimeType: "application/json" }
    });

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(text);
    res.json(analysis);

  } catch (error: any) {
    console.error("Rental Analysis Error:", error);
    res.status(500).json({ error: error?.message || 'Failed to analyze rental contract.' });
  }
});

app.post('/api/analyze-contract', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    const prompt = `
      أنت محامٍ ومحاسب قانوني خبير في القانون المصري. مهمتك الأساسية هي فحص العقد بدقة لاستخراج بيانات "وديعة الصيانة" ومواعيد التسليم.
      
      ابحث بدقة عن الكلمات المفتاحية التالية وما يشابهها:
      - "وديعة الصيانة" أو "مصاريف الصيانة" أو "صندوق الصيانة".
      - "تاريخ الاستحقاق" أو "عند الاستلام" أو "تاريخ محدد".
      - "ميعاد التسليم" أو "تاريخ الإنهاء" أو "الاستلام الابتدائي".
      - "فترة سماح" أو "مهلة إضافية".

      قم باستخراج المعلومات التالية بدقة متناهية:
      1. عنوان العقد.
      2. تاريخ بداية التعاقد أو تاريخ تحرير العقد.
      3. تفاصيل الوحدة.
      4. السعر الإجمالي.
      5. مساحة الوحدة (بالمتر المربع).
      6. قيمة الإيجار المتوقعة أو المذكورة (إن وجدت).
      7. ميعاد التسليم الحقيقي.
      8. مهلة التسليم (بالأشهر أو السنوات).
      9. قيمة وديعة الصيانة (رقمياً) وتاريخ استحقاقها الدقيق.
      10. هل وديعة الصيانة مدمجة في الأقساط أم تدفع بشكل مستقل؟ (standalone أو integrated).
      11. جدول الأقساط بالكامل. **أمر بالغ الأهمية:** يجب استخراج جدول الأقساط كما هو موجود في العقد تماماً، صفاً بصف، وبنفس الترتيب. لا تقم بأي عمليات حسابية، لا تقم بجمع الأقساط، لا تقم بدمج أي دفعات. انقل كل دفعة (سواء كانت دفعة مقدمة، قسط دوري، دفعة صيانة، أو دفعة استلام) كعنصر منفصل في المصفوفة كما هي مكتوبة في العقد نصاً.
      12. سعر صرف الدولار مقابل الجنيه المصري في تاريخ التعاقد (استخدم معرفتك التاريخية إذا لم يكن مذكوراً في العقد).
      13. القيمة الإجمالية للوحدة بالدولار الأمريكي بناءً على سعر الصرف في تاريخ التعاقد.
      14. نصيحة قانونية تركز على بنود الصيانة والتأخير في التسليم.

      يجب أن تكون الاستجابة بصيغة JSON فقط كالتالي:
      {
        "title": "عنوان العقد",
        "contractDate": "تاريخ بداية التعاقد",
        "unitDetails": "تفاصيل الوحدة",
        "totalPrice": 123456,
        "exchangeRateAtContract": 30.9,
        "usdPriceAtContract": 4000,
        "deliveryDate": "تاريخ التسليم",
        "deliveryGracePeriod": "مهلة التسليم",
        "maintenanceDeposit": 50000,
        "maintenanceDepositDueDate": "تاريخ استحقاق الوديعة",
        "maintenanceType": "standalone أو integrated",
        "unitArea": 100,
        "rentalAmount": 5000,
        "installments": [
          { "amount": 1000, "dueDate": "2024-01-01", "description": "قسط ربع سنوي" }
        ],
        "legalAdvice": "النصيحة القانونية هنا..."
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { parts: [{ text: prompt }, { inlineData: { data: base64Data, mimeType } }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            contractDate: { type: Type.STRING },
            unitDetails: { type: Type.STRING },
            totalPrice: { type: Type.NUMBER },
            deliveryDate: { type: Type.STRING },
            deliveryGracePeriod: { type: Type.STRING },
            maintenanceDeposit: { type: Type.NUMBER },
            maintenanceDepositDueDate: { type: Type.STRING },
            maintenanceType: { 
              type: Type.STRING, 
              description: "هل وديعة الصيانة مستقلة (standalone) أم مدمجة في الأقساط (integrated)؟" 
            },
            unitArea: { type: Type.NUMBER },
            rentalAmount: { type: Type.NUMBER },
            exchangeRateAtContract: { type: Type.NUMBER },
            usdPriceAtContract: { type: Type.NUMBER },
            installments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING },
                  description: { type: Type.STRING }
                },
                required: ["amount", "dueDate", "description"]
              }
            },
            legalAdvice: { type: Type.STRING }
          },
          required: ["title", "contractDate", "unitDetails", "totalPrice", "deliveryDate", "deliveryGracePeriod", "maintenanceDeposit", "maintenanceDepositDueDate", "maintenanceType", "unitArea", "rentalAmount", "installments", "legalAdvice", "exchangeRateAtContract", "usdPriceAtContract"]
        }
      }
    });

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(text);
    res.json(analysis);

  } catch (error: any) {
    console.error("Analysis Error:", error);
    res.status(500).json({ error: error?.message || 'Failed to analyze contract.' });
  }
});

app.post('/api/compare-contracts', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt text' });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }]
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Comparison Error:", error);
    res.status(500).json({ error: 'Failed to compare contracts.' });
  }
});

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Backend API server running on port ${port}`);
});
