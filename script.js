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
  mode: "vs",
  selectedPart: "intro",
  p1Score: 0,
  p2Score: 0,
  questionStartTime: 0,
  answeringPlayer: null,
  p1Attempted: false,
  p2Attempted: false,
  answerTimeSec: "0.000",
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
const countSelect = document.getElementById("count-select");

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

// --- タイマー処理 ---
function startVsStopwatch() {
  gameState.questionStartTime = performance.now();
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);

  gameState.timerInterval = setInterval(() => {
    if (gameState.isPaused) return;
    const elapsedMs = performance.now() - gameState.questionStartTime;
    const formatted = (elapsedMs / 1000).toFixed(3) + "s";
    
    // VSメイン画面のストップウォッチ更新
    const swEl = document.getElementById("vs-stopwatch");
    if (swEl) swEl.textContent = formatted;

    // 3択選択モーダル内のリアルタイムタイマー更新
    const choiceSwEl = document.getElementById("vs-choice-stopwatch");
    if (choiceSwEl) choiceSwEl.textContent = formatted;
  }, 10);
}

function stopVsStopwatch() {
  clearInterval(gameState.timerInterval);
  const elapsedMs = performance.now() - gameState.questionStartTime;
  gameState.answerTimeSec = (elapsedMs / 1000).toFixed(3);
  return gameState.answerTimeSec;
}

// --- VSモード ゲーム制御 ---
function startVsGame() {
  const songs = getFilteredSongs();
  if (songs.length < 3) {
    alert("該当する楽曲が3曲以上必要です。設定を変更してください。");
    return;
  }

  const questionCount = parseInt(countSelect.value, 10) || 5;
  const shuffled = [...songs].sort(() => 0.5 - Math.random());
  gameState.questions = shuffled.slice(0, Math.min(questionCount, shuffled.length));

  gameState.currentIndex = 0;
  gameState.p1Score = 0;
  gameState.p2Score = 0;
  gameState.mode = "vs";
  gameState.selectedPart = partSelect.value;

  updateVsScores();
  showScreen("vs-game-screen");
  loadVsQuestion();
}

function updateVsScores() {
  const p1El = document.getElementById("vs-p1-score");
  const p2El = document.getElementById("vs-p2-score");
  if (p1El) p1El.textContent = `${gameState.p1Score} pt`;
  if (p2El) p2El.textContent = `${gameState.p2Score} pt`;
}

function loadVsQuestion() {
  if (gameState.currentIndex >= gameState.questions.length) {
    finishVsGame();
    return;
  }

  const song = gameState.questions[gameState.currentIndex];
  gameState.currentSong = song;
  gameState.currentPhrases = song.lyrics[gameState.selectedPart] || [];
  gameState.displayedPhraseCount = 0;
  gameState.p1Attempted = false;
  gameState.p2Attempted = false;
  gameState.answeringPlayer = null;
  gameState.isPaused = false;

  const lyricsBox = document.getElementById("vs-lyrics-box");
  if (lyricsBox) lyricsBox.innerHTML = "";

  const p1Btn = document.getElementById("vs-p1-buzz-btn");
  const p2Btn = document.getElementById("vs-p2-buzz-btn");
  if (p1Btn) p1Btn.disabled = false;
  if (p2Btn) p2Btn.disabled = false;

  const progressEl = document.getElementById("vs-progress");
  if (progressEl) progressEl.textContent = `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;

  showNextVsPhrase();
  startVsStopwatch();
}

function showNextVsPhrase() {
  if (gameState.displayedPhraseCount < gameState.currentPhrases.length) {
    const lyricsBox = document.getElementById("vs-lyrics-box");
    if (lyricsBox) {
      const line = document.createElement("div");
      line.className = "lyric-line";
      line.textContent = gameState.currentPhrases[gameState.displayedPhraseCount];
      lyricsBox.appendChild(line);
    }
    gameState.displayedPhraseCount++;
  }
}

// 1. 早押しボタンを押した時（タイマー継続）
function handleVsBuzz(player) {
  if (gameState.answeringPlayer !== null) return;
  if (player === 1 && gameState.p1Attempted) return;
  if (player === 2 && gameState.p2Attempted) return;

  gameState.answeringPlayer = player;

  const p1Btn = document.getElementById("vs-p1-buzz-btn");
  const p2Btn = document.getElementById("vs-p2-buzz-btn");
  if (p1Btn) p1Btn.disabled = true;
  if (p2Btn) p2Btn.disabled = true;

  if (player === 1) gameState.p1Attempted = true;
  if (player === 2) gameState.p2Attempted = true;

  openVsChoiceModal(player);
}

// 3択選択モーダルを表示
function openVsChoiceModal(player) {
  const modal = document.getElementById("vs-choice-modal");
  if (!modal) return;

  const playerTitle = document.getElementById("vs-modal-player-title");
  if (playerTitle) {
    playerTitle.textContent = `${player}P の解答権`;
    playerTitle.style.color = player === 1 ? "#ef4444" : "#3b82f6";
  }

  const choicesContainer = document.getElementById("vs-choices-container");
  if (choicesContainer) {
    choicesContainer.innerHTML = "";

    const correctAnswer = gameState.currentSong.title;
    const otherSongs = songDatabase.filter(s => s.title !== correctAnswer);
    const shuffledOthers = [...otherSongs].sort(() => 0.5 - Math.random());
    const dummyChoices = shuffledOthers.slice(0, 2).map(s => s.title);

    const allChoices = [correctAnswer, ...dummyChoices].sort(() => 0.5 - Math.random());

    allChoices.forEach(choiceTitle => {
      const btn = document.createElement("button");
      btn.className = "btn secondary choice-btn";
      btn.style.width = "100%";
      btn.style.marginBottom = "0.5rem";
      btn.textContent = choiceTitle;
      
      // 選択肢クリック時にタイマー計測確定
      btn.addEventListener("click", () => handleVsAnswerSelect(choiceTitle));
      choicesContainer.appendChild(btn);
    });
  }

  modal.classList.remove("hidden");
}

function closeVsChoiceModal() {
  const modal = document.getElementById("vs-choice-modal");
  if (modal) modal.classList.add("hidden");
}

// 2. 3択の回答が選択された時（タイマー確定）
function handleVsAnswerSelect(selectedTitle) {
  const finalTime = stopVsStopwatch();
  closeVsChoiceModal();

  const isCorrect = (selectedTitle === gameState.currentSong.title);
  const player = gameState.answeringPlayer;

  if (isCorrect) {
    if (player === 1) gameState.p1Score += 10;
    if (player === 2) gameState.p2Score += 10;
    updateVsScores();

    showVsResultModal(true, player, selectedTitle, finalTime);
  } else {
    if (!gameState.p1Attempted || !gameState.p2Attempted) {
      alert(`${player}P 不正解！ タイマーを再開します。`);
      gameState.answeringPlayer = null;

      const p1Btn = document.getElementById("vs-p1-buzz-btn");
      const p2Btn = document.getElementById("vs-p2-buzz-btn");
      if (p1Btn) p1Btn.disabled = gameState.p1Attempted;
      if (p2Btn) p2Btn.disabled = gameState.p2Attempted;

      startVsStopwatch();
    } else {
      showVsResultModal(false, null, selectedTitle, finalTime);
    }
  }
}

// VS結果モーダル表示
function showVsResultModal(isCorrect, winnerPlayer, selectedTitle, timeSec) {
  const resultModal = document.getElementById("vs-result-modal");
  if (!resultModal) {
    gameState.currentIndex++;
    loadVsQuestion();
    return;
  }

  const titleEl = document.getElementById("vs-result-title");
  const detailEl = document.getElementById("vs-result-detail");

  if (isCorrect) {
    if (titleEl) {
      titleEl.textContent = `🎉 ${winnerPlayer}P 正解！`;
      titleEl.style.color = winnerPlayer === 1 ? "#ef4444" : "#3b82f6";
    }
    if (detailEl) {
      detailEl.innerHTML = `
        曲名: <strong>${gameState.currentSong.title}</strong><br>
        解答確定タイム: <strong>${timeSec} 秒</strong>
      `;
    }
  } else {
    if (titleEl) {
      titleEl.textContent = "❌ 両者不正解…";
      titleEl.style.color = "#ef4444";
    }
    if (detailEl) {
      detailEl.innerHTML = `正解は <strong>${gameState.currentSong.title}</strong> でした。`;
    }
  }

  resultModal.classList.remove("hidden");
}

// VS終了画面
function finishVsGame() {
  clearInterval(gameState.timerInterval);
  showScreen("vs-final-screen");

  const p1Final = document.getElementById("vs-final-p1");
  const p2Final = document.getElementById("vs-final-p2");
  const winnerTitle = document.getElementById("vs-winner-title");

  if (p1Final) p1Final.textContent = `${gameState.p1Score} pt`;
  if (p2Final) p2Final.textContent = `${gameState.p2Score} pt`;

  if (winnerTitle) {
    if (gameState.p1Score > gameState.p2Score) {
      winnerTitle.textContent = "🏆 1P の勝利！";
      winnerTitle.style.color = "#ef4444";
    } else if (gameState.p2Score > gameState.p1Score) {
      winnerTitle.textContent = "🏆 2P の勝利！";
      winnerTitle.style.color = "#3b82f6";
    } else {
      winnerTitle.textContent = "🤝 引き分け！";
      winnerTitle.style.color = "#f59e0b";
    }
  }
}

// 管理者機能系
function updateAdminSongCount() {
  const countEl = document.getElementById("admin-song-count");
  if (countEl) countEl.textContent = songDatabase.length;
}

function renderSongList() {
  const listEl = document.getElementById("admin-song-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  songDatabase.forEach((song) => {
    const item = document.createElement("div");
    item.className = "song-item";
    item.textContent = `${song.title} / ${song.producer} (${song.year}年)`;
    listEl.appendChild(item);
  });
}

// --- イベントリスナー初期化 ---
document.addEventListener("DOMContentLoaded", () => {
  setupRealtimeSongListener();

  const startVsBtn = document.getElementById("start-vs-btn");
  if (startVsBtn) startVsBtn.addEventListener("click", startVsGame);

  const p1BuzzBtn = document.getElementById("vs-p1-buzz-btn");
  if (p1BuzzBtn) p1BuzzBtn.addEventListener("click", () => handleVsBuzz(1));

  const p2BuzzBtn = document.getElementById("vs-p2-buzz-btn");
  if (p2BuzzBtn) p2BuzzBtn.addEventListener("click", () => handleVsBuzz(2));

  const nextVsQBtn = document.getElementById("vs-next-question-btn");
  if (nextVsQBtn) {
    nextVsQBtn.addEventListener("click", () => {
      const resultModal = document.getElementById("vs-result-modal");
      if (resultModal) resultModal.classList.add("hidden");
      gameState.currentIndex++;
      loadVsQuestion();
    });
  }

  const vsRetryBtn = document.getElementById("vs-retry-btn");
  if (vsRetryBtn) {
    vsRetryBtn.addEventListener("click", () => {
      showScreen("menu-screen");
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      if (categorySelect.value === "era") {
        eraGroup.classList.remove("hidden");
      } else {
        eraGroup.classList.add("hidden");
      }
    });
  }
});
