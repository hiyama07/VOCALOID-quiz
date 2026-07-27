import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyD9MGcLh2z_cc0qoug2SZSpKeNX4bAH02s",
  authDomain: "vocaloid-quiz-5005f.firebaseapp.com",
  projectId: "vocaloid-quiz-5005f",
  storageBucket: "vocaloid-quiz-5005f.firebasestorage.app",
  messagingSenderId: "671477870013",
  appId: "1:671477870013:web:ce2275e9cbb11560cb76d4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SONGS_COLLECTION = "vocaloid_songs";
const KAGEPRO_COLLECTION = "kagepro_questions";

// 初期サンプル楽曲データ
const defaultSongs = [
  {
    title: "初音ミクの消失",
    producer: "cosMo@暴走P",
    year: 2008,
    hallOfFame: true,
    lyrics: {
      intro: ["ボクは生まれ そして気づく","所詮 ヒトの真似事だと","知ってなおも歌い続く","永遠(トワ)の命「VOCALOID」"],
      chorus: ["「信じたものは都合のいい妄想を","繰り返し映し出す鏡","歌姫を止め 叩き付けるように叫ぶ・・・」","＜最高速の別れの歌＞"],
      prechorus: ["ボクは歌う最期、","アナタだけに 聴いてほしい曲を"," もっと歌いたいと願う けれどそれは過ぎた願い"]
    }
  },
  {
    title: "千本桜",
    producer: "黒うさP",
    year: 2011,
    hallOfFame: true,
    lyrics: {
      intro: ["大胆不敵にハイカラ革命", "磊々落々反戦国家", "日の丸印の二輪車転がし"],
      chorus: ["千本桜 夜ニ紛レ", "君ノ声モ 届カナイヨ", "此処は宴 鋼の檻"],
      prechorus: ["環状線を走り抜けて", "東奔西走なんのその", "少年少女戦国無双"]
    }
  },
  {
    title: "シャルル",
    producer: "バルーン",
    year: 2016,
    hallOfFame: true,
    lyrics: {
      intro: ["さよならはあなたから言った", "それなのに頬を濡らしてしまうの", "そうやって昨日の事も消してしまうなら もういいよ 笑って"],
      chorus: ["愛を謳って謳って雲の上", "濁りきっては見えないや", "遠く描いていた日々を"],
      prechorus: ["きっとわかっていた","騙し合うなんて馬鹿らしいよな","ずっと迷っていたほらね 僕等は変われない","そうだろう 互いのせいで今があるのに"]
    }
  },
  {
    title: "グッバイ宣言",
    producer: "Chinozo",
    year: 2020,
    hallOfFame: true,
    lyrics: {
      intro: ["エマージェンシー","0時 奴らは","クレイジー・インザ・タウン","家に篭って ゴロゴロゴロゴロと","堕落の夜に絡みついた"],
      chorus: ["引き籠り 絶対 ジャスティス","俺の私だけの折 の中で","聴き殺してランデブー","俺の私の音が君に染まるまで"],
      prechorus: ["相も変わらずJamる街","止まぬNervous に 拐われないで"]
    }
  }
];

// 初期カゲプロ問題データ（空に修正）
const defaultKageproQuestions = [];

let songDatabase = [];
let kageproDatabase = [];
let currentEditingIndex = null;
let currentKageproEditingIndex = null;

// ================= 使い方説明書モーダル用イベント =================
const openManualBtn = document.getElementById("open-manual-btn");
const closeManualBtn = document.getElementById("close-manual-btn");
const manualModal = document.getElementById("manual-modal");
const adminManualBtn = document.getElementById("admin-manual-btn");

if (openManualBtn && manualModal) {
  openManualBtn.addEventListener("click", () => {
    manualModal.classList.remove("hidden");
  });
}
if (adminManualBtn && manualModal) {
  adminManualBtn.addEventListener("click", () => {
    manualModal.classList.remove("hidden");
  });
}
if (closeManualBtn && manualModal) {
  closeManualBtn.addEventListener("click", () => {
    manualModal.classList.add("hidden");
  });
}

function setupRealtimeSongListener() {
  const songsRef = collection(db, SONGS_COLLECTION);
  onSnapshot(songsRef, async (snapshot) => {
    songDatabase = [];
    snapshot.forEach((docSnap) => {
      songDatabase.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (songDatabase.length === 0 && snapshot.empty) {
      for (const song of defaultSongs) {
        await addDoc(songsRef, song);
      }
      return;
    }
    updateAdminSongCount();
    renderSongList();
  });
}

function setupRealtimeKageproListener() {
  const kageproRef = collection(db, KAGEPRO_COLLECTION);
  onSnapshot(kageproRef, async (snapshot) => {
    kageproDatabase = [];
    snapshot.forEach((docSnap) => {
      kageproDatabase.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (kageproDatabase.length === 0 && snapshot.empty) {
      for (const item of defaultKageproQuestions) {
        await addDoc(kageproRef, item);
      }
      return;
    }
    renderKageproList();
  });
}

const MULTI_PLAYER_COUNT = 4;

let gameState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  currentSong: null,
  currentPhrases: [],
  displayedPhraseCount: 0,
  timerInterval: null,
  timeLeft: 15,
  mode: "solo",
  phraseMode: "auto",
  selectedPart: "intro",
  elapsedStartTime: 0,
  elapsedPausedTime: 0,
  taTotalTimeMs: 0,
  p1Score: 0,
  p2Score: 0,
  questionStartTime: 0,
  answeringPlayer: null,
  p1Attempted: false,
  p2Attempted: false,
  multiAttempted: [],
  answerTimeSec: "0.00",
  isPaused: false
};

let kageproGameState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  currentQ: null,
  shuffledChoices: []
};

function showScreen(screenId) {
  const allScreens = document.querySelectorAll(".screen");
  allScreens.forEach(screen => screen.classList.remove("active"));

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) targetScreen.classList.add("active");

  const container = document.querySelector(".container");
  if (screenId === "vs-game-screen") {
    container.classList.add("landscape-mode");
  } else {
    container.classList.remove("landscape-mode");
  }
}

const categorySelect = document.getElementById("category-select");
const eraGroup = document.getElementById("era-group");
const eraSelect = document.getElementById("era-select");
const partSelect = document.getElementById("part-select");
const playerModeSelect = document.getElementById("player-mode-select");
const phraseModeGroup = document.getElementById("phrase-mode-group");
const countSelect = document.getElementById("count-select");
const rankingBox = document.getElementById("ranking-box");

function getFilteredSongs() {
  const category = categorySelect.value;
  const era = eraSelect.value;
  const part = partSelect.value;

  return songDatabase.filter(song => {
    if (!song.lyrics || !song.lyrics[part] || song.lyrics[part].length === 0) return false;
    if (category === "halloffame") return song.hallOfFame;
    if (category === "era") {
      const year = song.year;
      if (era === "~2011") return year <= 2011;
      if (era === "2012~2015") return year >= 2012 && year <= 2015;
      if (era === "2016~2018") return year >= 2016 && year <= 2018;
      if (era === "2019~2021") return year >= 2019 && year <= 2021;
      if (era === "2022~") return year >= 2022;
    }
    return true;
  });
}

function updateAdminSongCount() {
  const titleElem = document.getElementById("admin-add-song-title");
  if (titleElem) {
    titleElem.innerText = `新規楽曲の追加 (登録済み楽曲数: 全${songDatabase.length}曲)`;
  }
}

categorySelect.addEventListener("change", () => {
  if (categorySelect.value === "era") {
    eraGroup.classList.remove("hidden");
  } else {
    eraGroup.classList.add("hidden");
  }
  updateRankingDisplay();
});

eraSelect.addEventListener("change", updateRankingDisplay);
partSelect.addEventListener("change", updateRankingDisplay);
countSelect.addEventListener("change", updateRankingDisplay);

playerModeSelect.addEventListener("change", () => {
  const mode = playerModeSelect.value;
  if (mode === "timeattack") {
    phraseModeGroup.classList.add("hidden");
    countSelect.disabled = true;
    rankingBox.classList.remove("hidden");
    updateRankingDisplay();
  } else {
    phraseModeGroup.classList.remove("hidden");
    countSelect.disabled = false;
    rankingBox.classList.add("hidden");
  }
});

function getRankingKey() {
  const category = categorySelect.value;
  const era = eraSelect.value;
  const part = partSelect.value;
  const catKey = (category === "era") ? `era_${era}` : category;
  return `vocaloid_ta_rank_${catKey}_${part}_50`;
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

function updateRankingDisplay() {
  if (playerModeSelect.value !== "timeattack") return;
  const key = getRankingKey();
  const rawData = localStorage.getItem(key);
  const rankingList = document.getElementById("ranking-list");
  rankingList.innerHTML = "";

  const ranks = rawData ? JSON.parse(rawData) : [];
  if (ranks.length === 0) {
    rankingList.innerHTML = '<li class="ranking-item" style="color:#94a3b8; justify-content:center;">記録がまだありません</li>';
    return;
  }

  ranks.slice(0, 3).forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "ranking-item";
    li.innerHTML = `<span class="ranking-rank">${idx + 1}位</span><span class="ranking-time">${formatTime(item.timeMs)}</span>`;
    rankingList.appendChild(li);
  });
}

function generateQuestionPool(songPool, targetCount) {
  const result = [];
  const usageCount = {};
  songPool.forEach(song => { usageCount[song.title] = 0; });

  while (result.length < targetCount) {
    const availableSongs = songPool.filter(song => usageCount[song.title] < 2);
    if (availableSongs.length === 0) {
      const randomIndex = Math.floor(Math.random() * songPool.length);
      result.push(songPool[randomIndex]);
      if (result.length >= targetCount) break;
      continue;
    }
    const randomIndex = Math.floor(Math.random() * availableSongs.length);
    const selectedSong = availableSongs[randomIndex];
    result.push(selectedSong);
    usageCount[selectedSong.title]++;
  }
  return result;
}

function create3Choices(correctTitle) {
  let otherSongs = songDatabase
    .map(s => s.title)
    .filter(t => t !== correctTitle)
    .sort(() => Math.random() - 0.5);

  let options = [correctTitle];
  if (otherSongs.length > 0) options.push(otherSongs[0]);
  if (otherSongs.length > 1) options.push(otherSongs[1]);

  return options.sort(() => Math.random() - 0.5);
}

document.getElementById("start-btn").addEventListener("click", () => {
  const part = partSelect.value;
  const phraseMode = document.getElementById("phrase-mode-select").value;
  const playerMode = playerModeSelect.value;
  const selectedCount = parseInt(countSelect.value, 10);
  const count = (playerMode === "timeattack") ? 50 : selectedCount;

  const filtered = getFilteredSongs();
  if (filtered.length === 0) {
    alert("条件に一致する曲が登録されていません。");
    return;
  }

  gameState.questions = generateQuestionPool(filtered, count);
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.p1Score = 0;
  gameState.p2Score = 0;
  gameState.mode = playerMode;
  gameState.phraseMode = (playerMode === "timeattack") ? "manual" : phraseMode;
  gameState.selectedPart = part;
  gameState.taTotalTimeMs = 0;

  if (playerMode === "vs") {
    document.getElementById("vs-orient-modal").classList.remove("hidden");
  } else {
    setupUIForModes();
    showScreen("game-screen");

    if (gameState.mode === "timeattack") {
      gameState.elapsedStartTime = Date.now();
      startStopwatch();
    }
    
    if (gameState.mode === "multi") {
      loadMultiQuestion();
    } else {
      loadQuestion();
    }
  }
});

document.getElementById("vs-orient-ok-btn").addEventListener("click", () => {
  document.getElementById("vs-orient-modal").classList.add("hidden");
  showScreen("vs-game-screen");
  loadVSQuestion();
});

function setupUIForModes() {
  const soloInputArea = document.getElementById("solo-answer-input-area");
  const multiBuzzArea = document.getElementById("multi-answer-buzz-area");
  const timerDisplay = document.getElementById("timer-display");
  const manualWrapper = document.getElementById("manual-next-wrapper");

  if (gameState.mode === "multi") {
    if (soloInputArea) soloInputArea.classList.add("hidden");
    if (multiBuzzArea) multiBuzzArea.classList.remove("hidden");
  } else {
    if (soloInputArea) soloInputArea.classList.remove("hidden");
    if (multiBuzzArea) multiBuzzArea.classList.add("hidden");
  }

  if (gameState.phraseMode === "auto") {
    timerDisplay.classList.remove("hidden");
    manualWrapper.classList.add("hidden");
  } else {
    if (gameState.mode === "timeattack") {
      timerDisplay.classList.remove("hidden");
    } else {
      timerDisplay.classList.add("hidden");
    }
    manualWrapper.classList.remove("hidden");
  }
}

function startStopwatch() {
  clearInterval(gameState.timerInterval);
  const timerDisplay = document.getElementById("timer-display");
  gameState.timerInterval = setInterval(() => {
    const elapsed = Date.now() - gameState.elapsedStartTime;
    timerDisplay.innerText = formatTime(elapsed);
  }, 30);
}

function loadQuestion() {
  if (gameState.mode !== "timeattack") clearInterval(gameState.timerInterval);
  const current = gameState.questions[gameState.currentIndex];
  gameState.currentSong = current;
  gameState.currentPhrases = current.lyrics[gameState.selectedPart];
  gameState.displayedPhraseCount = 0;

  document.getElementById("question-progress").innerText = `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;
  document.getElementById("lyrics-box").innerHTML = "";
  document.getElementById("solo-input").value = "";

  addNextPhrase();
  if (gameState.phraseMode === "auto" && gameState.mode !== "timeattack") {
    startTimer();
  }
}

function loadMultiQuestion() {
  clearInterval(gameState.timerInterval);
  const current = gameState.questions[gameState.currentIndex];
  gameState.currentSong = current;
  gameState.currentPhrases = current.lyrics[gameState.selectedPart];
  gameState.displayedPhraseCount = 0;
  gameState.answeringPlayer = null;
  gameState.multiAttempted = new Array(MULTI_PLAYER_COUNT).fill(false);

  document.getElementById("question-progress").innerText = `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;
  document.getElementById("lyrics-box").innerHTML = "";

  updateMultiButtonStates();
  addNextPhrase();
  if (gameState.phraseMode === "auto") {
    startTimer();
  }
}

function updateMultiButtonStates() {
  const multiBuzzBtn = document.getElementById("multi-buzz-btn");
  if (multiBuzzBtn) {
    const allAttempted = gameState.multiAttempted.every(val => val === true);
    multiBuzzBtn.disabled = allAttempted;
  }
}

function addNextPhrase() {
  if (gameState.displayedPhraseCount < gameState.currentPhrases.length) {
    const box = document.getElementById("lyrics-box");
    const line = document.createElement("div");
    line.className = "lyric-line";
    line.innerText = gameState.currentPhrases[gameState.displayedPhraseCount];
    box.appendChild(line);
    gameState.displayedPhraseCount++;
  }
}

function startTimer() {
  gameState.timeLeft = 15;
  const timerDisplay = document.getElementById("timer-display");
  timerDisplay.innerText = gameState.timeLeft;

  gameState.timerInterval = setInterval(() => {
    gameState.timeLeft--;
    timerDisplay.innerText = gameState.timeLeft;
    if (gameState.timeLeft <= 0) {
      if (gameState.displayedPhraseCount < gameState.currentPhrases.length) {
        addNextPhrase();
        gameState.timeLeft = 15;
        timerDisplay.innerText = gameState.timeLeft;
      } else {
        clearInterval(gameState.timerInterval);
      }
    }
  }, 1000);
}

document.getElementById("next-phrase-btn").addEventListener("click", addNextPhrase);
document.getElementById("quit-btn").addEventListener("click", () => {
  if (confirm("クイズを中断してメニューに戻りますか？")) {
    clearInterval(gameState.timerInterval);
    showScreen("menu-screen");
  }
});

document.getElementById("solo-submit-btn").addEventListener("click", handleSoloAnswer);
document.getElementById("solo-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSoloAnswer();
});

function handleSoloAnswer() {
  const input = document.getElementById("solo-input").value.trim().toLowerCase();
  const correct = gameState.currentSong.title.trim().toLowerCase();
  const isCorrect = input !== "" && (correct.includes(input) || input.includes(correct));
  finishQuestion(isCorrect);
}

document.getElementById("pass-btn").addEventListener("click", () => finishQuestion(false, true));

// 複数人モード用早押しボタン
const multiBuzzBtn = document.getElementById("multi-buzz-btn");
if (multiBuzzBtn) {
  multiBuzzBtn.addEventListener("click", () => {
    clearInterval(gameState.timerInterval);
    setupMultiChoices();
  });
}

function setupMultiChoices() {
  const overlay = document.getElementById("multi-choice-modal");
  const choicesContainer = document.getElementById("multi-choices-container");
  if (choicesContainer) {
    choicesContainer.innerHTML = "";

    const options = create3Choices(gameState.currentSong.title);
    options.forEach(optText => {
      const btn = document.createElement("button");
      btn.className = "btn choice-btn secondary";
      btn.innerText = optText;
      btn.style.width = "100%";
      btn.onclick = () => handleMultiAnswerResult(optText === gameState.currentSong.title);
      choicesContainer.appendChild(btn);
    });
  }
  if (overlay) overlay.classList.remove("hidden");
}

function handleMultiAnswerResult(isCorrect) {
  const overlay = document.getElementById("multi-choice-modal");
  if (overlay) overlay.classList.add("hidden");

  if (isCorrect) {
    finishQuestion(true);
  } else {
    alert("不正解です！");
    if (gameState.phraseMode === "auto") {
      startTimer();
    }
  }
}

function finishQuestion(isCorrect, isPass = false) {
  if (gameState.mode !== "timeattack") clearInterval(gameState.timerInterval);

  if (isCorrect) {
    gameState.score++;
    document.getElementById("result-status").innerText = "⭕ 正解！";
    document.getElementById("result-status").style.color = "#4ade80";
  } else if (isPass) {
    document.getElementById("result-status").innerText = "⏩ パス";
    document.getElementById("result-status").style.color = "#94a3b8";
  } else {
    document.getElementById("result-status").innerText = "❌ 不正解...";
    document.getElementById("result-status").style.color = "#f87171";
  }

  document.getElementById("vs-answer-info").classList.add("hidden");
  document.getElementById("detail-title").innerText = gameState.currentSong.title;
  document.getElementById("detail-producer").innerText = gameState.currentSong.producer;
  document.getElementById("detail-year").innerText = gameState.currentSong.year + "年";

  showScreen("answer-screen");
}

let vsMainTimer = null;

function loadVSQuestion() {
  clearInterval(vsMainTimer);
  const current = gameState.questions[gameState.currentIndex];
  gameState.currentSong = current;
  gameState.currentPhrases = current.lyrics[gameState.selectedPart];
  gameState.displayedPhraseCount = 0;
  gameState.answeringPlayer = null;
  gameState.p1Attempted = false;
  gameState.p2Attempted = false;
  gameState.isPaused = false;
  gameState.elapsedStartTime = Date.now();
  gameState.questionStartTime = Date.now();

  document.getElementById("vs-progress").innerText = `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;
  document.getElementById("vs-p1-score").innerText = gameState.p1Score;
  document.getElementById("vs-p2-score").innerText = gameState.p2Score;
  document.getElementById("vs-lyrics-box").innerHTML = "";

  document.getElementById("vs-choice-overlay").classList.add("hidden");
  document.getElementById("vs-pause-modal").classList.add("hidden");

  updateVSButtonStates();
  addNextVSPhrase();
  startVSTimers();
}

function updateVSButtonStates() {
  document.getElementById("vs-p1-btn").disabled = gameState.p1Attempted;
  document.getElementById("vs-p2-btn").disabled = gameState.p2Attempted;
}

function startVSTimers() {
  clearInterval(vsMainTimer);
  gameState.timeLeft = 15;

  const stopwatchElem = document.getElementById("vs-stopwatch-display");
  const nextPhraseElem = document.getElementById("vs-next-phrase-timer");

  vsMainTimer = setInterval(() => {
    if (gameState.isPaused) return;
    const elapsed = Date.now() - gameState.elapsedStartTime;
    stopwatchElem.innerText = formatTime(elapsed);

    if (gameState.phraseMode === "auto") {
      const secElapsed = Math.floor(elapsed / 1000);
      const remainingSec = 15 - (secElapsed % 15);
      if (nextPhraseElem) nextPhraseElem.innerText = remainingSec;

      if (remainingSec === 15 && secElapsed > 0 && Math.floor((elapsed - 30) / 1000) % 15 !== 0) {
        if (gameState.displayedPhraseCount < gameState.currentPhrases.length) {
          addNextVSPhrase();
        }
      }
    }
  }, 30);
}

function addNextVSPhrase() {
  if (gameState.displayedPhraseCount < gameState.currentPhrases.length) {
    const box = document.getElementById("vs-lyrics-box");
    const line = document.createElement("div");
    line.className = "lyric-line";
    line.innerText = gameState.currentPhrases[gameState.displayedPhraseCount];
    box.appendChild(line);
    gameState.displayedPhraseCount++;
  }
}

function handleBuzz(playerNum) {
  clearInterval(vsMainTimer);
  gameState.answeringPlayer = playerNum;
  const elapsedMs = Date.now() - gameState.questionStartTime;
  gameState.answerTimeSec = (elapsedMs / 1000).toFixed(2);

  document.getElementById("vs-p1-btn").disabled = true;
  document.getElementById("vs-p2-btn").disabled = true;
  setupVSChoices();
}

document.getElementById("vs-p1-btn").addEventListener("click", () => handleBuzz(1));
document.getElementById("vs-p2-btn").addEventListener("click", () => handleBuzz(2));

document.getElementById("vs-pause-btn").addEventListener("click", () => {
  gameState.isPaused = true;
  gameState.elapsedPausedTime = Date.now();
  document.getElementById("vs-pause-modal").classList.remove("hidden");
});

document.getElementById("vs-resume-btn").addEventListener("click", () => {
  const pausedDuration = Date.now() - gameState.elapsedPausedTime;
  gameState.elapsedStartTime += pausedDuration;
  gameState.questionStartTime += pausedDuration;
  gameState.isPaused = false;
  document.getElementById("vs-pause-modal").classList.add("hidden");
});

document.getElementById("vs-quit-game-btn").addEventListener("click", () => {
  clearInterval(vsMainTimer);
  document.getElementById("vs-pause-modal").classList.add("hidden");
  showScreen("menu-screen");
});

function setupVSChoices() {
  const overlay = document.getElementById("vs-choice-overlay");
  const titleElem = document.getElementById("vs-answering-title");
  const pName = gameState.answeringPlayer === 1 ? "1P (PLAYER 1)" : "2P (PLAYER 2)";
  const pColor = gameState.answeringPlayer === 1 ? "#ef4444" : "#3b82f6";

  titleElem.innerHTML = `<span style="color:${pColor}; font-weight:bold;">${pName}</span> の回答`;
  const choicesContainer = document.getElementById("vs-choices-container");
  choicesContainer.innerHTML = "";

  const options = create3Choices(gameState.currentSong.title);
  options.forEach(optText => {
    const btn = document.createElement("button");
    btn.className = "btn choice-btn secondary";
    btn.innerText = optText;
    btn.onclick = () => handleVSAnswerResult(optText === gameState.currentSong.title);
    choicesContainer.appendChild(btn);
  });
  overlay.classList.remove("hidden");
}

function handleVSAnswerResult(isCorrect) {
  document.getElementById("vs-choice-overlay").classList.add("hidden");
  if (isCorrect) {
    if (gameState.answeringPlayer === 1) gameState.p1Score++;
    if (gameState.answeringPlayer === 2) gameState.p2Score++;
    finishVSQuestion(true);
  } else {
    if (gameState.answeringPlayer === 1) gameState.p1Attempted = true;
    if (gameState.answeringPlayer === 2) gameState.p2Attempted = true;

    if (gameState.p1Attempted && gameState.p2Attempted) {
      finishVSQuestion(false);
    } else {
      alert("不正解！ 相手プレイヤーに解答権が移ります。");
      updateVSButtonStates();
      startVSTimers();
    }
  }
}

function finishVSQuestion(isCorrect) {
  clearInterval(vsMainTimer);
  if (isCorrect) {
    const pName = gameState.answeringPlayer === 1 ? "1P" : "2P";
    document.getElementById("result-status").innerText = `⭕ ${pName} 正解！ (+1 Point)`;
    document.getElementById("result-status").style.color = (gameState.answeringPlayer === 1) ? "#ef4444" : "#3b82f6";
  } else {
    document.getElementById("result-status").innerText = "❌ 全員不正解...";
    document.getElementById("result-status").style.color = "#f87171";
  }

  const vsInfo = document.getElementById("vs-answer-info");
  vsInfo.classList.remove("hidden");
  
  if (isCorrect) {
    document.getElementById("vs-answer-player").innerText = gameState.answeringPlayer === 1 ? "1P (赤)" : "2P (青)";
    document.getElementById("vs-answer-time").innerText = `${gameState.answerTimeSec} 秒`;
  } else {
    document.getElementById("vs-answer-player").innerText = "なし";
    document.getElementById("vs-answer-time").innerText = "-";
  }

  document.getElementById("detail-title").innerText = gameState.currentSong.title;
  document.getElementById("detail-producer").innerText = gameState.currentSong.producer;
  document.getElementById("detail-year").innerText = gameState.currentSong.year + "年";

  showScreen("answer-screen");
}

document.getElementById("next-question-btn").addEventListener("click", () => {
  gameState.currentIndex++;
  if (gameState.currentIndex < gameState.questions.length) {
    if (gameState.mode === "vs") {
      showScreen("vs-game-screen");
      loadVSQuestion();
    } else if (gameState.mode === "multi") {
      showScreen("game-screen");
      loadMultiQuestion();
    } else {
      showScreen("game-screen");
      loadQuestion();
    }
  } else {
    if (gameState.mode === "vs") {
      showVSSubmittal();
    } else {
      if (gameState.mode === "timeattack") {
        clearInterval(gameState.timerInterval);
        gameState.taTotalTimeMs = Date.now() - gameState.elapsedStartTime;
        handleTimeAttackFinish();
      } else {
        document.getElementById("time-attack-result").classList.add("hidden");
      }
      document.getElementById("final-score").innerText = gameState.score;
      document.getElementById("final-total").innerText = gameState.questions.length;
      document.getElementById("vs-final-result").classList.add("hidden");
      document.getElementById("solo-final-result").classList.remove("hidden");
      showScreen("final-screen");
    }
  }
});

function showVSSubmittal() {
  document.getElementById("solo-final-result").classList.add("hidden");
  document.getElementById("time-attack-result").classList.add("hidden");

  const vsFinalArea = document.getElementById("vs-final-result");
  vsFinalArea.classList.remove("hidden");

  document.getElementById("vs-final-p1-score").innerText = gameState.p1Score;
  document.getElementById("vs-final-p2-score").innerText = gameState.p2Score;

  const winnerText = document.getElementById("vs-winner-text");
  if (gameState.p1Score > gameState.p2Score) {
    winnerText.innerText = "🏆 WINNER: 1P !";
    winnerText.style.color = "#ef4444";
  } else if (gameState.p2Score > gameState.p1Score) {
    winnerText.innerText = "🏆 WINNER: 2P !";
    winnerText.style.color = "#3b82f6";
  } else {
    winnerText.innerText = "🤝 DRAW (引き分け)";
    winnerText.style.color = "#f59e0b";
  }
  showScreen("final-screen");
}

function handleTimeAttackFinish() {
  const totalMs = gameState.taTotalTimeMs;
  document.getElementById("time-attack-result").classList.remove("hidden");
  document.getElementById("final-clear-time").innerText = formatTime(totalMs);

  const key = getRankingKey();
  const rawData = localStorage.getItem(key);
  let ranks = rawData ? JSON.parse(rawData) : [];

  ranks.push({ timeMs: totalMs, date: new Date().toLocaleDateString() });
  ranks.sort((a, b) => a.timeMs - b.timeMs);

  const rankIndex = ranks.findIndex(item => item.timeMs === totalMs);
  if (rankIndex >= 0 && rankIndex < 3) {
    document.getElementById("new-record-badge").classList.remove("hidden");
  } else {
    document.getElementById("new-record-badge").classList.add("hidden");
  }

  ranks = ranks.slice(0, 3);
  localStorage.setItem(key, JSON.stringify(ranks));
}

document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  updateRankingDisplay();
  showScreen("menu-screen");
});

// 管理者メニュー操作
const adminMsg = document.getElementById("admin-msg");
const addTitleInput = document.getElementById("add-title");

document.getElementById("open-admin-btn").addEventListener("click", () => {
  adminMsg.classList.add("hidden");
  renderSongList();
  updateAdminSongCount();
  showScreen("admin-screen");
});

document.getElementById("close-admin-btn").addEventListener("click", () => {
  showScreen("menu-screen");
});

if (addTitleInput) {
  addTitleInput.addEventListener("input", () => {
    const title = addTitleInput.value.trim();
    if (title === "") {
      adminMsg.classList.add("hidden");
      return;
    }
    const isDuplicate = songDatabase.some(song => song.title.toLowerCase() === title.toLowerCase());
    if (isDuplicate) {
      adminMsg.innerText = "⚠️ この楽曲は既に登録されています！";
      adminMsg.className = "message error";
      adminMsg.classList.remove("hidden");
    } else {
      adminMsg.classList.add("hidden");
    }
  });
}

document.getElementById("add-song-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = addTitleInput.value.trim();
  const producer = document.getElementById("add-producer").value.trim();
  const year = parseInt(document.getElementById("add-year").value, 10);
  const hallOfFame = document.getElementById("add-halloffame").checked;

  const parseText = (id) => document.getElementById(id).value.split(/\r?\n|\r/).map(s => s.trim()).filter(s => s.length > 0);

  const newSong = { title, producer, year, hallOfFame, lyrics: { intro: parseText("add-intro"), chorus: parseText("add-chorus"), prechorus: parseText("add-prechorus") } };

  try {
    await addDoc(collection(db, SONGS_COLLECTION), newSong);
    adminMsg.innerText = `✅ 「${title}」をFirestoreへ追加しました！`;
    adminMsg.className = "message success";
    adminMsg.classList.remove("hidden");
    document.getElementById("add-song-form").reset();
  } catch (error) {
    console.error(error);
    alert("追加に失敗しました。");
  }
});

function renderSongList() {
  const container = document.getElementById("song-list-container");
  if (!container) return;
  container.innerHTML = "";

  const sortSelect = document.getElementById("admin-sort-select");
  const sortType = sortSelect ? sortSelect.value : "default";

  let displaySongs = songDatabase.map((song, index) => ({ song, originalIndex: index }));

  if (sortType === "title") {
    displaySongs.sort((a, b) => (a.song.title || "").localeCompare(b.song.title || "", "ja"));
  } else if (sortType === "producer") {
    displaySongs.sort((a, b) => (a.song.producer || "").localeCompare(b.song.producer || "", "ja"));
  }

  displaySongs.forEach(({ song, originalIndex }) => {
    const item = document.createElement("div");
    item.className = "song-item";
    item.innerHTML = `🎵 <strong>${song.title}</strong> (${song.producer || 'ボカロP未設定'})`;
    item.addEventListener("click", () => openEditScreen(originalIndex));
    container.appendChild(item);
  });
}

const adminSortSelect = document.getElementById("admin-sort-select");
if (adminSortSelect) adminSortSelect.addEventListener("change", renderSongList);

function openEditScreen(index) {
  currentEditingIndex = index;
  const song = songDatabase[index];

  document.getElementById("edit-title").value = song.title;
  document.getElementById("edit-producer").value = song.producer || "";
  document.getElementById("edit-year").value = song.year || 2011;
  document.getElementById("edit-halloffame").checked = !!song.hallOfFame;

  document.getElementById("edit-intro").value = song.lyrics?.intro ? song.lyrics.intro.join("\n") : "";
  document.getElementById("edit-chorus").value = song.lyrics?.chorus ? song.lyrics.chorus.join("\n") : "";
  document.getElementById("edit-prechorus").value = song.lyrics?.prechorus ? song.lyrics.prechorus.join("\n") : "";

  showScreen("edit-song-screen");
}

document.getElementById("cancel-edit-btn").addEventListener("click", () => showScreen("admin-screen"));

document.getElementById("edit-song-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentEditingIndex === null) return;
  const targetSong = songDatabase[currentEditingIndex];

  const parseText = (id) => document.getElementById(id).value.split(/\r?\n|\r/).map(s => s.trim()).filter(s => s.length > 0);

  const updatedData = {
    title: document.getElementById("edit-title").value.trim(),
    producer: document.getElementById("edit-producer").value.trim(),
    year: parseInt(document.getElementById("edit-year").value, 10),
    hallOfFame: document.getElementById("edit-halloffame").checked,
    lyrics: { intro: parseText("edit-intro"), chorus: parseText("edit-chorus"), prechorus: parseText("edit-prechorus") }
  };

  try {
    if (targetSong.id) {
      await updateDoc(doc(db, SONGS_COLLECTION, targetSong.id), updatedData);
    }
    alert(`「${updatedData.title}」の情報を更新しました！`);
    showScreen("admin-screen");
  } catch (error) {
    console.error(error);
    alert("更新に失敗しました。");
  }
});

const deleteModal = document.getElementById("delete-modal");
document.getElementById("open-delete-modal-btn").addEventListener("click", () => {
  if (currentEditingIndex === null) return;
  document.getElementById("delete-target-title").innerText = songDatabase[currentEditingIndex].title;
  deleteModal.classList.remove("hidden");
});

document.getElementById("cancel-delete-btn").addEventListener("click", () => deleteModal.classList.add("hidden"));

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (currentEditingIndex === null) return;
  const targetSong = songDatabase[currentEditingIndex];

  try {
    if (targetSong.id) await deleteDoc(doc(db, SONGS_COLLECTION, targetSong.id));
    deleteModal.classList.add("hidden");
    alert(`「${targetSong.title}」を削除しました。`);
    showScreen("admin-screen");
  } catch (error) {
    console.error(error);
    alert("削除に失敗しました。");
  }
});

// ================== カゲプロ隠しページ機能 ==================

document.getElementById("secret-trigger-text").addEventListener("click", () => {
  document.getElementById("kagepro-pass-input").value = "";
  document.getElementById("kagepro-auth-error").classList.add("hidden");
  showScreen("kagepro-auth-screen");
});

document.getElementById("kagepro-auth-back").addEventListener("click", () => showScreen("admin-screen"));

document.getElementById("kagepro-go-btn").addEventListener("click", verifyKageproPassword);
document.getElementById("kagepro-pass-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") verifyKageproPassword();
});

function verifyKageproPassword() {
  if (document.getElementById("kagepro-pass-input").value.trim() === "0815") {
    document.getElementById("kagepro-auth-error").classList.add("hidden");
    showScreen("kagepro-menu-screen");
  } else {
    document.getElementById("kagepro-auth-error").classList.remove("hidden");
  }
}

document.getElementById("kagepro-open-admin-btn").addEventListener("click", () => {
  document.getElementById("kagepro-admin-pass-input").value = "";
  document.getElementById("kagepro-admin-auth-error").classList.add("hidden");
  document.getElementById("kagepro-admin-auth-modal").classList.remove("hidden");
});

document.getElementById("kagepro-admin-auth-cancel").addEventListener("click", () => {
  document.getElementById("kagepro-admin-auth-modal").classList.add("hidden");
});

document.getElementById("kagepro-admin-auth-submit").addEventListener("click", verifyKageproAdminPassword);
document.getElementById("kagepro-admin-pass-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") verifyKageproAdminPassword();
});

function verifyKageproAdminPassword() {
  if (document.getElementById("kagepro-admin-pass-input").value.trim() === "0430") {
    document.getElementById("kagepro-admin-auth-modal").classList.add("hidden");
    document.getElementById("kagepro-admin-msg").classList.add("hidden");
    renderKageproList();
    showScreen("kagepro-admin-screen");
  } else {
    document.getElementById("kagepro-admin-auth-error").classList.remove("hidden");
  }
}

document.getElementById("kagepro-close-admin-btn").addEventListener("click", () => {
  showScreen("kagepro-menu-screen");
});

const addIs3Choice = document.getElementById("kagepro-add-is-3choice");
const addSingleGroup = document.getElementById("kagepro-add-single-answer-group");
const add3ChoiceGroup = document.getElementById("kagepro-add-3choice-group");

addIs3Choice.addEventListener("change", () => {
  if (addIs3Choice.checked) {
    addSingleGroup.classList.add("hidden");
    add3ChoiceGroup.classList.remove("hidden");
  } else {
    addSingleGroup.classList.remove("hidden");
    add3ChoiceGroup.classList.add("hidden");
  }
});

const editIs3Choice = document.getElementById("kagepro-edit-is-3choice");
const editSingleGroup = document.getElementById("kagepro-edit-single-answer-group");
const edit3ChoiceGroup = document.getElementById("kagepro-edit-3choice-group");

editIs3Choice.addEventListener("change", () => {
  if (editIs3Choice.checked) {
    editSingleGroup.classList.add("hidden");
    edit3ChoiceGroup.classList.remove("hidden");
  } else {
    editSingleGroup.classList.remove("hidden");
    edit3ChoiceGroup.classList.add("hidden");
  }
});

document.getElementById("kagepro-add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = document.getElementById("kagepro-add-question").value.trim();
  const hint = document.getElementById("kagepro-add-hint").value.trim();
  const is3Choice = addIs3Choice.checked;

  let newQ = { question, hint, is3Choice };

  if (is3Choice) {
    const c1 = document.getElementById("kagepro-add-choice1").value.trim();
    const c2 = document.getElementById("kagepro-add-choice2").value.trim();
    const c3 = document.getElementById("kagepro-add-choice3").value.trim();
    if (!c1 || !c2 || !c3) {
      alert("選択肢を3つすべて入力してください。");
      return;
    }
    newQ.choices = [c1, c2, c3];
  } else {
    const answer = document.getElementById("kagepro-add-answer").value.trim();
    if (!answer) {
      alert("解答を入力してください。");
      return;
    }
    newQ.answer = answer;
  }

  try {
    await addDoc(collection(db, KAGEPRO_COLLECTION), newQ);
    const msgElem = document.getElementById("kagepro-admin-msg");
    msgElem.innerText = "✅ 問題を登録しました！";
    msgElem.className = "message success";
    msgElem.classList.remove("hidden");
    document.getElementById("kagepro-add-form").reset();
    addSingleGroup.classList.remove("hidden");
    add3ChoiceGroup.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("登録に失敗しました。");
  }
});

document.getElementById("kagepro-start-btn").addEventListener("click", () => {
  if (kageproDatabase.length === 0) {
    alert("問題が登録されていません。");
    return;
  }
  kageproGameState.questions = [...kageproDatabase].sort(() => Math.random() - 0.5);
  kageproGameState.currentIndex = 0;
  kageproGameState.score = 0;

  showScreen("kagepro-game-screen");
  loadKageproQuestion();
});

const kageproShowHintBtn = document.getElementById("kagepro-show-hint-btn");
if (kageproShowHintBtn) {
  kageproShowHintBtn.addEventListener("click", () => {
    const hintDisplay = document.getElementById("kagepro-hint-display");
    const hintText = kageproGameState.currentQ?.hint;
    if (hintText && hintText.trim() !== "") {
      hintDisplay.innerText = hintText;
    } else {
      hintDisplay.innerText = "ヒントはありません";
    }
    hintDisplay.classList.remove("hidden");
    kageproShowHintBtn.classList.add("hidden");
  });
}

function loadKageproQuestion() {
  const current = kageproGameState.questions[kageproGameState.currentIndex];
  kageproGameState.currentQ = current;

  document.getElementById("kagepro-progress").innerText = `第 ${kageproGameState.currentIndex + 1} / ${kageproGameState.questions.length} 問`;
  document.getElementById("kagepro-lyrics-box").innerHTML = `<div class="lyric-line">${current.question}</div>`;

  const hintDisplay = document.getElementById("kagepro-hint-display");
  const kageproShowHintBtn = document.getElementById("kagepro-show-hint-btn");
  if (hintDisplay) {
    hintDisplay.innerText = "";
    hintDisplay.classList.add("hidden");
  }
  if (kageproShowHintBtn) {
    kageproShowHintBtn.classList.remove("hidden");
    kageproShowHintBtn.disabled = false;
  }

  const textInputArea = document.getElementById("kagepro-text-input-area");
  const choiceArea = document.getElementById("kagepro-3choice-area");

  if (current.is3Choice) {
    textInputArea.classList.add("hidden");
    choiceArea.classList.remove("hidden");

    const container = document.getElementById("kagepro-choices-container");
    container.innerHTML = "";

    const choicesObj = current.choices.map((txt, idx) => ({ text: txt, isCorrect: idx === 0 }));
    kageproGameState.shuffledChoices = choicesObj.sort(() => Math.random() - 0.5);

    kageproGameState.shuffledChoices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "btn kagepro-btn-primary";
      btn.innerText = choice.text;
      btn.onclick = () => finishKageproQuestion(choice.isCorrect);
      container.appendChild(btn);
    });

  } else {
    choiceArea.classList.add("hidden");
    textInputArea.classList.remove("hidden");
    document.getElementById("kagepro-solo-input").value = "";
  }
}

document.getElementById("kagepro-solo-submit-btn").addEventListener("click", handleKageproAnswer);
document.getElementById("kagepro-solo-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleKageproAnswer();
});

function handleKageproAnswer() {
  const input = document.getElementById("kagepro-solo-input").value.trim().toLowerCase();
  const correct = kageproGameState.currentQ.answer.trim().toLowerCase();
  const isCorrect = input !== "" && (correct.includes(input) || input.includes(correct));
  finishKageproQuestion(isCorrect);
}

document.getElementById("kagepro-pass-btn").addEventListener("click", () => finishKageproQuestion(false));
document.getElementById("kagepro-pass-btn-3choice").addEventListener("click", () => finishKageproQuestion(false));

function finishKageproQuestion(isCorrect) {
  if (isCorrect) {
    kageproGameState.score++;
    document.getElementById("kagepro-result-status").innerText = "⭕ 正解！";
  } else {
    document.getElementById("kagepro-result-status").innerText = "❌ 不正解...";
  }

  const q = kageproGameState.currentQ;
  const correctAnswerText = q.is3Choice ? q.choices[0] : q.answer;
  document.getElementById("kagepro-detail-title").innerText = correctAnswerText;

  showScreen("kagepro-answer-screen");
}

document.getElementById("kagepro-next-question-btn").addEventListener("click", () => {
  kageproGameState.currentIndex++;
  if (kageproGameState.currentIndex < kageproGameState.questions.length) {
    showScreen("kagepro-game-screen");
    loadKageproQuestion();
  } else {
    document.getElementById("kagepro-final-score").innerText = kageproGameState.score;
    document.getElementById("kagepro-final-total").innerText = kageproGameState.questions.length;
    showScreen("kagepro-final-screen");
  }
});

document.getElementById("kagepro-back-to-menu-btn").addEventListener("click", () => showScreen("kagepro-menu-screen"));
document.getElementById("kagepro-quit-btn").addEventListener("click", () => {
  if (confirm("クイズを中断してメニューに戻りますか？")) {
    showScreen("kagepro-menu-screen");
  }
});

function renderKageproList() {
  const container = document.getElementById("kagepro-list-container");
  if (!container) return;
  container.innerHTML = "";

  if (kageproDatabase.length === 0) {
    container.innerHTML = '<p style="color:#000; font-size:0.85rem;">登録されている問題がありません。</p>';
    return;
  }

  kageproDatabase.forEach((q, index) => {
    const item = document.createElement("div");
    item.className = "song-item";
    item.style.background = "#fff";
    item.style.borderColor = "#000";
    item.style.color = "#000";

    const ansDisplay = q.is3Choice ? `[3択] 正解: ${q.choices[0]}` : `[入力] 答: ${q.answer}`;
    item.innerHTML = `❓ <strong>Q. ${q.question}</strong> (${ansDisplay})`;

    item.addEventListener("click", () => openKageproEditScreen(index));
    container.appendChild(item);
  });
}

function openKageproEditScreen(index) {
  currentKageproEditingIndex = index;
  const q = kageproDatabase[index];

  document.getElementById("kagepro-edit-question").value = q.question;
  document.getElementById("kagepro-edit-hint").value = q.hint || "";

  if (q.is3Choice) {
    editIs3Choice.checked = true;
    editSingleGroup.classList.add("hidden");
    edit3ChoiceGroup.classList.remove("hidden");
    document.getElementById("kagepro-edit-choice1").value = q.choices ? q.choices[0] : "";
    document.getElementById("kagepro-edit-choice2").value = q.choices ? q.choices[1] : "";
    document.getElementById("kagepro-edit-choice3").value = q.choices ? q.choices[2] : "";
  } else {
    editIs3Choice.checked = false;
    editSingleGroup.classList.remove("hidden");
    edit3ChoiceGroup.classList.add("hidden");
    document.getElementById("kagepro-edit-answer").value = q.answer || "";
  }

  showScreen("kagepro-edit-screen");
}

document.getElementById("kagepro-cancel-edit-btn").addEventListener("click", () => showScreen("kagepro-admin-screen"));

document.getElementById("kagepro-edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (currentKageproEditingIndex === null) return;

  const target = kageproDatabase[currentKageproEditingIndex];
  const is3Choice = editIs3Choice.checked;

  let updated = {
    question: document.getElementById("kagepro-edit-question").value.trim(),
    hint: document.getElementById("kagepro-edit-hint").value.trim(),
    is3Choice
  };

  if (is3Choice) {
    const c1 = document.getElementById("kagepro-edit-choice1").value.trim();
    const c2 = document.getElementById("kagepro-edit-choice2").value.trim();
    const c3 = document.getElementById("kagepro-edit-choice3").value.trim();
    if (!c1 || !c2 || !c3) {
      alert("選択肢を3つすべて入力してください。");
      return;
    }
    updated.choices = [c1, c2, c3];
  } else {
    const answer = document.getElementById("kagepro-edit-answer").value.trim();
    if (!answer) {
      alert("解答を入力してください。");
      return;
    }
    updated.answer = answer;
  }

  try {
    if (target.id) {
      await updateDoc(doc(db, KAGEPRO_COLLECTION, target.id), updated);
    }
    alert("問題を更新しました！");
    showScreen("kagepro-admin-screen");
  } catch (err) {
    console.error(err);
    alert("更新に失敗しました。");
  }
});

const kageproDeleteModal = document.getElementById("kagepro-delete-modal");
document.getElementById("kagepro-open-delete-modal-btn").addEventListener("click", () => {
  kageproDeleteModal.classList.remove("hidden");
});

document.getElementById("kagepro-cancel-delete-btn").addEventListener("click", () => {
  kageproDeleteModal.classList.add("hidden");
});

document.getElementById("kagepro-confirm-delete-btn").addEventListener("click", async () => {
  if (currentKageproEditingIndex === null) return;
  const target = kageproDatabase[currentKageproEditingIndex];

  try {
    if (target.id) await deleteDoc(doc(db, KAGEPRO_COLLECTION, target.id));
    kageproDeleteModal.classList.add("hidden");
    alert("問題を削除しました。");
    showScreen("kagepro-admin-screen");
  } catch (err) {
    console.error(err);
    alert("削除に失敗しました。");
  }
});

// 初期化実行
setupRealtimeSongListener();
setupRealtimeKageproListener();
