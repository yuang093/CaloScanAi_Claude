import https from 'https';

const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || 'api.minimax.io';
const MINIMAX_API_KEY = process.env.AI_API_KEY;

if (!MINIMAX_API_KEY) {
  console.warn('⚠️ AI_API_KEY environment variable is not set');
}

/**
 * Analyze food image using MiniMax Vision API
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} prompt - Analysis prompt
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function analyzeFoodImage(imageBase64, prompt) {
  if (!MINIMAX_API_KEY) {
    return { success: false, error: 'API key not configured' };
  }

  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

  // MiniMax Vision API format - messages array with image_url content block
  const payload = {
    model: 'MiniMax-Text-01',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: prompt || '請詳細描述這張圖片中的食物內容，並估算總熱量（卡路里）和三大營養素（蛋白質、脂肪、碳水化合物）。請以 JSON 格式回覆，包含：totalCalories、totalProtein、totalCarbs、totalFat（數字），以及 description（文字）。' }
      ]
    }]
  };

  const requestBody = JSON.stringify(payload);

  return new Promise((resolve) => {
    const options = {
      hostname: MINIMAX_API_HOST,
      port: 443,
      path: '/v1/text/chatcompletion_v2',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Extract content from MiniMax response
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            const content = parsed.choices[0].message.content;
            resolve({ success: true, data: { content } });
          } else if (parsed.base_resp?.status_msg) {
            resolve({ success: false, error: parsed.base_resp.status_msg });
          } else {
            resolve({ success: false, error: 'Unknown API response format' });
          }
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse response' });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message });
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Extract nutritional data from MiniMax response
 * Expects JSON format: { totalCalories, totalProtein, totalCarbs, totalFat, description }
 * @param {string} content - The response content from MiniMax
 * @returns {object} Parsed nutritional data
 */
export function parseNutritionalData(content) {
  if (!content || typeof content !== 'string') {
    return {
      description: content || '',
      foods: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0
    };
  }

  // Try to extract JSON from content
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[0]);
      if (typeof jsonData.totalCalories === 'number') {
        return {
          description: jsonData.description || content,
          foods: [],
          totalCalories: jsonData.totalCalories || 0,
          totalProtein: jsonData.totalProtein || 0,
          totalCarbs: jsonData.totalCarbs || 0,
          totalFat: jsonData.totalFat || 0
        };
      }
    } catch (e) {
      // JSON parse failed, fall back to text parsing
    }
  }

  // Fallback: extract last mentioned calorie value
  const calorieRegex = /(\d+)\s*~?\s*(\d+)?\s*(?:大卡|kcal|calories?)/gi;
  const matches = [...content.matchAll(calorieRegex)];
  let totalCalories = 0;

  if (matches.length > 0) {
    // Take the last matched value (typically the total)
    const lastMatch = matches[matches.length - 1];
    totalCalories = parseInt(lastMatch[1]);
  }

  // If still no calories, estimate from food mentions
  if (totalCalories === 0) {
    const foodMentions = content.match(/(牛肉|雞肉|豬肉|魚|飯|麵|蔬菜|水果|豆|奶|蛋|麵包|飯)/gi);
    if (foodMentions) {
      totalCalories = foodMentions.length * 200;
    }
  }

  return {
    description: content,
    foods: [],
    totalCalories: totalCalories || 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0
  };
}