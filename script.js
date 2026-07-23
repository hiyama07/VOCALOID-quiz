// 1. Firebase SDKの読み込み（CDN形式）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 2. Firebaseの設定キー
const firebaseConfig = {
  apiKey: "AIzaSyD9MGcLh2z_cc0qoug2SZSpKeNX4bAH02s",
  authDomain: "vocaloid-quiz-5005f.firebaseapp.com",
  projectId: "vocaloid-quiz-5005f",
  storageBucket: "vocaloid-quiz-5005f.firebasestorage.app",
  messagingSenderId: "671477870013",
  appId: "1:671477870013:web:ce2275e9cbb11560cb76d4"
};

// 3. Firebase & Firestoreの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SONGS_COLLECTION = "songs";

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

// データベース連携用の変数
let songDatabase = [];

// Firestoreからデータを読み込む関数（初回データが無い場合は初期化）
async function loadSongsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, SONGS_COLLECTION));
    songDatabase = [];
    querySnapshot.forEach((docSnap) => {
      songDatabase.push({ id: docSnap.id, ...docSnap.data() });
    });

    // 初回アクセス等でデータベースが空の場合、初期データを投入
    if (songDatabase.length === 0) {
      for (const song of defaultSongs) {
        const docRef = await addDoc(collection(db, SONGS_COLLECTION), song);
        songDatabase.push({ id: docRef.id, ...song });
      }
    }
  } catch (error) {
    console.error("Firebaseデータ取得エラー:", error);
    alert("データの読み込みに失敗しました。ページを再読み込みしてください。");
  }
}

// ゲーム状態
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
  selectedPart: "intro"
};

// DOM要素の取得
const screens = {
  menu: document.getElementById("menu-screen"),
  game: document.getElementById("game-screen"),
  answer: document.getElementById("answer-screen"),
  final: document.getElementById("final-screen"),
  admin: document.getElementById("admin-screen")
};

// 画面切替関数
function showScreen(screenKey) {
  Object.values(screens).forEach(screen => screen.classList.remove("active"));
  screens[screenKey].classList.add("active");
}

// ---- カテゴリー・年代連動 ----
const categorySelect = document.getElementById("category-select");
const eraGroup = document.getElementById("era-group");

categorySelect.addEventListener("change", () => {
  if (categorySelect.value === "era") {
    eraGroup.classList.remove("hidden");
  } else {
    eraGroup.classList.add("hidden");
  }
});

// ---- ゲーム開始処理 ----
document.getElementById("start-btn").addEventListener("click", () => {
  const category = categorySelect.value;
  const era = document.getElementById("era-select").value;
  const part = document.getElementById("part-select").value;
  const phraseMode = document.getElementById("phrase-mode-select").value;
  const playerMode = document.getElementById("player-mode-select").value;
  const count = parseInt(document.getElementById("count-select").value, 10);

  let filtered = songDatabase.filter(song => {
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

  if (filtered.length === 0) {
    alert("条件に一致する曲が登録されていません。別の条件を選ぶか曲を追加してください。");
    return;
  }

  filtered.sort(() => Math.random() - 0.5);
  const questions = filtered.slice(0, Math.min(count, filtered.length));

  gameState.questions = questions;
  gameState.currentIndex = 0;
  gameState.score = 0;
  gameState.mode = playerMode;
  gameState.phraseMode = phraseMode;
  gameState.selectedPart = part;

  setupUIForModes();
  showScreen("game");
  loadQuestion();
});

// モード別のUI調整
function setupUIForModes() {
  const soloArea = document.getElementById("solo-answer-area");
  const multiArea = document.getElementById("multi-answer-area");
  const timerDisplay = document.getElementById("timer-display");
  const manualWrapper = document.getElementById("manual-next-wrapper");

  if (gameState.mode === "solo") {
    soloArea.classList.remove("hidden");
    multiArea.classList.add("hidden");
  } else {
    soloArea.classList.add("hidden");
    multiArea.classList.remove("hidden");
    document.getElementById("buzzer-btn").classList.remove("hidden");
    document.getElementById("choices-box").classList.add("hidden");
  }

  if (gameState.phraseMode === "auto") {
    timerDisplay.classList.remove("hidden");
    manualWrapper.classList.add("hidden");
  } else {
    timerDisplay.classList.add("hidden");
    manualWrapper.classList.remove("hidden");
  }
}

// ---- 問題読み込み ----
function loadQuestion() {
  clearInterval(gameState.timerInterval);
  
  const current = gameState.questions[gameState.currentIndex];
  gameState.currentSong = current;
  gameState.currentPhrases = current.lyrics[gameState.selectedPart];
  gameState.displayedPhraseCount = 0;

  document.getElementById("question-progress").innerText = 
    `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;

  document.getElementById("lyrics-box").innerHTML = "";
  document.getElementById("solo-input").value = "";

  if (gameState.mode === "multi") {
    document.getElementById("buzzer-btn").classList.remove("hidden");
    document.getElementById("choices-box").classList.add("hidden");
  }

  addNextPhrase();

  if (gameState.phraseMode === "auto") {
    startTimer();
  }
}

// フレーズの追加表示
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

// 15秒タイマー
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

// 手動で次のフレーズを表示
document.getElementById("next-phrase-btn").addEventListener("click", () => {
  addNextPhrase();
});

// 途中でやめる処理
document.getElementById("quit-btn").addEventListener("click", () => {
  if (confirm("クイズを中断してメニューに戻りますか？")) {
    clearInterval(gameState.timerInterval);
    showScreen("menu");
  }
});

// ---- 1人モード：回答処理 ----
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

// ---- 複数人モード：早押し・選択肢処理 ----
document.getElementById("buzzer-btn").addEventListener("click", () => {
  clearInterval(gameState.timerInterval);
  document.getElementById("buzzer-btn").classList.add("hidden");

  const choicesBox = document.getElementById("choices-box");
  choicesBox.classList.remove("hidden");

  const correctTitle = gameState.currentSong.title;
  let otherSongs = songDatabase
    .map(s => s.title)
    .filter(t => t !== correctTitle)
    .sort(() => Math.random() - 0.5);

  let options = [correctTitle];
  if (otherSongs.length > 0) options.push(otherSongs[0]);
  if (otherSongs.length > 1) options.push(otherSongs[1]);

  options.sort(() => Math.random() - 0.5);

  const btns = choicesBox.querySelectorAll(".choice-btn");
  btns.forEach((btn, idx) => {
    if (options[idx]) {
      btn.style.display = "block";
      btn.innerText = options[idx];
      btn.onclick = () => {
        const isCorrect = (options[idx] === correctTitle);
        finishQuestion(isCorrect);
      };
    } else {
      btn.style.display = "none";
    }
  });
});

// パスボタン処理
document.getElementById("pass-btn").addEventListener("click", () => {
  finishQuestion(false, true);
});

// ---- 正解判定＆結果画面遷移 ----
function finishQuestion(isCorrect, isPass = false) {
  clearInterval(gameState.timerInterval);

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

  document.getElementById("detail-title").innerText = gameState.currentSong.title;
  document.getElementById("detail-producer").innerText = gameState.currentSong.producer;
  document.getElementById("detail-year").innerText = gameState.currentSong.year + "年";

  showScreen("answer");
}

// ---- 次の問題へ / 最終結果画面 ----
document.getElementById("next-question-btn").addEventListener("click", () => {
  gameState.currentIndex++;
  if (gameState.currentIndex < gameState.questions.length) {
    showScreen("game");
    loadQuestion();
  } else {
    document.getElementById("final-score").innerText = gameState.score;
    document.getElementById("final-total").innerText = gameState.questions.length;
    showScreen("final");
  }
});

// メニューに戻るボタン処理
document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  showScreen("menu");
});

// ---- 管理者機能（Firestoreへの追加・削除連携） ----
document.getElementById("open-admin-btn").addEventListener("click", () => {
  renderAdminSongList();
  showScreen("admin");
});

document.getElementById("close-admin-btn").addEventListener("click", () => {
  showScreen("menu");
});

// 楽曲追加フォーム
document.getElementById("add-song-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const parseText = (id) => {
    const val = document.getElementById(id).value.trim();
    return val ? val.split("\n").map(s => s.trim()).filter(s => s) : [];
  };

  const newSong = {
    title: document.getElementById("add-title").value.trim(),
    producer: document.getElementById("add-producer").value.trim(),
    year: parseInt(document.getElementById("add-year").value, 10),
    hallOfFame: document.getElementById("add-halloffame").checked,
    lyrics: {
      intro: parseText("add-intro"),
      chorus: parseText("add-chorus"),
      prechorus: parseText("add-prechorus")
    }
  };

  try {
    const docRef = await addDoc(collection(db, SONGS_COLLECTION), newSong);
    songDatabase.push({ id: docRef.id, ...newSong });

    const msg = document.getElementById("admin-msg");
    msg.innerText = `「${newSong.title}」を追加しました！`;
    msg.classList.remove("hidden");

    document.getElementById("add-song-form").reset();
    document.getElementById("add-year").value = 2011;
    document.getElementById("add-halloffame").checked = true;

    renderAdminSongList();

    setTimeout(() => {
      msg.classList.add("hidden");
    }, 3000);
  } catch (err) {
    console.error("楽曲追加エラー:", err);
    alert("楽曲の追加に失敗しました。");
  }
});

// 登録済み楽曲一覧の描画と削除処理
function renderAdminSongList() {
  const container = document.getElementById("song-list-container");
  container.innerHTML = "";

  if (songDatabase.length === 0) {
    container.innerHTML = '<p style="color:#94a3b8;">登録されている楽曲はありません。</p>';
    return;
  }

  songDatabase.forEach((song) => {
    const item = document.createElement("div");
    item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; background:#0f172a; border-radius:6px; margin-bottom:8px; border:1px solid #334155;";

    item.innerHTML = `
      <div>
        <strong>${song.title}</strong> / ${song.producer} (${song.year}年)
      </div>
      <button class="delete-btn" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">削除</button>
    `;

    item.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm(`「${song.title}」を削除してもよろしいですか？`)) {
        try {
          if (song.id) {
            await deleteDoc(doc(db, SONGS_COLLECTION, song.id));
          }
          songDatabase = songDatabase.filter(s => s !== song);
          renderAdminSongList();
        } catch (err) {
          console.error("削除エラー:", err);
          alert("削除に失敗しました。");
        }
      }
    });

    container.appendChild(item);
  });
}

// アプリの初期起動処理
async function init() {
  await loadSongsFromFirebase();
}

init();
