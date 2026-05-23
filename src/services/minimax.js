import https from 'https';

const MINIMAX_API_HOST = process.env.MINIMAX_API_HOST || 'api.minimax.io';
const MINIMAX_API_KEY = process.env.AI_API_KEY;

if (!MINIMAX_API_KEY) {
  console.warn('⚠️ AI_API_KEY environment variable is not set');
}

const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Analyze food image using MiniMax Vision API with retry mechanism
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} prompt - Analysis prompt
 * @param {number} retryCount - Current retry attempt (internal)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function analyzeFoodImage(imageBase64, prompt, retryCount = 0) {
  if (!MINIMAX_API_KEY) {
    return { success: false, error: 'API key not configured' };
  }

  // MiniMax Vision API format - prompt + image_url
  const payload = {
    model: 'MiniMax-VL-01',
    prompt: prompt || '請詳細描述這張圖片中的食物內容，並估算總熱量（卡路里）和三大營養素（蛋白質、脂肪、碳水化合物）。請以 JSON 格式回覆，包含：totalCalories、totalProtein、totalCarbs、totalFat（數字），以及 description（文字）。',
    image_url: `data:image/jpeg;base64,${imageBase64}`
  };

  const requestBody = JSON.stringify(payload);

  return new Promise((resolve) => {
    const options = {
      hostname: MINIMAX_API_HOST,
      port: 443,
      path: '/v1/coding_plan/vlm',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: REQUEST_TIMEOUT
    };

    let req;
    let timeoutId;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (req) req.removeAllListeners();
    };

    const handleResponse = (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        cleanup();
        try {
          const parsed = JSON.parse(data);

          // Success case
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            resolve({ success: true, data: { content: parsed.choices[0].message.content } });
          } else if (parsed.base_resp?.status_msg) {
            // API error - may be transient
            if (retryCount < MAX_RETRIES) {
              handleRetry(resolve, 'API error: ' + parsed.base_resp.status_msg);
            } else {
              resolve({ success: false, error: parsed.base_resp.status_msg });
            }
          } else if (parsed.status_msg) {
            if (retryCount < MAX_RETRIES) {
              handleRetry(resolve, 'API error: ' + parsed.status_msg);
            } else {
              resolve({ success: false, error: parsed.status_msg });
            }
          } else if (res.statusCode >= 500) {
            // Server error - likely transient
            if (retryCount < MAX_RETRIES) {
              handleRetry(resolve, 'Server error: ' + res.statusCode);
            } else {
              resolve({ success: false, error: 'Server error: ' + res.statusCode });
            }
          } else {
            resolve({ success: true, data: { content: data } });
          }
        } catch (e) {
          if (retryCount < MAX_RETRIES) {
            handleRetry(resolve, 'Parse error');
          } else {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        }
      });
    };

    const handleRetry = async (resolve, errorMsg) => {
      await sleep(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      resolve(analyzeFoodImage(imageBase64, prompt, retryCount + 1));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      if (req) req.destroy();
      if (retryCount < MAX_RETRIES) {
        handleRetry(resolve, 'Request timeout');
      } else {
        resolve({ success: false, error: 'Request timeout after ' + MAX_RETRIES + ' retries' });
      }
    }, REQUEST_TIMEOUT);

    req = https.request(options, handleResponse);

    req.on('error', (e) => {
      cleanup();
      if (retryCount < MAX_RETRIES) {
        handleRetry(resolve, e.message);
      } else {
        resolve({ success: false, error: e.message });
      }
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

/**
 * Analyze nutrition label image using MiniMax Vision API
 * @param {string} imageBase64 - Base64 encoded nutrition label image
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function analyzeNutritionLabel(imageBase64) {
  const prompt = `請仔細辨識這張營養標示圖片中的所有文字資訊。
台灣的營養標示通常包含：
- 產品名稱
- 品牌/製造商
- 每份份量（含單位，如 g、ml）
- 熱量（單位 kcal）
- 蛋白質（單位 g）
- 碳水化合物（單位 g）
- 脂肪（單位 g）
- 可能也會有鈉、糖、膳食纖維等

請以 JSON 格式回覆：
{
  "name": "產品名稱（如果圖片有顯示）",
  "brand": "品牌名稱（如果圖片有顯示）",
  "servingSize": "每份份量（如 '30g'、'250ml'）",
  "calories": 數字（每份熱量，單位 kcal）,
  "protein": 數字（每份蛋白質，單位 g）,
  "carbs": 數字（每份碳水化合物，單位 g）,
  "fat": 數字（每份脂肪，單位 g）
}

如果無法辨識某個欄位，請設為 null。不要虛構資料，只回傳 JSON。`;

  return analyzeFoodImage(imageBase64, prompt);
}

/**
 * Parse nutrition label OCR result
 * @param {string} content - The response content from MiniMax
 * @returns {object} Parsed nutrition data
 */
export function parseNutritionOCRResult(content) {
  if (!content || typeof content !== 'string') {
    return { name: null, brand: null, servingSize: null, calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  // Try to extract JSON from content
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      return {
        name: data.name || null,
        brand: data.brand || null,
        servingSize: data.servingSize || null,
        calories: typeof data.calories === 'number' ? data.calories : 0,
        protein: typeof data.protein === 'number' ? data.protein : 0,
        carbs: typeof data.carbs === 'number' ? data.carbs : 0,
        fat: typeof data.fat === 'number' ? data.fat : 0
      };
    } catch (e) {
      // JSON parse failed
    }
  }

  // Fallback: basic regex extraction
  const calorieMatch = content.match(/熱量[:：]?\s*(\d+)/i);
  const proteinMatch = content.match(/蛋白質[:：]?\s*([\d.]+)/i);
  const carbsMatch = content.match(/碳水化合物[:：]?\s*([\d.]+)/i);
  const fatMatch = content.match(/脂肪[:：]?\s*([\d.]+)/i);

  return {
    name: null,
    brand: null,
    servingSize: null,
    calories: calorieMatch ? parseInt(calorieMatch[1]) : 0,
    protein: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
    carbs: carbsMatch ? parseFloat(carbsMatch[1]) : 0,
    fat: fatMatch ? parseFloat(fatMatch[1]) : 0
  };
}