// TensorFlow.js 自訂食物分類器
// 使用 MobileNet 特徵提取 + KNN 分類器

const FOOD_CLASSIFIER_KEY = 'caloscan_food_classifier';
const CONFIDENCE_THRESHOLD = 0.7;

let mobilenetModel = null;
let knnClassifier = null;
let isLoading = false;

// 載入 MobileNet 模型
window.loadFoodClassifier = async function() {
  if (mobilenetModel && knnClassifier) return true;
  if (isLoading) return false;

  isLoading = true;
  try {
    console.log('[TF Classifier] Loading MobileNet model...');

    // 動態載入 TensorFlow.js
    await import('@tensorflow/tfjs');
    const mobilenet = await import('@tensorflow-models/mobilenet');
    const knn = await import('@tensorflow-models/knn-classifier');

    // 載入 MobileNet v2
    mobilenetModel = await mobilenet.load({
      version: 2,
      alpha: 1.0
    });

    // 建立 KNN 分類器
    knnClassifier = knn.create();

    // 嘗試恢復之前訓練的分類器
    const savedData = localStorage.getItem(FOOD_CLASSIFIER_KEY);
    if (savedData) {
      try {
        const dataset = JSON.parse(savedData);
        for (const [label, data] of Object.entries(dataset)) {
          const tensor = tf.tensor(new Float32Array(data), [1, data.length]);
          knnClassifier.addExample(tensor, label);
        }
        console.log('[TF Classifier] Restored classifier with', Object.keys(dataset).length, 'classes');
      } catch (e) {
        console.log('[TF Classifier] Could not restore classifier:', e.message);
      }
    }

    console.log('[TF Classifier] Model loaded successfully');
    isLoading = false;
    return true;
  } catch (error) {
    console.error('[TF Classifier] Failed to load model:', error);
    isLoading = false;
    return false;
  }
};

// 對圖片進行分類
window.classifyFoodWithTF = async function(imageElement) {
  if (!mobilenetModel || !knnClassifier) {
    const loaded = await window.loadFoodClassifier();
    if (!loaded) return null;
  }

  try {
    // 檢查分類器是否有訓練樣本
    const numClasses = knnClassifier.getNumClasses();
    if (numClasses === 0) {
      console.log('[TF Classifier] No training data yet');
      return null;
    }

    // 提取特徵向量
    const img = tf.browser.fromPixels(imageElement);
    const embedding = mobilenetModel.infer(img, true);

    // 使用 KNN 分類
    const result = await knnClassifier.predictClass(embedding, 3);

    // 清理記憶體
    img.dispose();
    embedding.dispose();

    // 檢查置信度
    const confidences = result.confidences;
    const topConfidence = confidences[result.label] || 0;

    if (topConfidence >= CONFIDENCE_THRESHOLD) {
      console.log('[TF Classifier] Quick match:', result.label, 'confidence:', topConfidence.toFixed(2));
      return {
        label: result.label,
        confidence: topConfidence,
        allResults: confidences
      };
    }

    console.log('[TF Classifier] Confidence too low:', topConfidence.toFixed(2), '<', CONFIDENCE_THRESHOLD);
    return null;
  } catch (error) {
    console.error('[TF Classifier] Classification error:', error);
    return null;
  }
};

// 新增訓練樣本
window.trainFoodClassifier = function(imageElement, label) {
  if (!mobilenetModel || !knnClassifier) {
    console.log('[TF Classifier] Model not loaded yet');
    return false;
  }

  try {
    const img = tf.browser.fromPixels(imageElement);
    const embedding = mobilenetModel.infer(img, true);
    knnClassifier.addExample(embedding, label);

    img.dispose();
    embedding.dispose();

    // 保存分類器狀態
    window.saveFoodClassifier();

    console.log('[TF Classifier] Trained with label:', label, '- Total classes:', knnClassifier.getNumClasses());
    return true;
  } catch (error) {
    console.error('[TF Classifier] Training error:', error);
    return false;
  }
};

// 儲存分類器到 localStorage
window.saveFoodClassifier = function() {
  if (!knnClassifier) return;

  try {
    const dataset = knnClassifier.getClassifierDataset();
    const serialized = {};
    for (const [key, tensor] of Object.entries(dataset)) {
      serialized[key] = Array.from(tensor.dataSync());
    }
    localStorage.setItem(FOOD_CLASSIFIER_KEY, JSON.stringify(serialized));
    console.log('[TF Classifier] Saved classifier state');
  } catch (error) {
    console.error('[TF Classifier] Save error:', error);
  }
};

// 取得分類器狀態
window.getClassifierStats = function() {
  if (!knnClassifier) return null;

  return {
    numClasses: knnClassifier.getNumClasses(),
    exampleCounts: knnClassifier.getClassExampleCount()
  };
};

// 清空分類器
window.clearFoodClassifier = function() {
  if (knnClassifier) {
    knnClassifier.clearAllClasses();
    localStorage.removeItem(FOOD_CLASSIFIER_KEY);
    console.log('[TF Classifier] Cleared');
  }
};

// 從影像元素取得 base64
function imageElementToBase64(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85).replace(/^data:image\/\w+;base64,/, '');
}