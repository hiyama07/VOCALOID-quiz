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

let songDatabase = [];
let currentEditingIndex = null;

// Firestore リアルタイム同期
function setupRealtimeSongListener() {
  const songsRef = collection(db, SONGS_COLLECTION);

  onSnapshot(songsRef, async (snapshot) => {
    songDatabase = [];
    snapshot.forEach((docSnap) => {
      songDatabase.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    if (songDatabase.length === 0 && snapshot.empty) {
      for (const song of defaultSongs) {
        await addDoc(songsRef, song);
      }
      return;
    }

    updateAdminSongCount();
    renderSongList();
  }, (error) => {
    console.error("Firestoreリアルタイム同期エラー:", error);
  });
}

// ゲーム状態管理
let gameState = {
  questions: [],
  currentIndex: 0,
  score: 0,
  currentSong: null,
  currentPhrases: [],
  displayedPhraseCount: 0,
  timerInterval: null,
  timeLeft: 15,
  mode: "solo", // "solo" | "multi" | "vs" | "timeattack"
  phraseMode: "auto",
  selectedPart: "intro",
  // タイムアタック・対戦用経過タイマー
  elapsedStartTime: 0,
  elapsedPausedTime: 0,
  taTotalTimeMs: 0,
  // 2人対戦(VS)用データ
  p1Score: 0,
  p2Score: 0,
  questionStartTime: 0,
  answeringPlayer: null, // 1 | 2
  p1Attempted: false,
  p2Attempted: false,
  answerTimeSec: "0.00",
  isPaused: false
};

// 画面切り替え処理
function showScreen(screenId) {
  const allScreens = document.querySelectorAll(".screen");
  allScreens.forEach(screen => screen.classList.remove("active"));

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");
  }

  const container = document.querySelector(".container");
  if (screenId === "vs-game-screen") {
    container.classList.add("landscape-mode");
  } else {
    container.classList.remove("landscape-mode");
  }
}

// UIエレメント参照
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

    if (category === "halloffame") {
      return song.hallOfFame;
    } else if (category === "era") {
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
    li.innerHTML = `
      <span class="ranking-rank">${idx + 1}位</span>
      <span class="ranking-time">${formatTime(item.timeMs)}</span>
    `;
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

// 汎用3択選択肢生成関数
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

// スタートボタン処理
document.getElementById("start-btn").addEventListener("click", () => {
  const part = partSelect.value;
  const phraseMode = document.getElementById("phrase-mode-select").value;
  const playerMode = playerModeSelect.value;
  
  const selectedCount = parseInt(countSelect.value, 10);
  const count = (playerMode === "timeattack") ? 50 : selectedCount;

  const filtered = getFilteredSongs();

  if (filtered.length === 0) {
    alert("条件に一致する曲が登録されていません。別の条件を選ぶか曲を追加してください。");
    return;
  }

  const questions = generateQuestionPool(filtered, count);

  gameState.questions = questions;
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
    loadQuestion();
  }
});

// VS準備OKボタン
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
    soloInputArea.classList.add("hidden");
    multiBuzzArea.classList.remove("hidden");
  } else {
    soloInputArea.classList.remove("hidden");
    multiBuzzArea.classList.add("hidden");
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

// --- 通常 (1人・複数人早押し) クイズ処理 ---
function loadQuestion() {
  if (gameState.mode !== "timeattack") {
    clearInterval(gameState.timerInterval);
  }
  
  const current = gameState.questions[gameState.currentIndex];
  gameState.currentSong = current;
  gameState.currentPhrases = current.lyrics[gameState.selectedPart];
  gameState.displayedPhraseCount = 0;

  let progressText = `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;

  document.getElementById("question-progress").innerText = progressText;
  document.getElementById("lyrics-box").innerHTML = "";
  document.getElementById("solo-input").value = "";

  if (gameState.mode === "multi") {
    const multiBtn = document.getElementById("multi-buzz-btn");
    multiBtn.disabled = false;
    multiBtn.innerText = "PUSH!! (早押し)";
    document.getElementById("multi-choice-modal").classList.add("hidden");
  }

  addNextPhrase();

  if (gameState.phraseMode === "auto" && gameState.mode !== "timeattack") {
    startTimer();
  }
}

// 複数人モード：早押しボタン押下時の処理
document.getElementById("multi-buzz-btn").addEventListener("click", () => {
  if (gameState.phraseMode === "auto") {
    clearInterval(gameState.timerInterval);
  }

  document.getElementById("multi-buzz-btn").disabled = true;
  document.getElementById("multi-buzz-btn").innerText = "回答中...";

  setupMultiChoicesModal();
});

function setupMultiChoicesModal() {
  const modal = document.getElementById("multi-choice-modal");
  const container = document.getElementById("multi-choices-container");
  container.innerHTML = "";

  const choices = create3Choices(gameState.currentSong.title);
  choices.forEach(optText => {
    const btn = document.createElement("button");
    btn.className = "btn secondary";
    btn.style.padding = "0.85rem";
    btn.innerText = optText;

    btn.onclick = () => {
      modal.classList.add("hidden");
      const isCorrect = (optText === gameState.currentSong.title);
      
      if (isCorrect) {
        finishQuestion(true);
      } else {
        alert("不正解！ボタンが復帰します。");
        document.getElementById("multi-buzz-btn").disabled = false;
        document.getElementById("multi-buzz-btn").innerText = "PUSH!! (早押し)";
        if (gameState.phraseMode === "auto") {
          startTimer();
        }
      }
    };
    container.appendChild(btn);
  });

  modal.classList.remove("hidden");
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

document.getElementById("pass-btn").addEventListener("click", () => {
  finishQuestion(false, true);
});

function finishQuestion(isCorrect, isPass = false) {
  if (gameState.mode !== "timeattack") {
    clearInterval(gameState.timerInterval);
  }

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

// --- ⚔️ 2人対戦モード (VS) 処理 ---
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
  const p1Btn = document.getElementById("vs-p1-btn");
  const p2Btn = document.getElementById("vs-p2-btn");

  p1Btn.disabled = gameState.p1Attempted;
  p2Btn.disabled = gameState.p2Attempted;
}

function startVSTimers() {
  clearInterval(vsMainTimer);
  gameState.timeLeft = 15;

  const stopwatchElem = document.getElementById("vs-stopwatch-display");
  const nextPhraseElem = document.getElementById("vs-next-phrase-timer");

  nextPhraseElem.innerText = gameState.timeLeft;

  vsMainTimer = setInterval(() => {
    if (gameState.isPaused) return;

    // 1. ストップウォッチ（全体の経過時間）
    const elapsed = Date.now() - gameState.elapsedStartTime;
    stopwatchElem.innerText = formatTime(elapsed);

    // 2. 自動進行フレーズタイマー
    if (gameState.phraseMode === "auto") {
      const secElapsed = Math.floor(elapsed / 1000);
      const remainingSec = 15 - (secElapsed % 15);
      
      nextPhraseElem.innerText = remainingSec;

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

// 一時中断(ポーズ)処理
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
    btn.style.width = "100%";
    btn.style.padding = "0.8rem";
    btn.innerText = optText;

    btn.onclick = () => {
      const isCorrect = (optText === gameState.currentSong.title);
      handleVSAnswerResult(isCorrect);
    };
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
      alert(`不正解！ 相手プレイヤーに解答権が移ります。`);
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
    document.getElementById("result-status").innerText = `❌ 全員不正解...`;
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
  const timeAttackResultArea = document.getElementById("time-attack-result");
  const clearTimeDisplay = document.getElementById("final-clear-time");
  const newRecordBadge = document.getElementById("new-record-badge");

  timeAttackResultArea.classList.remove("hidden");
  clearTimeDisplay.innerText = formatTime(totalMs);

  const key = getRankingKey();
  const rawData = localStorage.getItem(key);
  let ranks = rawData ? JSON.parse(rawData) : [];

  ranks.push({ timeMs: totalMs, date: new Date().toLocaleDateString() });
  ranks.sort((a, b) => a.timeMs - b.timeMs);

  const rankIndex = ranks.findIndex(item => item.timeMs === totalMs);
  if (rankIndex >= 0 && rankIndex < 3) {
    newRecordBadge.classList.remove("hidden");
  } else {
    newRecordBadge.classList.add("hidden");
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

document.getElementById("add-song-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = addTitleInput.value.trim();
  const producer = document.getElementById("add-producer").value.trim();
  const year = parseInt(document.getElementById("add-year").value, 10);
  const hallOfFame = document.getElementById("add-halloffame").checked;

  const parseText = (id) => document.getElementById(id).value.split(/\r?\n|\r/).map(s => s.trim()).filter(s => s.length > 0);

  const intro = parseText("add-intro");
  const chorus = parseText("add-chorus");
  const prechorus = parseText("add-prechorus");

  const isDuplicate = songDatabase.some(song => song.title.toLowerCase() === title.toLowerCase());

  if (isDuplicate) {
    adminMsg.innerText = "⚠️ 既に追加済みです！別の曲名を入力してください。";
    adminMsg.className = "message error";
    adminMsg.classList.remove("hidden");
    return;
  }

  const newSong = { title, producer, year, hallOfFame, lyrics: { intro, chorus, prechorus } };

  try {
    await addDoc(collection(db, SONGS_COLLECTION), newSong);

    adminMsg.innerText = `✅ 「${title}」をFirestoreへ追加しました！`;
    adminMsg.className = "message success";
    adminMsg.classList.remove("hidden");

    document.getElementById("add-song-form").reset();
  } catch (error) {
    console.error("追加エラー:", error);
    alert("データの追加に失敗しました。");
  }
});

function renderSongList() {
  const container = document.getElementById("song-list-container");
  if (!container) return;
  container.innerHTML = "";

  songDatabase.forEach((song, index) => {
    const item = document.createElement("div");
    item.className = "song-item";
    item.style.cursor = "pointer";
    item.innerHTML = `🎵 <strong>${song.title}</strong> (${song.producer || 'ボカロP未設定'})`;
    
    item.addEventListener("click", () => {
      openEditScreen(index);
    });

    container.appendChild(item);
  });
}

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

document.getElementById("cancel-edit-btn").addEventListener("click", () => {
  showScreen("admin-screen");
});

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
    lyrics: {
      intro: parseText("edit-intro"),
      chorus: parseText("edit-chorus"),
      prechorus: parseText("edit-prechorus")
    }
  };

  try {
    if (targetSong.id) {
      const songRef = doc(db, SONGS_COLLECTION, targetSong.id);
      await updateDoc(songRef, updatedData);
    }
    alert(`「${updatedData.title}」の情報を更新しました！`);
    showScreen("admin-screen");
  } catch (error) {
    console.error("更新エラー:", error);
    alert("データの更新に失敗しました。");
  }
});

const deleteModal = document.getElementById("delete-modal");

document.getElementById("open-delete-modal-btn").addEventListener("click", () => {
  if (currentEditingIndex === null) return;
  const song = songDatabase[currentEditingIndex];
  document.getElementById("delete-target-title").innerText = song.title;
  deleteModal.classList.remove("hidden");
});

document.getElementById("cancel-delete-btn").addEventListener("click", () => {
  deleteModal.classList.add("hidden");
});

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (currentEditingIndex === null) return;
  const targetSong = songDatabase[currentEditingIndex];

  try {
    if (targetSong.id) {
      await deleteDoc(doc(db, SONGS_COLLECTION, targetSong.id));
    }

    deleteModal.classList.add("hidden");
    alert(`「${targetSong.title}」を削除しました。`);
    showScreen("admin-screen");
  } catch (error) {
    console.error("削除エラー:", error);
    alert("データの削除に失敗しました。");
  }
});

setupRealtimeSongListener();
