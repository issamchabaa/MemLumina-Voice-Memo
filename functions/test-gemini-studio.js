const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: 'hello'
    });
    console.log("gemini-1.5-flash works:", res.text);
  } catch(e) {
    console.error("gemini-1.5-flash failed:", e.message);
  }
}
test();
