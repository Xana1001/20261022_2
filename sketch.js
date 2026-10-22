// ==========================================
// p5.js 答題拼圖遊戲 (雙段貝茲曲線卡榫版)
// 每條邊：1 往外凸、-1 往內凹、0 平邊 (外框)
// 包含詳細中文註解，適用於全螢幕響應式畫布
// ==========================================

// --- 全局變數宣告 ---
let gameState = "PLAY";    // 遊戲狀態："PLAY" (拼圖進行中), "RESULT" (結算頁面)
let questions = [];        // 題目與拼圖資料庫
let draggingPuzzle = null; // 當前正在拖拽的拼圖物件
let dragOffsetX = 0, dragOffsetY = 0; // 拖拽時的滑鼠偏移量

let gridCols = 3;          // 拼圖欄數 (3x3)
let gridRows = 3;
let puzzleSize = 110;      // 每塊拼圖基準大小 (動態計算)
let boardX = 0, boardY = 0;// 拼圖底板左上角座標
let poolX = 0, poolY = 0;  // 拼圖待解鎖/選擇區座標

let showModal = false;     // 是否顯示答題對話視窗
let modalQuestion = null;  // 對話視窗顯示的題目
let feedbackText = "";     // 答題後的反饋文字
let feedbackColor = null;  // 反饋文字顏色
let feedbackTimer = 0;     // 反饋顯示計時器

let audioCtx = null;       // Web Audio 音效上下文

// --- p5.js 初始化與預載 ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 初始化 Web Audio API (音效)
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();

  // 初始化題目與打亂拼圖資料
  initQuestions();
  
  // 計算響應式佈局
  calculateLayout();
}

// --- 視窗大小改變時響應式重繪 ---
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateLayout();
}

// --- 計算 UI 與拼圖板區域版面 ---
function calculateLayout() {
  let minDim = min(width, height);
  puzzleSize = constrain(floor(minDim * 0.2), 85, 140);

  let totalBoardW = puzzleSize * gridCols;
  let totalBoardH = puzzleSize * gridRows;

  // 根據橫螢幕或直螢幕佈局
  if (width >= height) {
    poolX = width * 0.08;
    poolY = (height - totalBoardH) / 2 + 20;
    
    boardX = width * 0.52;
    boardY = (height - totalBoardH) / 2 + 20;
  } else {
    poolX = (width - totalBoardW) / 2;
    poolY = height * 0.12;
    
    boardX = (width - totalBoardW) / 2;
    boardY = height * 0.54;
  }

  // 更新各拼圖塊的初始放置座標與底板上的正確對齊目標座標
  for (let i = 0; i < questions.length; i++) {
    let q = questions[i];
    let poolCol = i % gridCols;
    let poolRow = floor(i / gridCols);

    // 計算這塊拼圖在底板上的正確位置 (根據打亂後的 correctTileId)
    let targetCol = q.correctTileId % gridCols;
    let targetRow = floor(q.correctTileId / gridCols);

    q.targetX = boardX + targetCol * puzzleSize;
    q.targetY = boardY + targetRow * puzzleSize;

    // 若未被放置到底板上，預設擺放在左側待選區
    if (!q.isPlaced && !q.isDragging) {
      q.currentX = poolX + poolCol * puzzleSize;
      q.currentY = poolY + poolRow * puzzleSize;
    }
  }
}

// --- 初始化 9 題拼圖題庫 (包含隨機洗牌打亂) ---
function initQuestions() {
  let rawData = [
    { q: "太陽系中最巨大的行星是哪一顆？", options: ["木星", "火星", "土星", "金星"], ans: 0 },
    { q: "世界上跑得最快的陸地動物是？", options: ["獅子", "獵豹", "羚羊", "袋鼠"], ans: 1 },
    { q: "植物進行光合作用主要吸收哪種氣體？", options: ["氧氣", "氫氣", "二氧化碳", "氮氣"], ans: 2 },
    { q: "哪種哺乳類動物會飛翔？", options: ["飛鼠", "蝙蝠", "蜜袋鼯", "企鵝"], ans: 1 },
    { q: "人體最大的器官是什麼？", options: ["心臟", "肝臟", "皮膚", "大腦"], ans: 2 },
    { q: "企鵝主要生活在地球的哪一個區域？", options: ["北極", "赤道", "南極", "沙漠"], ans: 2 },
    { q: "彩虹的外圈通常是什麼顏色？", options: ["紅色", "藍色", "紫色", "黃色"], ans: 0 },
    { q: "蜂鳥最大的飛行特色是什麼？", options: ["飛得最高", "能倒飛與懸停", "飛得最遠", "夜間飛行"], ans: 1 },
    { q: "水的化學分子式是？", options: ["CO2", "O2", "H2O", "NaCl"], ans: 2 }
  ];

  // 洗牌打亂 9 個位置
  let tilePositions = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  tilePositions.sort(() => Math.random() - 0.5);

  // 動態計算 3x3 互補卡榫陣列 (1: 凸, -1: 凹, 0: 平邊)
  let generatedEdges = generateComplementaryEdges();

  questions = [];
  for (let i = 0; i < rawData.length; i++) {
    let targetPos = tilePositions[i];

    questions.push({
      id: i,                         // 題目序號
      correctTileId: targetPos,      // 正確歸位底板區域 (0~8)
      question: rawData[i].q,
      options: rawData[i].options,
      correctAnswer: rawData[i].ans,
      edges: generatedEdges[targetPos], // 使用動態互補的邊界方向
      isUnlocked: false,            // 是否答題解鎖
      isCorrect: false,             // 是否答對
      isPlaced: false,              // 是否正確吸附在底板上
      isDragging: false,            // 是否正在被拖拽
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0
    });
  }
}

// --- 計算 3x3 完美卡合卡榫矩陣 (1 凸、-1 凹、0 平邊) ---
function generateComplementaryEdges() {
  // 水平方向內部邊 (3列 x 2個內部邊)
  let horizEdges = [];
  for (let i = 0; i < 6; i++) horizEdges.push(Math.random() < 0.5 ? 1 : -1);

  // 垂直方向內部邊 (2列內部邊 x 3欄)
  let vertEdges = [];
  for (let i = 0; i < 6; i++) vertEdges.push(Math.random() < 0.5 ? 1 : -1);

  let edges = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      // 外框設為 0 (平邊)；內部邊與鄰居反向 (一凸一凹)
      let top = (r === 0) ? 0 : -vertEdges[(r - 1) * 3 + c];
      let bottom = (r === 2) ? 0 : vertEdges[r * 3 + c];
      let left = (c === 0) ? 0 : -horizEdges[r * 2 + (c - 1)];
      let right = (c === 2) ? 0 : horizEdges[r * 2 + c];

      edges.push({ top: top, right: right, bottom: bottom, left: left });
    }
  }
  return edges;
}

// --- p5.js 主重複繪製循環 ---
function draw() {
  background(240, 244, 248);

  if (gameState === "PLAY") {
    drawHeader();               // 標題
    drawPuzzleBoard();          // 右側拼圖底板
    drawPuzzlePoolBackground(); // 待選區背景
    drawPuzzles();              // 所有拼圖塊
    drawModal();                // 答題彈窗
    drawFeedback();             // 答題提示
    checkAllPlaced();           // 判斷是否通關
  } else if (gameState === "RESULT") {
    drawResultScreen();         // 結算頁面
  }
}

// --- 繪製頂部標題 ---
function drawHeader() {
  textAlign(CENTER, TOP);
  fill(40, 50, 70);
  noStroke();
  textSize(floor(min(width, height) * 0.035));
  textStyle(BOLD);
  text("🧩 互動知識答題拼圖", width / 2, 15);
  
  textSize(floor(min(width, height) * 0.018));
  textStyle(NORMAL);
  fill(100, 110, 130);
  text("點擊『?』答題解鎖拼圖 ➜ 將解鎖拼圖拖拽至右側底板精確拼合", width / 2, 50);
}

// --- 繪製拼圖底板 ---
function drawPuzzleBoard() {
  push();
  stroke(180, 190, 200);
  strokeWeight(2);
  fill(225, 230, 238);
  rect(boardX - 8, boardY - 8, puzzleSize * gridCols + 16, puzzleSize * gridRows + 16, 12);

  // 繪製 3x3 底板卡榫對齊線條
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      let id = r * gridCols + c;
      let x = boardX + c * puzzleSize;
      let y = boardY + r * puzzleSize;
      
      let targetQ = questions.find(q => q.correctTileId === id);

      push();
      translate(x, y);
      stroke(190, 200, 215);
      strokeWeight(2);
      fill(250, 252, 255);
      if (targetQ) {
        drawBezierPuzzleTile(puzzleSize, targetQ.edges);
      }
      pop();

      fill(210, 220, 230);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(puzzleSize * 0.22);
      text("區塊 " + (id + 1), x + puzzleSize / 2, y + puzzleSize / 2);
    }
  }
  
  fill(80, 90, 110);
  textAlign(CENTER, BOTTOM);
  textSize(16);
  textStyle(BOLD);
  text("【 拼圖底板 】", boardX + (puzzleSize * gridCols) / 2, boardY - 12);
  pop();
}

// --- 繪製待選區背景 ---
function drawPuzzlePoolBackground() {
  push();
  stroke(200);
  strokeWeight(2);
  fill(235, 238, 242);
  rect(poolX - 8, poolY - 8, puzzleSize * gridCols + 16, puzzleSize * gridRows + 16, 12);

  fill(80, 90, 110);
  textAlign(CENTER, BOTTOM);
  textSize(16);
  textStyle(BOLD);
  text("【 待解鎖/拖拽區 】", poolX + (puzzleSize * gridCols) / 2, poolY - 12);
  pop();
}

// --- 繪製所有拼圖塊 ---
function drawPuzzles() {
  let draggingItem = null;

  for (let q of questions) {
    if (q.isDragging) {
      draggingItem = q;
    } else {
      drawSinglePuzzle(q);
    }
  }

  // 拖拽中的拼圖最上層繪製
  if (draggingItem) {
    drawSinglePuzzle(draggingItem);
  }
}

// --- 繪製單一具貝茲曲線卡榫的拼圖 ---
function drawSinglePuzzle(q) {
  push();
  translate(q.currentX, q.currentY);

  if (!q.isUnlocked) {
    // 1. 未解鎖狀態 (深色背景與金色問號)
    fill(60, 70, 85);
    stroke(255);
    strokeWeight(2);
    drawBezierPuzzleTile(puzzleSize, q.edges);

    fill(255, 215, 0);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(puzzleSize * 0.35);
    textStyle(BOLD);
    text("?", puzzleSize / 2, puzzleSize / 2 - 5);

    fill(200);
    textSize(puzzleSize * 0.14);
    text("第 " + (q.id + 1) + " 題", puzzleSize / 2, puzzleSize * 0.8);

  } else {
    // 2. 已解鎖狀態：裁切並繪製對應藝術圖案區塊
    drawingContext.save();
    
    // 使用雙段貝茲曲線實施 Clip 裁切
    drawBezierPuzzleTile(puzzleSize, q.edges);
    drawingContext.clip();

    // 繪製彩繪圖片
    drawArtTile(q.correctTileId, puzzleSize);

    drawingContext.restore();

    // 外框線 (答對標綠、答錯標紅)
    strokeWeight(3.5);
    stroke(q.isCorrect ? color(46, 204, 113) : color(231, 76, 60));
    noFill();
    drawBezierPuzzleTile(puzzleSize, q.edges);

    // 完成標籤
    if (q.isPlaced) {
      fill(q.isCorrect ? color(46, 204, 113, 220) : color(231, 76, 60, 220));
      noStroke();
      circle(puzzleSize / 2, puzzleSize / 2, 26);
      fill(255);
      textSize(14);
      textAlign(CENTER, CENTER);
      text(q.isCorrect ? "✓" : "✕", puzzleSize / 2, puzzleSize / 2);
    }
  }

  // 拖拽高亮外框
  if (q.isDragging) {
    noFill();
    stroke(52, 152, 219);
    strokeWeight(4);
    drawBezierPuzzleTile(puzzleSize, q.edges);
  }

  pop();
}

// ==========================================
// 使用兩段 bezierVertex (貝茲曲線) 繪製單條邊卡榫
// ==========================================
function drawBezierEdge(x1, y1, x2, y2, v) {
  if (v === 0) {
    // 平邊：直接連接終點
    vertex(x2, y2);
  } else {
    // 計算單條邊的長度與方向向量
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len = dist(x1, y1, x2, y2);

    // 切線向量 (ux, uy) 與 法線向量 (nx, ny)
    let ux = dx / len;
    let uy = dy / len;
    let nx = -uy * v; // 乘以方向值 v (1 往外凸, -1 往內凹)
    let ny = ux * v;

    // 定義兩段貝茲曲線關鍵點 (起點 -> 圓弧頂點 -> 終點)
    // 第一段貝茲曲線：從起點彎向凸出耳部頂點
    let cp1x = x1 + ux * len * 0.35 + nx * len * 0.02;
    let cp1y = y1 + uy * len * 0.35 + ny * len * 0.02;
    let cp2x = x1 + ux * len * 0.38 + nx * len * 0.25;
    let cp2y = y1 + uy * len * 0.38 + ny * len * 0.25;
    let midx = x1 + ux * len * 0.5 + nx * len * 0.22;
    let midy = y1 + uy * len * 0.5 + ny * len * 0.22;

    bezierVertex(cp1x, cp1y, cp2x, cp2y, midx, midy);

    // 第二段貝茲曲線：從凸出耳部頂點彎回終點
    let cp3x = x1 + ux * len * 0.62 + nx * len * 0.25;
    let cp3y = y1 + uy * len * 0.62 + ny * len * 0.25;
    let cp4x = x1 + ux * len * 0.65 + nx * len * 0.02;
    let cp4y = y1 + uy * len * 0.65 + ny * len * 0.02;

    bezierVertex(cp3x, cp3y, cp4x, cp4y, x2, y2);
  }
}

// --- 組合四條邊繪製完整拼圖塊輪廓 ---
function drawBezierPuzzleTile(s, edges) {
  beginShape();
  vertex(0, 0); // 原點左上角

  // 1. 上邊 (Top: (0,0) -> (s,0))
  drawBezierEdge(0, 0, s, 0, edges.top);

  // 2. 右邊 (Right: (s,0) -> (s,s))
  drawBezierEdge(s, 0, s, s, edges.right);

  // 3. 下邊 (Bottom: (s,s) -> (0,s))
  drawBezierEdge(s, s, 0, s, edges.bottom);

  // 4. 左邊 (Left: (0,s) -> (0,0))
  drawBezierEdge(0, s, 0, 0, edges.left);

  endShape(CLOSE);
}

// --- 程序化繪製拼圖藝術圖案 ---
function drawArtTile(tileId, size) {
  let col = tileId % gridCols;
  let row = floor(tileId / gridCols);

  push();
  translate(-col * size, -row * size);

  let fullW = size * gridCols;
  let fullH = size * gridRows;

  // 天空漸層背景
  background(135, 206, 235);
  fill(255, 220, 180);
  rect(0, fullH * 0.5, fullW, fullH * 0.5);

  // 太陽
  fill(255, 100, 50);
  noStroke();
  circle(fullW * 0.8, fullH * 0.25, size * 1.2);
  fill(255, 200, 0);
  circle(fullW * 0.8, fullH * 0.25, size * 0.9);

  // 山丘
  fill(34, 139, 34);
  ellipse(fullW * 0.2, fullH * 0.85, fullW * 0.8, fullH * 0.6);
  fill(46, 139, 87);
  ellipse(fullW * 0.75, fullH * 0.9, fullW * 0.9, fullH * 0.6);

  // 房屋
  fill(220, 100, 80);
  triangle(fullW * 0.35, fullH * 0.45, fullW * 0.55, fullH * 0.45, fullW * 0.45, fullH * 0.35);
  fill(245, 222, 179);
  rect(fullW * 0.37, fullH * 0.45, fullW * 0.16, fullH * 0.18);
  fill(100, 60, 30);
  rect(fullW * 0.43, fullH * 0.53, fullW * 0.04, fullH * 0.1);

  // 大樹
  fill(110, 70, 40);
  rect(fullW * 0.12, fullH * 0.4, fullW * 0.05, fullH * 0.3);
  fill(34, 177, 76);
  circle(fullW * 0.145, fullH * 0.38, size * 1.1);

  // 飛鳥
  stroke(50);
  strokeWeight(3);
  noFill();
  arc(fullW * 0.25, fullH * 0.15, 20, 15, PI, 0);
  arc(fullW * 0.29, fullH * 0.15, 20, 15, PI, 0);

  // 花朵
  noStroke();
  fill(255, 105, 180);
  circle(fullW * 0.2, fullH * 0.82, 15);
  circle(fullW * 0.6, fullH * 0.85, 18);
  fill(255, 215, 0);
  circle(fullW * 0.2, fullH * 0.82, 6);
  circle(fullW * 0.6, fullH * 0.85, 7);

  pop();
}

// --- 繪製答題對話框 ---
function drawModal() {
  if (!showModal || !modalQuestion) return;

  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  let modalW = min(width * 0.85, 520);
  let modalH = 380;
  let modalX = (width - modalW) / 2;
  let modalY = (height - modalH) / 2;

  push();
  fill(255);
  stroke(220);
  strokeWeight(2);
  rect(modalX, modalY, modalW, modalH, 16);

  fill(52, 152, 219);
  rect(modalX, modalY, modalW, 55, 16, 16, 0, 0);

  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(20);
  textStyle(BOLD);
  text("第 " + (modalQuestion.id + 1) + " 題拼圖解鎖任務", width / 2, modalY + 28);

  fill(40);
  textSize(17);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  text(modalQuestion.question, modalX + 30, modalY + 75, modalW - 60, 70);

  let btnY = modalY + 150;
  let btnH = 42;
  let btnW = modalW - 60;

  for (let i = 0; i < modalQuestion.options.length; i++) {
    let curBtnY = btnY + i * (btnH + 10);
    let isHover = mouseX > modalX + 30 && mouseX < modalX + 30 + btnW &&
                  mouseY > curBtnY && mouseY < curBtnY + btnH;

    if (isHover) {
      fill(235, 245, 255);
      stroke(52, 152, 219);
    } else {
      fill(248, 249, 250);
      stroke(210);
    }
    strokeWeight(1.5);
    rect(modalX + 30, curBtnY, btnW, btnH, 8);

    fill(52, 152, 219);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(15);
    textStyle(BOLD);
    text(String.fromCharCode(65 + i), modalX + 52, curBtnY + btnH / 2);

    fill(50);
    textAlign(LEFT, CENTER);
    textStyle(NORMAL);
    text(modalQuestion.options[i], modalX + 80, curBtnY + btnH / 2);
  }
  pop();
}

// --- 繪製答題反饋 ---
function drawFeedback() {
  if (millis() < feedbackTimer) {
    push();
    textAlign(CENTER, CENTER);
    textSize(22);
    textStyle(BOLD);
    fill(feedbackColor);
    stroke(255);
    strokeWeight(4);
    text(feedbackText, width / 2, height - 40);
    pop();
  }
}

// --- 滑鼠點擊事件 ---
function mousePressed() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (gameState === "PLAY") {
    if (showModal && modalQuestion) {
      handleModalClick();
      return;
    }

    // 點擊未解鎖拼圖 -> 答題
    for (let q of questions) {
      if (!q.isUnlocked) {
        if (mouseX > q.currentX && mouseX < q.currentX + puzzleSize &&
            mouseY > q.currentY && mouseY < q.currentY + puzzleSize) {
          modalQuestion = q;
          showModal = true;
          playSound(440, 0.1, "sine");
          return;
        }
      }
    }

    // 點擊解鎖拼圖 -> 開始拖拽
    for (let i = questions.length - 1; i >= 0; i--) {
      let q = questions[i];
      if (q.isUnlocked && !q.isPlaced) {
        if (mouseX > q.currentX && mouseX < q.currentX + puzzleSize &&
            mouseY > q.currentY && mouseY < q.currentY + puzzleSize) {
          draggingPuzzle = q;
          q.isDragging = true;
          dragOffsetX = mouseX - q.currentX;
          dragOffsetY = mouseY - q.currentY;
          return;
        }
      }
    }
  } else if (gameState === "RESULT") {
    let btnW = 180, btnH = 50;
    let btnX = width / 2 - btnW / 2;
    let btnY = height - 90;
    if (mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH) {
      initQuestions();
      calculateLayout();
      gameState = "PLAY";
      playSound(523.25, 0.15, "triangle");
    }
  }
}

// --- 滑鼠拖拽中 ---
function mouseDragged() {
  if (draggingPuzzle) {
    draggingPuzzle.currentX = mouseX - dragOffsetX;
    draggingPuzzle.currentY = mouseY - dragOffsetY;
  }
}

// --- 放開滑鼠：磁吸對齊 ---
function mouseReleased() {
  if (draggingPuzzle) {
    let q = draggingPuzzle;
    q.isDragging = false;

    // 判斷距離是否小於 45px 自動卡入底板正確目標點
    let d = dist(q.currentX, q.currentY, q.targetX, q.targetY);
    if (d < 45) {
      q.currentX = q.targetX;
      q.currentY = q.targetY;
      q.isPlaced = true;
      playSnapSound();
    } else {
      // 若放錯，放回原待選區位置
      let poolCol = q.id % gridCols;
      let poolRow = floor(q.id / gridCols);
      q.currentX = poolX + poolCol * puzzleSize;
      q.currentY = poolY + poolRow * puzzleSize;
    }

    draggingPuzzle = null;
  }
}

// --- 處理彈出對話框點擊 ---
function handleModalClick() {
  let modalW = min(width * 0.85, 520);
  let modalH = 380;
  let modalX = (width - modalW) / 2;
  let modalY = (height - modalH) / 2;

  let btnY = modalY + 150;
  let btnH = 42;
  let btnW = modalW - 60;

  for (let i = 0; i < modalQuestion.options.length; i++) {
    let curBtnY = btnY + i * (btnH + 10);
    if (mouseX > modalX + 30 && mouseX < modalX + 30 + btnW &&
        mouseY > curBtnY && mouseY < curBtnY + btnH) {
      
      modalQuestion.isUnlocked = true;

      if (i === modalQuestion.correctAnswer) {
        modalQuestion.isCorrect = true;
        feedbackText = "🎉 答對了！拼圖已順利解鎖！";
        feedbackColor = color(46, 204, 113);
        playCorrectSound();
      } else {
        modalQuestion.isCorrect = false;
        feedbackText = "❌ 答錯了！拼圖已解鎖（此題不計分）";
        feedbackColor = color(231, 76, 60);
        playWrongSound();
      }

      feedbackTimer = millis() + 2200;
      showModal = false;
      modalQuestion = null;
      return;
    }
  }
}

// --- 檢查是否 9 塊拼圖皆放置完畢 ---
function checkAllPlaced() {
  let allPlaced = questions.every(q => q.isPlaced);
  if (allPlaced) {
    setTimeout(() => {
      gameState = "RESULT";
      playVictorySound();
    }, 500);
  }
}

// --- 繪製成績結算畫面 ---
function drawResultScreen() {
  background(235, 240, 245);

  let correctCount = questions.filter(q => q.isCorrect).length;
  let score = Math.round((correctCount / questions.length) * 100);

  let resultArtSize = min(width * 0.35, height * 0.45);
  let artX = width / 2 - resultArtSize / 2;
  let artY = height * 0.18;

  push();
  stroke(255);
  strokeWeight(8);
  rect(artX - 4, artY - 4, resultArtSize + 8, resultArtSize + 8, 8);

  translate(artX, artY);
  let scaleFactor = resultArtSize / (puzzleSize * gridCols);
  scale(scaleFactor);
  for (let i = 0; i < 9; i++) {
    drawArtTile(i, puzzleSize);
  }
  pop();

  textAlign(CENTER, TOP);
  fill(40, 50, 70);
  noStroke();
  textSize(28);
  textStyle(BOLD);
  text("恭喜完成拼圖大挑戰！🎊", width / 2, artY - 50);

  textSize(22);
  fill(52, 152, 219);
  text("最終得分：" + score + " 分 (答對 " + correctCount + " / 9 題)", width / 2, artY + resultArtSize + 20);

  let stars = "⭐".repeat(ceil(correctCount / 3));
  textSize(30);
  text(stars || "💪 繼續加油！", width / 2, artY + resultArtSize + 55);

  let btnW = 180, btnH = 50;
  let btnX = width / 2 - btnW / 2;
  let btnY = height - 85;
  let isBtnHover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;

  fill(isBtnHover ? color(41, 128, 185) : color(52, 152, 219));
  stroke(255);
  strokeWeight(2);
  rect(btnX, btnY, btnW, btnH, 25);

  fill(255);
  noStroke();
  textSize(18);
  textAlign(CENTER, CENTER);
  text("🔄 再玩一次", width / 2, btnY + btnH / 2);
}

// ==========================================
// Web Audio 音效合成器
// ==========================================

function playSound(freq, duration, type = "sine") {
  if (!audioCtx) return;
  try {
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function playCorrectSound() {
  playSound(523.25, 0.12, "triangle");
  setTimeout(() => playSound(659.25, 0.2, "triangle"), 120);
}

function playWrongSound() {
  playSound(220, 0.15, "sawtooth");
  setTimeout(() => playSound(185, 0.25, "sawtooth"), 150);
}

function playSnapSound() {
  playSound(880, 0.08, "sine");
}

function playVictorySound() {
  let notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, idx) => {
    setTimeout(() => playSound(freq, 0.2, "triangle"), idx * 120);
  });
}