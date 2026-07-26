import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase設定
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// デフォルト楽曲データ
const defaultSongs = [
  { id: "1", title: "初音ミクの消失", artist: "cosMo@暴走P", era: "2007-2011", isHallOfFame: true, lyrics: ["最高速の別れの歌", "ボクは生まれそして気づく", "所詮ヒトの模造品だと"] },
  { id: "2", title: "千本桜", artist: "黒うさP", era: "2007-2011", isHallOfFame: true, lyrics: ["千本桜夜ニ紛レ", "君ノ声モ届カナイヨ", "此処は宴鋼の檻"] },
  { id: "3", title: "シャルル", artist: "バルーン", era: "2012-2016", isHallOfFame: true, lyrics: ["さよならはあなたから言われた", "それならいっそ悪者に成らせて", "愛を謳って謳って雲の上"] },
  { id: "4", title: "グッバイ宣言", artist: "Chinozo", era: "2017-2021", isHallOfFame: true, lyrics: ["エリート意欲狂い咲き", "引き籠もり絶対ジャスティス", "引きこもれ引きこもれ"] }
];

let songList = [...defaultSongs];
let currentQuestions = [];
let currentQuestionIndex = 0;
let timerInterval = null;
let startTime = 0;
let elapsedTime = 0;
let p1Score = 0;
let p2Score = 0;
let currentBuzzerPlayer = null;

// DOM要素のキャッシュ
const elements = {
  appContainer: document.getElementById("app-container"),
  screens: document.querySelectorAll(".screen"),
  
  // メニュー
  modeSelect: document.getElementById("mode-select"),
  categorySelect: document.getElementById("category-select"),
  eraGroup: document.getElementById("era-group"),
  eraSelect: document.getElementById("era-select"),
  questionCountGroup: document.getElementById("question-count-group"),
  questionCountSelect: document.getElementById("question-count-select"),
  rankingBox: document.getElementById("ranking-box"),
  rankingList: document.getElementById("ranking-list"),
  startBtn: document.getElementById("start-btn"),
  
  // カウントダウン
  countdownOverlay: document.getElementById("countdown-overlay"),
  countdownText: document.getElementById("countdown-text"),

  // 1人プレイ
  soloProgress: document.getElementById("solo-progress"),
  soloTimer: document.getElementById("solo-timer"),
  soloLyricsBox: document.getElementById("solo-lyrics-box"),
  soloAnswerInput: document.getElementById("solo-answer-input"),
  soloSubmitBtn: document.getElementById("solo-submit-btn"),
  soloQuitBtn: document.getElementById("solo-quit-btn"),

  // VSプレイ
  vsProgress: document.getElementById("vs-progress"),
  vsTimer: document.getElementById("vs-timer"),
  vsLyricsBox: document.getElementById("vs-lyrics-box"),
  p1Score: document.getElementById("p1-score"),
  p2Score: document.getElementById("p2-score"),
  p1BuzzBtn: document.getElementById("p1-buzz-btn"),
  p2BuzzBtn: document.getElementById("p2-buzz-btn"),
  vsQuitBtn: document.getElementById("vs-quit-btn"),

  // モーダル
  modalAnswer: document.getElementById("modal-answer"),
  modalPlayerTitle: document.getElementById("modal-player-title"),
  modalAnswerInput: document.getElementById("modal-answer-input"),
  modalSubmitBtn: document.getElementById("modal-submit-btn"),
  modalCancelBtn: document.getElementById("modal-cancel-btn"),

  // 結果 & 管理画面
  resultDetail: document.getElementById("result-detail"),
  backToMenuBtn: document.getElementById("back-to-menu-btn"),
  adminMenuBtn: document.getElementById("admin-menu-btn"),
  adminBackBtn: document.getElementById("admin-back-btn"),
  adminSongList: document.getElementById("admin-song-list"),
  addSongBtn: document.getElementById("add-song-btn")
};

// --- 初期化 & イベントリスナー設定 ---

function initUIEvents() {
  // 1. カテゴリー選択：年代別を選んだ時だけ年代プルダウンを表示
  elements.categorySelect.addEventListener("change", (e) => {
    if (e.target.value === "era") {
      elements.eraGroup.classList.remove("hidden");
    } else {
      elements.eraGroup.classList.add("hidden");
    }
  });

  // 2. モード選択：タイムアタック時のみランキング表示 & 問題数50固定
  elements.modeSelect.addEventListener("change", (e) => {
    const mode = e.target.value;
    
    if (mode === "timeattack") {
      elements.rankingBox.classList.remove("hidden");
      elements.questionCountSelect.value = "50";
      elements.questionCountSelect.disabled = true;
    } else {
      elements.rankingBox.classList.add("hidden");
      elements.questionCountSelect.disabled = false;
    }
  });

  // 画面切替関数
  const showScreen = (screenId) => {
    elements.screens.forEach(s => s.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
    
    if (screenId === "vs-game-screen") {
      elements.appContainer.classList.add("landscape-mode");
    } else {
      elements.appContainer.classList.remove("landscape-mode");
    }
  };

  // ゲームスタート
  elements.startBtn.addEventListener("click", () => setupGame());

  // 中断 & 戻るボタン
  elements.soloQuitBtn.addEventListener("click", () => stopGameAndReturn());
  elements.vsQuitBtn.addEventListener("click", () => stopGameAndReturn());
  elements.backToMenuBtn.addEventListener("click", () => showScreen("menu-screen"));

  // 1人モード (テキスト入力回答)
  elements.soloSubmitBtn.addEventListener("click", submitSoloAnswer);
  elements.soloAnswerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitSoloAnswer();
  });

  // VSモード (早押し回答)
  elements.p1BuzzBtn.addEventListener("click", () => openBuzzerModal("PLAYER 1"));
  elements.p2BuzzBtn.addEventListener("click", () => openBuzzerModal("PLAYER 2"));
  elements.modalSubmitBtn.addEventListener("click", submitVSAnswer);
  elements.modalCancelBtn.addEventListener("click", closeModal);
  elements.modalAnswerInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitVSAnswer();
  });

  // 管理画面リンク
  elements.adminMenuBtn.addEventListener("click", () => {
    renderAdminSongList();
    showScreen("admin-screen");
  });
  elements.adminBackBtn.addEventListener("click", () => showScreen("menu-screen"));
}

// --- フィルタリング & ゲーム準備 ---

function getFilteredSongs() {
  const category = elements.categorySelect.value;
  const era = elements.eraSelect.value;

  return songList.filter(song => {
    if (category === "halloffame" && !song.isHallOfFame) return false;
    if (category === "era" && era !== "all") {
      if (era === "2007-2011" && song.era !== "2007-2011") return false;
      if (era === "2012-2016" && song.era !== "2012-2016") return false;
      if (era === "2017-2021" && song.era !== "2017-2021") return false;
      if (era === "2022~" && song.era !== "2022~") return false;
    }
    return true;
  });
}

function setupGame() {
  const filtered = getFilteredSongs();
  if (filtered.length === 0) {
    alert("条件に一致する楽曲がありません。設定を変更してください。");
    return;
  }

  const count = parseInt(elements.questionCountSelect.value, 10);
  currentQuestions = [...filtered].sort(() => Math.random() - 0.5).slice(0, count);
  currentQuestionIndex = 0;
  p1Score = 0;
  p2Score = 0;

  const mode = elements.modeSelect.value;
  const targetScreen = mode === "vs" ? "vs-game-screen" : "solo-game-screen";

  // 画面遷移
  elements.screens.forEach(s => s.classList.remove("active"));
  document.getElementById(targetScreen).classList.add("active");
  if (mode === "vs") {
    elements.appContainer.classList.add("landscape-mode");
  } else {
    elements.appContainer.classList.remove("landscape-mode");
  }

  // スタート時の3秒カウントダウン
  startCountdown(() => {
    startTimer();
    loadQuestion();
  });
}

// 3秒カウントダウンのロジック
function startCountdown(onComplete) {
  let count = 3;
  elements.countdownText.textContent = count;
  elements.countdownOverlay.classList.remove("hidden");

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      elements.countdownText.textContent = count;
    } else if (count === 0) {
      elements.countdownText.textContent = "START!";
    } else {
      clearInterval(interval);
      elements.countdownOverlay.classList.add("hidden");
      onComplete();
    }
  }, 1000);
}

// タイマー処理
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    const formatted = formatTime(elapsedTime);
    elements.soloTimer.textContent = formatted;
    elements.vsTimer.textContent = formatted;
  }, 10);
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const sec = (totalSec % 60).toString().padStart(2, "0");
  const milli = Math.floor((ms % 1000) / 10).toString().padStart(2, "0");
  return `${min}:${sec}.${milli}`;
}

// 問題表示処理
function loadQuestion() {
  const q = currentQuestions[currentQuestionIndex];
  const mode = elements.modeSelect.value;
  const total = currentQuestions.length;

  if (mode === "vs") {
    elements.vsProgress.textContent = `Q. ${currentQuestionIndex + 1} / ${total}`;
    elements.vsLyricsBox.innerHTML = q.lyrics.map(l => `<div class="lyric-line">${l}</div>`).join("");
    elements.p1Score.textContent = p1Score;
    elements.p2Score.textContent = p2Score;
  } else {
    elements.soloProgress.textContent = `Q. ${currentQuestionIndex + 1} / ${total}`;
    elements.soloLyricsBox.innerHTML = q.lyrics.map(l => `<div class="lyric-line">${l}</div>`).join("");
    elements.soloAnswerInput.value = "";
    elements.soloAnswerInput.focus();
  }
}

// 1人モード（テキスト入力）回答チェック
function submitSoloAnswer() {
  const input = elements.soloAnswerInput.value.trim();
  const q = currentQuestions[currentQuestionIndex];

  if (input.toLowerCase() === q.title.toLowerCase()) {
    nextQuestion();
  } else {
    alert("不正解です！");
  }
}

// 早押しモーダル (VSモード)
function openBuzzerModal(player) {
  currentBuzzerPlayer = player;
  elements.modalPlayerTitle.textContent = `${player} の回答`;
  elements.modalAnswerInput.value = "";
  elements.modalAnswer.classList.remove("hidden");
  elements.modalAnswerInput.focus();
}

function closeModal() {
  elements.modalAnswer.classList.add("hidden");
}

function submitVSAnswer() {
  const input = elements.modalAnswerInput.value.trim();
  const q = currentQuestions[currentQuestionIndex];
  closeModal();

  if (input.toLowerCase() === q.title.toLowerCase()) {
    if (currentBuzzerPlayer === "PLAYER 1") p1Score++;
    else p2Score++;
    nextQuestion();
  } else {
    alert("不正解！");
  }
}

// 進行・終了判定
function nextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex < currentQuestions.length) {
    loadQuestion();
  } else {
    endGame();
  }
}

function endGame() {
  clearInterval(timerInterval);
  const mode = elements.modeSelect.value;

  elements.screens.forEach(s => s.classList.remove("active"));
  document.getElementById("result-screen").classList.add("active");
  elements.appContainer.classList.remove("landscape-mode");

  if (mode === "vs") {
    let winner = "DRAW";
    if (p1Score > p2Score) winner = "PLAYER 1 WIN!";
    if (p2Score > p1Score) winner = "PLAYER 2 WIN!";

    elements.resultDetail.innerHTML = `
      <h3>${winner}</h3>
      <div class="vs-final-scores">
        <div class="vs-score-card p1-card">P1: <strong>${p1Score}問</strong></div>
        <div class="vs-score-card p2-card">P2: <strong>${p2Score}問</strong></div>
      </div>
      <p class="final-score-text">タイム: ${formatTime(elapsedTime)}</p>
    `;
  } else {
    elements.resultDetail.innerHTML = `
      <h3>CLEAR!</h3>
      <div class="highlight-score">${formatTime(elapsedTime)}</div>
      <p class="final-score-text">${currentQuestions.length}問クリア！</p>
    `;
  }
}

function stopGameAndReturn() {
  clearInterval(timerInterval);
  elements.screens.forEach(s => s.classList.remove("active"));
  document.getElementById("menu-screen").classList.add("active");
  elements.appContainer.classList.remove("landscape-mode");
}

// 管理画面の楽曲一覧描画
function renderAdminSongList() {
  elements.adminSongList.innerHTML = songList.map(song => `
    <div class="song-item">
      <div>
        <div class="song-title">${song.title}</div>
        <div class="song-sub">${song.artist} (${song.era}) ${song.isHallOfFame ? '★伝説入り' : ''}</div>
      </div>
    </div>
  `).join("");
}

// 初期実行
document.addEventListener("DOMContentLoaded", () => {
  initUIEvents();
});
