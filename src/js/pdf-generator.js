// CaloScanAi PDF 報告產生器 - 六種格式
// 使用 html2canvas 轉圖片再轉 PDF，支援中文

const safeNum = (n) => n == null ? 0 : (isNaN(n) ? 0 : Number(n));
const safeDate = (d) => d == null ? '' : String(d);

function getLocalDateStr(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const taiwan = new Date(utc + (8 * 60 * 60 * 1000));
  const y = taiwan.getFullYear();
  const m = String(taiwan.getMonth() + 1).padStart(2, '0');
  const day = String(taiwan.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcStats(records) {
  const totalCal = records.reduce((sum, r) => sum + safeNum(r.total_calories), 0);
  const totalPro = records.reduce((sum, r) => sum + safeNum(r.total_protein), 0);
  const totalCarbs = records.reduce((sum, r) => sum + safeNum(r.total_carbs), 0);
  const totalFat = records.reduce((sum, r) => sum + safeNum(r.total_fat), 0);
  const len = records.length || 1;

  const totalProCal = totalPro * 4;
  const totalCarbsCal = totalCarbs * 4;
  const totalFatCal = totalFat * 9;
  const totalMacroCal = totalProCal + totalCarbsCal + totalFatCal;

  const maxCal = Math.max(...records.map(r => safeNum(r.total_calories)), 1);
  const minCal = Math.min(...records.map(r => safeNum(r.total_calories)), 1);

  return {
    avgCal: Math.round(totalCal / len),
    avgPro: Math.round(totalPro / len * 10) / 10,
    avgCarbs: Math.round(totalCarbs / len * 10) / 10,
    avgFat: Math.round(totalFat / len * 10) / 10,
    maxCal,
    minCal,
    totalDays: len,
    proPercent: totalMacroCal > 0 ? Math.round(totalProCal / totalMacroCal * 100) : 33,
    carbsPercent: totalMacroCal > 0 ? Math.round(totalCarbsCal / totalMacroCal * 100) : 33,
    fatPercent: totalMacroCal > 0 ? Math.round(totalFatCal / totalMacroCal * 100) : 34
  };
}

// ============================================================
// 格式二：卡片式（修復版 - 使用像素單位）
// ============================================================
function createStyle2HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat, maxCal, minCal, totalDays, proPercent, carbsPercent, fatPercent } = stats;
  const recent7 = records.slice(0, 7);
  const recent14 = records.slice(0, 14);

  const calcWeekAvg = (weekRecords) => {
    const total = weekRecords.reduce((sum, r) => sum + safeNum(r.total_calories), 0);
    return Math.round(total / weekRecords.length);
  };

  const week1Avg = calcWeekAvg(recent7);
  const week2Avg = recent14.length >= 14 ? calcWeekAvg(recent14.slice(7, 14)) : week1Avg;
  const trend = week1Avg - week2Avg;

  // 使用 px 單位，確保 html2canvas 正確截取
  return `
    <div style="width:1280px;min-height:1800px;background:#ffffff;font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;padding:80px 60px;box-sizing:border-box;color:#1a1a2e;">
      <!-- 頁面頂部 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:60px;padding-bottom:40px;border-bottom:3px solid #e0e7ff;">
        <div>
          <div style="font-size:72px;font-weight:700;color:#4f46e5;">CaloScanAi</div>
          <div style="font-size:36px;color:#6b7280;">智慧熱量追蹤系統</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:36px;color:#6b7280;">報表日期</div>
          <div style="font-size:48px;font-weight:600;color:#374151;">${endDateStr}</div>
        </div>
      </div>

      <!-- 標題 -->
      <div style="text-align:center;margin-bottom:60px;">
        <div style="font-size:80px;font-weight:700;color:#1e293b;margin-bottom:15px;">🍎 營養攝取報告</div>
        <div style="font-size:36px;color:#6b7280;">共 ${totalDays} 天資料統計</div>
      </div>

      <!-- 四大核心指標 -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:30px;margin-bottom:60px;">
        <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:40px;padding:40px 20px;text-align:center;">
          <div style="font-size:72px;margin-bottom:10px;">🔥</div>
          <div style="font-size:64px;font-weight:700;color:#d97706;">${avgCal}</div>
          <div style="font-size:32px;color:#92400e;">平均熱量 kcal</div>
        </div>
        <div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:40px;padding:40px 20px;text-align:center;">
          <div style="font-size:72px;margin-bottom:10px;">💪</div>
          <div style="font-size:64px;font-weight:700;color:#2563eb;">${avgPro}g</div>
          <div style="font-size:32px;color:#1e40af;">蛋白質</div>
        </div>
        <div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:40px;padding:40px 20px;text-align:center;">
          <div style="font-size:72px;margin-bottom:10px;">🍞</div>
          <div style="font-size:64px;font-weight:700;color:#059669;">${avgCarbs}g</div>
          <div style="font-size:32px;color:#047857;">碳水化合物</div>
        </div>
        <div style="background:linear-gradient(135deg,#fce7f3,#fbcfe8);border-radius:40px;padding:40px 20px;text-align:center;">
          <div style="font-size:72px;margin-bottom:10px;">🥑</div>
          <div style="font-size:64px;font-weight:700;color:#db2777;">${avgFat}g</div>
          <div style="font-size:32px;color:#be185d;">脂肪</div>
        </div>
      </div>

      <!-- 熱量趨勢圖 -->
      <div style="background:white;border-radius:40px;padding:40px;margin-bottom:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <div style="font-size:40px;font-weight:600;color:#374151;margin-bottom:30px;">📊 近7天熱量趨勢</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;height:300px;padding:0 20px;">
          ${recent7.map((r, i) => {
            const h = Math.round((safeNum(r.total_calories) / (maxCal * 1.1)) * 250);
            const colors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#14b8a6','#3b82f6'];
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:15px;">
              <div style="width:80%;background:${colors[i]};border-radius:8px 8px 0 0;height:${h}px;min-height:20px;"></div>
              <div style="font-size:28px;color:#6b7280;">${safeDate(r.date).slice(5)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- 營養素比例 & 熱量統計 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:40px;">
        <div style="background:white;border-radius:40px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <div style="font-size:40px;font-weight:600;color:#374151;margin-bottom:25px;">🥗 三大營養素比例</div>
          <div style="display:flex;height:40px;border-radius:20px;overflow:hidden;margin-bottom:20px;">
            <div style="width:${proPercent}%;background:#3b82f6;"></div>
            <div style="width:${carbsPercent}%;background:#22c55e;"></div>
            <div style="width:${fatPercent}%;background:#f97316;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:32px;">
            <span style="color:#3b82f6;">● 蛋白 ${proPercent}%</span>
            <span style="color:#22c55e;">● 碳水 ${carbsPercent}%</span>
            <span style="color:#f97316;">● 脂肪 ${fatPercent}%</span>
          </div>
        </div>
        <div style="background:white;border-radius:40px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          <div style="font-size:40px;font-weight:600;color:#374151;margin-bottom:25px;">📈 熱量統計</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:36px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">最高</span><span style="font-weight:600;color:#ef4444;">${maxCal}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">最低</span><span style="font-weight:600;color:#22c55e;">${minCal}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">本週均</span><span style="font-weight:600;color:#4f46e5;">${week1Avg}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">趨勢</span><span style="font-weight:600;color:${trend>=0?'#ef4444':'#22c55e'};">${trend>=0?'↑':'↓'}${Math.abs(trend)}</span></div>
          </div>
        </div>
      </div>

      <!-- 每日詳細記錄表 -->
      <div style="background:white;border-radius:40px;padding:40px;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <div style="font-size:40px;font-weight:600;color:#374151;margin-bottom:25px;">📋 每日記錄</div>
        <table style="width:100%;border-collapse:collapse;font-size:32px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:20px 10px;text-align:left;color:#64748b;font-weight:500;">日期</th>
              <th style="padding:20px 10px;text-align:right;color:#64748b;font-weight:500;">熱量</th>
              <th style="padding:20px 10px;text-align:right;color:#64748b;font-weight:500;">蛋白</th>
              <th style="padding:20px 10px;text-align:right;color:#64748b;font-weight:500;">碳水</th>
              <th style="padding:20px 10px;text-align:right;color:#64748b;font-weight:500;">脂肪</th>
            </tr>
          </thead>
          <tbody>
            ${records.slice(0, 20).map((r, i) => {
              const dayNames = ['日','一','二','三','四','五','六'];
              const d = new Date(r.date);
              const dayName = dayNames[d.getDay()];
              const calColor = safeNum(r.total_calories) > avgCal * 1.2 ? '#ef4444' : safeNum(r.total_calories) < avgCal * 0.8 ? '#22c55e' : '#374151';
              return `
              <tr style="border-bottom:2px solid #f1f5f9;">
                <td style="padding:18px 10px;">
                  <span style="color:#64748b;">${safeDate(r.date).slice(5)}</span>
                  <span style="color:#94a3b8;font-size:24px;">(${dayName})</span>
                </td>
                <td style="padding:18px 10px;text-align:right;font-weight:600;color:${calColor};">${safeNum(r.total_calories)}</td>
                <td style="padding:18px 10px;text-align:right;color:#64748b;">${safeNum(r.total_protein)}g</td>
                <td style="padding:18px 10px;text-align:right;color:#64748b;">${safeNum(r.total_carbs)}g</td>
                <td style="padding:18px 10px;text-align:right;color:#64748b;">${safeNum(r.total_fat)}g</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 頁尾 -->
      <div style="text-align:center;margin-top:60px;padding-top:40px;border-top:2px solid #e5e7eb;">
        <div style="font-size:36px;color:#9ca3af;">✨ 由 CaloScanAi 自動生成 ✨</div>
        <div style="font-size:28px;color:#d1d5db;margin-top:10px;">Calorie Tracking with AI Vision</div>
      </div>
    </div>
  `;
}

// ============================================================
// 格式一：簡潔專業型
// ============================================================
function createStyle1HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat } = stats;
  return `
    <div style="width:1280px;min-height:1800px;background:white;padding:80px 60px;font-family:'Noto Sans TC',sans-serif;">
      <div style="font-size:64px;color:#2d6a4f;border-bottom:3px solid #2d6a4f;padding-bottom:20px;margin-bottom:40px;">CaloScanAi 健康報表</div>
      <div style="font-size:36px;color:#666;margin-bottom:50px;">${endDateStr} | 近${records.length}天</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:25px;margin-bottom:50px;">
        <div style="background:#f0f9f4;padding:30px;border-radius:20px;text-align:center;border-left:5px solid #2d6a4f;"><div style="font-size:56px;font-weight:bold;color:#2d6a4f;">${avgCal}</div><div style="font-size:30px;color:#666;">平均熱量</div></div>
        <div style="background:#f0f9f4;padding:30px;border-radius:20px;text-align:center;border-left:5px solid #2d6a4f;"><div style="font-size:56px;font-weight:bold;color:#2d6a4f;">${avgPro}g</div><div style="font-size:30px;color:#666;">蛋白質</div></div>
        <div style="background:#f0f9f4;padding:30px;border-radius:20px;text-align:center;border-left:5px solid #2d6a4f;"><div style="font-size:56px;font-weight:bold;color:#2d6a4f;">${avgCarbs}g</div><div style="font-size:30px;color:#666;">碳水</div></div>
        <div style="background:#f0f9f4;padding:30px;border-radius:20px;text-align:center;border-left:5px solid #2d6a4f;"><div style="font-size:56px;font-weight:bold;color:#2d6a4f;">${avgFat}g</div><div style="font-size:30px;color:#666;">脂肪</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:32px;">
        <thead><tr style="background:#2d6a4f;color:white;"><th style="padding:20px;">日期</th><th style="padding:20px;text-align:right;">熱量</th><th style="padding:20px;text-align:right;">蛋白</th><th style="padding:20px;text-align:right;">碳水</th><th style="padding:20px;text-align:right;">脂肪</th></tr></thead>
        <tbody>${records.slice(0,18).map((r,i) => `<tr style="background:${i%2===0?'#f9f9f9':'white'};"><td style="padding:16px;">${safeDate(r.date)}</td><td style="padding:16px;text-align:right;">${safeNum(r.total_calories)}</td><td style="padding:16px;text-align:right;">${safeNum(r.total_protein)}</td><td style="padding:16px;text-align:right;">${safeNum(r.total_carbs)}</td><td style="padding:16px;text-align:right;">${safeNum(r.total_fat)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="text-align:center;margin-top:50px;font-size:28px;color:#999;">由 CaloScanAi 自動生成</div>
    </div>
  `;
}

// ============================================================
// 主函式：產生 PDF
// ============================================================
window.generatePDF_Style = async function(style, records, endDateStr) {
  const stats = calcStats(records);

  let html = '';
  switch(style) {
    case 1: html = createStyle1HTML(stats, records, endDateStr); break;
    case 2: html = createStyle2HTML(stats, records, endDateStr); break;
    default: html = createStyle2HTML(stats, records, endDateStr);
  }

  const container = document.createElement('div');
  container.id = 'pdf-render-container';
  container.innerHTML = html;
  container.style.cssText = 'position:fixed;left:-9999px;top:0;overflow:hidden;';

  document.body.appendChild(container);

  // 等待 fonts loaded
  await document.fonts.ready;

  // 等待一下確保渲染完成
  await new Promise(resolve => setTimeout(resolve, 500));

  const contentWidth = 1280;
  const contentHeight = container.scrollHeight;

  // 等待 html2canvas
  if (typeof html2canvas === 'undefined') {
    await window.loadHtml2Canvas();
  }

  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: contentWidth,
    height: contentHeight
  });

  document.body.removeChild(container);

  // 建立 PDF (A5 格式)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [148, 210]
  });

  const pageWidth = 148;
  const pageHeight = 210;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  // 如果內容超過一頁，分多頁
  if (imgHeight > pageHeight) {
    const totalPages = Math.ceil(imgHeight / pageHeight);
    const sliceHeight = (canvas.width * pageHeight) / imgWidth;

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) doc.addPage();

      const yOffset = i * sliceHeight;
      const remainingHeight = Math.min(sliceHeight, canvas.height - yOffset);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = remainingHeight;

      const ctx = tempCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, yOffset, canvas.width, remainingHeight, 0, 0, canvas.width, remainingHeight);

      doc.addImage(tempCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, (remainingHeight * pageWidth) / canvas.width);
    }
  } else {
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
  }

  doc.save(`caloscanai_report_style${style}_${endDateStr}.pdf`);
};