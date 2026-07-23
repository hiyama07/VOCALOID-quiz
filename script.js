// 1. Firebase SDKの読み込み（CDN形式）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc,
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
let editingSongId = null; // 現在編集中の楽曲ID

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
  Object.values(screens).forEach(screen => screen?.classList.remove("active"));
  if (screens[screenKey]) {
    screens[screenKey].classList.add("active");
  }
  if (screenKey === "admin") {
    renderAdminSongList();
  }
}

// Firestoreからデータを読み込む関数
async function loadSongsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, SONGS_COLLECTION));
    songDatabase = [];
    querySnapshot.forEach((docSnap) => {
      songDatabase.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (songDatabase.length === 0) {
      for (const song of defaultSongs) {
        const docRef = await addDoc(collection(db, SONGS_COLLECTION), song);
        songDatabase.push({ id: docRef.id, ...song });
      }
    }
    renderAdminSongList();
  } catch (error) {
    console.error("Firebaseデータ取得エラー:", error);
    alert("データの読み込みに失敗しました。");
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

// ---- カテゴリー・年代連動 ----
const categorySelect = document.getElementById("category-select");
const eraGroup = document.getElementById("era-group");

if (categorySelect) {
  categorySelect.addEventListener("change", () => {
    if (categorySelect.value === "era") {
      eraGroup.classList.remove("hidden");
    } else {
      eraGroup.classList.add("hidden");
    }
  });
}

// ---- ナビゲーションボタンイベント ----
document.getElementById("open-admin-btn")?.addEventListener("click", () => showScreen("admin"));
document.getElementById("admin-back-btn")?.addEventListener("click", () => showScreen("menu"));
document.getElementById("back-to-menu-btn")?.addEventListener("click", () => showScreen("menu"));

// ---- ゲーム開始処理 ----
document.getElementById("start-btn")?.addEventListener("click", () => {
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
  gameState.currentPhrases = current.lyrics[gameState.selectedPart] || [];
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

// 手動ボタン・パス・中断処理
document.getElementById("next-phrase-btn")?.addEventListener("click", addNextPhrase);
document.getElementById("pass-btn")?.addEventListener("click", () => finishQuestion(false));
document.getElementById("quit-btn")?.addEventListener("click", () => {
  if (confirm("クイズを中断してメニューに戻りますか？")) {
    clearInterval(gameState.timerInterval);
    showScreen("menu");
  }
});

// ---- 1人モード：回答処理 ----
document.getElementById("solo-submit-btn")?.addEventListener("click", handleSoloAnswer);
document.getElementById("solo-input")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSoloAnswer();
});

function handleSoloAnswer() {
  const input = document.getElementById("solo-input").value.trim().toLowerCase();
  const correct = gameState.currentSong.title.trim().toLowerCase();

  const isCorrect = input !== "" && (correct.includes(input) || input.includes(correct));
  finishQuestion(isCorrect);
}

// ---- 複数人モード：早押し・選択肢処理 ----
document.getElementById("buzzer-btn")?.addEventListener("click", () => {
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
      btn.innerText = options[idx];
      btn.style.display = "inline-block";
      btn.onclick = () => finishQuestion(options[idx] === correctTitle);
    } else {
      btn.style.display = "none";
    }
  });
});

// ---- 解答判定・判定画面の表示 ----
function finishQuestion(isCorrect) {
  clearInterval(gameState.timerInterval);

  if (isCorrect) {
    gameState.score++;
  }

  // HTMLのIDに合わせてセット
  document.getElementById("result-status").innerText = isCorrect ? "⭕ 正解！" : "❌ 不正解...";
  document.getElementById("detail-title").innerText = gameState.currentSong.title;
  document.getElementById("detail-producer").innerText = gameState.currentSong.producer;
  document.getElementById("detail-year").innerText = `${gameState.currentSong.year} 年`;

  showScreen("answer");
}

// 次の問題へ進むボタン
document.getElementById("next-question-btn")?.addEventListener("click", () => {
  gameState.currentIndex++;
  if (gameState.currentIndex < gameState.questions.length) {
    showScreen("game");
    loadQuestion();
  } else {
    showFinalResults();
  }
});

// 最終結果画面表示
function showFinalResults() {
  document.getElementById("final-score").innerText = gameState.score;
  document.getElementById("final-total").innerText = gameState.questions.length;
  showScreen("final");
}

// ---- 管理者画面：楽曲一覧レンダリング ----
function renderAdminSongList() {
  const container = document.getElementById("admin-song-list");
  if (!container) return;

  container.innerHTML = "";
  songDatabase.forEach((song) => {
    const item = document.createElement("div");
    item.className = "admin-song-item";
    item.style.cssText = "padding: 8px; border-bottom: 1px solid #ccc; cursor: pointer; display: flex; justify-content: space-between; align-items: center;";
    item.innerHTML = `
      <span><strong>${song.title}</strong> / ${song.producer} (${song.year}年)</span>
      <button class="btn secondary small-btn">編集</button>
    `;
    item.addEventListener("click", () => populateFormForEdit(song));
    container.appendChild(item);
  });
}

// 編集フォームにデータをセット
function populateFormForEdit(song) {
  editingSongId = song.id;
  document.getElementById("form-title").innerText = "✏️ 楽曲を編集";
  document.getElementById("add-title").value = song.title;
  document.getElementById("add-producer").value = song.producer;
  document.getElementById("add-year").value = song.year;
  document.getElementById("add-halloffame").checked = !!song.hallOfFame;

  document.getElementById("add-intro").value = (song.lyrics?.intro || []).join("\n");
  document.getElementById("add-prechorus").value = (song.lyrics?.prechorus || []).join("\n");
  document.getElementById("add-chorus").value = (song.lyrics?.chorus || []).join("\n");

  document.getElementById("delete-song-btn").classList.remove("hidden");
}

// フォームのリセット（新規登録状態に戻す）
document.getElementById("reset-form-btn")?.addEventListener("click", resetForm);

function resetForm() {
  editingSongId = null;
  document.getElementById("form-title").innerText = "➕ 新しい楽曲を追加";
  document.getElementById("add-song-form").reset();
  document.getElementById("delete-song-btn").classList.add("hidden");
}

// ---- 管理者画面：楽曲保存（追加・更新） ----
document.getElementById("save-song-btn")?.addEventListener("click", async () => {
  const title = document.getElementById("add-title").value.trim();
  const producer = document.getElementById("add-producer").value.trim();
  const year = parseInt(document.getElementById("add-year").value, 10);
  const hallOfFame = document.getElementById("add-halloffame").checked;

  if (!title || !producer || isNaN(year)) {
    alert("曲名、ボカロP、投稿年は必須項目です。");
    return;
  }

  // テキストエリアの改行区切りを配列に変換
  const parseLyrics = (id) => document.getElementById(id).value.split("\n").map(l => l.trim()).filter(l => l !== "");

  const songData = {
    title,
    producer,
    year,
    hallOfFame,
    lyrics: {
      intro: parseLyrics("add-intro"),
      prechorus: parseLyrics("add-prechorus"),
      chorus: parseLyrics("add-chorus")
    }
  };

  try {
    if (editingSongId) {
      await updateDoc(doc(db, SONGS_COLLECTION, editingSongId), songData);
      alert("楽曲情報を更新しました！");
    } else {
      await addDoc(collection(db, SONGS_COLLECTION), songData);
      alert("新しい楽曲を追加しました！");
    }
    resetForm();
    await loadSongsFromFirebase();
  } catch (error) {
    console.error("保存エラー:", error);
    alert("データの保存に失敗しました。");
  }
});

// ---- 管理者画面：楽曲削除 ----
document.getElementById("delete-song-btn")?.addEventListener("click", async () => {
  if (!editingSongId) return;

  if (confirm("この楽曲を本当に削除しますか？")) {
    try {
      await deleteDoc(doc(db, SONGS_COLLECTION, editingSongId));
      alert("楽曲を削除しました。");
      resetForm();
      await loadSongsFromFirebase();
    } catch (error) {
      console.error("削除エラー:", error);
      alert("データの削除に失敗しました。");
    }
  }
});

// ---- 起動時初期化処理 ----
document.addEventListener("DOMContentLoaded", () => {
  loadSongsFromFirebase();
});
