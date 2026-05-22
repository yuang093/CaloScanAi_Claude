import https from 'https';

const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || 'https://api.minimax.io';
const MINIMAX_API_KEY = process.env.AI_API_KEY;

if (!MINIMAX_API_KEY) {
  console.error('⚠️ AI_API_KEY environment variable is not set');
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

  const payload = {
    prompt: prompt || '請詳細描述這張圖片中的食物內容，並估算總熱量（卡路里）和三大營養素（蛋白質、脂肪、碳水化合物）。',
    image_url: dataUrl
  };

  const requestBody = JSON.stringify(payload);

  return new Promise((resolve) => {
    const options = {
      hostname: MINIMAX_API_HOST.replace('https://', ''),
      port: 443,
      path: '/v1/coding_plan/vlm',
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
          if (parsed.content) {
            resolve({ success: true, data: parsed });
          } else {
            resolve({ success: false, error: parsed.base_resp?.status_msg || 'Unknown error' });
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

  const result = {
    description: content,
    foods: [],
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0
  };

  // Extract calorie estimates (use global flag for matchAll)
  const calorieRegex = /(\d+)\s*~?\s*(\d+)?\s*(?:大卡|kcal|calories?)/gi;
  for (const match of content.matchAll(calorieRegex)) {
    const cal = parseInt(match[1]);
    if (!isNaN(cal) && cal > 0 && cal < 2000) {
      result.totalCalories += cal;
    }
  }

  // Extract protein
  const proteinRegex = /蛋白質[：:]\s*(\d+(?:\.\d+)?)\s*g/gi;
  for (const match of content.matchAll(proteinRegex)) {
    result.totalProtein += parseFloat(match[1]);
  }

  // Extract fat
  const fatRegex = /脂肪[：:]\s*(\d+(?:\.\d+)?)\s*g/gi;
  for (const match of content.matchAll(fatRegex)) {
    result.totalFat += parseFloat(match[1]);
  }

  // Extract carbs
  const carbRegex = /碳水化合物?[：:]\s*(\d+(?:\.\d+)?)\s*g/gi;
  for (const match of content.matchAll(carbRegex)) {
    result.totalCarbs += parseFloat(match[1]);
  }

  // If no specific values found, try to estimate from general descriptions
  if (result.totalCalories === 0) {
    // Try to find general food mentions and estimate
    const foodMentions = content.match(/(牛肉|雞肉|豬肉|魚|飯|麵|蔬菜|水果|豆|奶|蛋|麵包|飯)/gi);
    if (foodMentions) {
      // Rough estimation: each mentioned food ~150-300 kcal
      result.totalCalories = foodMentions.length * 200;
    }
  }

  return result;
}