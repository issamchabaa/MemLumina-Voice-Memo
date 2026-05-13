const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ project: 'sheep-db1', location: 'us-central1', vertexai: true });
async function test() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-1.5-flash-001',
      contents: 'hello'
    });
    console.log("001 works:", res.text);
  } catch(e) {
    console.error("001 failed:", e.message);
  }
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-1.5-flash-002',
      contents: 'hello'
    });
    console.log("002 works:", res.text);
  } catch(e) {
    console.error("002 failed:", e.message);
  }
}
test();
