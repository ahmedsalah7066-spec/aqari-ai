import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: "AIzaSyCBP3-y5TRWDuWmJJut2kJUNlKi5xNX7pU" });

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello, world!"
    });
    console.log("Success:", response.text);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
