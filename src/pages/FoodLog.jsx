import { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function FoodLog() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [foodLogs, setFoodLogs] = useState([]);
  const fileInputRef = useRef(null);
  const { theme } = useTheme();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(file);
      setPreviewUrl(e.target.result);
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const analyzeImage = async () => {
    if (!previewUrl) return;

    setIsAnalyzing(true);
    try {
      const base64Data = previewUrl.replace(/^data:image\/\w+;base64,/, '');

      const response = await fetch('/api/food/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data })
      });

      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result.analysis);
      } else {
        alert('分析失敗：' + result.error);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('分析失敗，請稍後再試');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addToFoodLog = () => {
    if (!analysisResult) return;

    const newEntry = {
      id: Date.now(),
      image: previewUrl,
      description: analysisResult.description?.substring(0, 200) + '...',
      calories: analysisResult.totalCalories || 0,
      protein: analysisResult.totalProtein || 0,
      carbs: analysisResult.totalCarbs || 0,
      fat: analysisResult.totalFat || 0,
      timestamp: new Date().toLocaleString('zh-TW')
    };

    setFoodLogs([newEntry, ...foodLogs]);
    setSelectedImage(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
  };

  return (
    <div className="food-log-page">
      <div className="food-log-header">
        <h1>食物日誌</h1>
        <p>上傳照片，讓 AI 幫你分析熱量</p>
      </div>

      <div className="upload-section">
        <div
          className={`upload-zone ${previewUrl ? 'has-preview' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {previewUrl ? (
            <div className="preview-container">
              <img src={previewUrl} alt="Preview" className="preview-image" />
              <button
                className="btn btn-secondary change-image-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                更換圖片
              </button>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">📷</div>
              <p>點擊上傳或拖曳圖片</p>
              <span>支援 JPEG、PNG、WebP</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {previewUrl && !analysisResult && (
          <button
            className="btn btn-primary analyze-btn"
            onClick={analyzeImage}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '分析中...' : '分析食物'}
          </button>
        )}
      </div>

      {analysisResult && (
        <div className="analysis-result card">
          <h3>分析結果</h3>
          <div className="nutrition-grid">
            <div className="nutrition-item">
              <span className="nutrition-value">{analysisResult.totalCalories || 0}</span>
              <span className="nutrition-label">卡路里 (kcal)</span>
            </div>
            <div className="nutrition-item">
              <span className="nutrition-value">{analysisResult.totalProtein || 0}g</span>
              <span className="nutrition-label">蛋白質</span>
            </div>
            <div className="nutrition-item">
              <span className="nutrition-value">{analysisResult.totalCarbs || 0}g</span>
              <span className="nutrition-label">碳水化合物</span>
            </div>
            <div className="nutrition-item">
              <span className="nutrition-value">{analysisResult.totalFat || 0}g</span>
              <span className="nutrition-label">脂肪</span>
            </div>
          </div>
          <div className="analysis-description">
            <p>{analysisResult.description?.substring(0, 300)}...</p>
          </div>
          <button className="btn btn-primary" onClick={addToFoodLog}>
            加入日誌
          </button>
        </div>
      )}

      <div className="food-log-list">
        <h3>今日記錄</h3>
        {foodLogs.length === 0 ? (
          <p className="empty-state">尚無記錄，上傳圖片開始吧！</p>
        ) : (
          <div className="food-log-grid">
            {foodLogs.map((log) => (
              <div key={log.id} className="food-log-item card">
                <img src={log.image} alt={log.description} className="food-log-image" />
                <div className="food-log-info">
                  <span className="food-log-calories">{log.calories} kcal</span>
                  <span className="food-log-time">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .food-log-page {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .food-log-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .food-log-header h1 {
          font-size: var(--font-size-2xl);
          margin-bottom: 8px;
        }

        .upload-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 32px;
        }

        .upload-zone {
          border: 2px dashed var(--color-border);
          border-radius: var(--radius-xl);
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all var(--transition-base);
          background: var(--color-surface);
        }

        .upload-zone:hover {
          border-color: var(--color-primary);
          transform: translateY(-2px);
        }

        .upload-zone.has-preview {
          padding: 20px;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--color-text-muted);
        }

        .upload-icon {
          font-size: 3rem;
        }

        .preview-container {
          position: relative;
        }

        .preview-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: var(--radius-lg);
          object-fit: contain;
        }

        .change-image-btn {
          position: absolute;
          bottom: 12px;
          right: 12px;
        }

        .analyze-btn {
          width: 100%;
          padding: 16px;
        }

        .analysis-result {
          margin-bottom: 32px;
          padding: 24px;
        }

        .analysis-result h3 {
          margin-bottom: 16px;
        }

        .nutrition-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .nutrition-item {
          text-align: center;
          padding: 16px;
          background: var(--color-surface-2);
          border-radius: var(--radius-md);
        }

        .nutrition-value {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary);
        }

        .nutrition-label {
          font-size: var(--font-size-sm);
          color: var(--color-text-muted);
        }

        .analysis-description {
          color: var(--color-text-muted);
          font-size: var(--font-size-sm);
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .food-log-list h3 {
          margin-bottom: 16px;
        }

        .empty-state {
          text-align: center;
          color: var(--color-text-muted);
          padding: 40px;
        }

        .food-log-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 16px;
        }

        .food-log-item {
          overflow: hidden;
          padding: 12px;
        }

        .food-log-image {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: var(--radius-md);
          margin-bottom: 8px;
        }

        .food-log-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .food-log-calories {
          font-weight: var(--font-weight-bold);
          color: var(--color-primary);
        }

        .food-log-time {
          font-size: var(--font-size-xs);
          color: var(--color-text-light);
        }

        @media (max-width: 600px) {
          .nutrition-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}