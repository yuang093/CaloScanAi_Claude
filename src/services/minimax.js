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