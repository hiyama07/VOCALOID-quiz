import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
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
let currentEditingIndex = null; // 現在編集中の楽曲インデックス

// Firestore から楽曲を取得（未登録の初期楽曲があれば自動補填）
async function loadSongsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, SONGS_COLLECTION));
    songDatabase = [];

    querySnapshot.forEach((docSnap) => {
      songDatabase.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    let hasAddedNew = false;
    for (const song of defaultSongs) {
      const exists = songDatabase.some(s => s.title === song.title);
      if (!exists) {
        const docRef = await addDoc(collection(db, SONGS_COLLECTION), song);
        songDatabase.push({ id: docRef.id, ...song });
        hasAddedNew = true;
      }
    }

    if (hasAddedNew) {
      console.log("初期楽曲をFirestoreへ同期しました。");
    }
  } catch (error) {
    console.error("Firestore読み込みエラー:", error);
    alert("データベースの読み込みに失敗しました。Firestoreのセキュリティルールをご確認ください。");
  }
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
  mode: "solo",
  phraseMode: "auto",
  selectedPart: "intro"
};

// 画面の切り替え処理（すべての.screen要素を非表示にして対象だけactiveにする）
function showScreen(screenId) {
  const allScreens = document.querySelectorAll(".screen");
  allScreens.forEach(screen => {
    screen.classList.remove("active");
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add("active");
  } else {
    console.error("画面が見つかりません:", screenId);
  }
}

const categorySelect = document.getElementById("category-select");
const eraGroup = document.getElementById("era-group");

categorySelect.addEventListener("change", () => {
  if (categorySelect.value === "era") {
    eraGroup.classList.remove("hidden");
  } else {
    eraGroup.classList.add("hidden");
  }
});

// スタートボタン処理
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
  showScreen("game-screen");
  loadQuestion();
});

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

document.getElementById("pass-btn").addEventListener("click", () => {
  finishQuestion(false, true);
});

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

  showScreen("answer-screen");
}

document.getElementById("next-question-btn").addEventListener("click", () => {
  gameState.currentIndex++;
  if (gameState.currentIndex < gameState.questions.length) {
    showScreen("game-screen");
    loadQuestion();
  } else {
    document.getElementById("final-score").innerText = gameState.score;
    document.getElementById("final-total").innerText = gameState.questions.length;
    showScreen("final-screen");
  }
});

document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  showScreen("menu-screen");
});

// 管理者メニュー操作
const adminMsg = document.getElementById("admin-msg");
const addTitleInput = document.getElementById("add-title");

document.getElementById("open-admin-btn").addEventListener("click", () => {
  adminMsg.classList.add("hidden");
  renderSongList();
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

// 新規追加処理
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

  const newSong = {
    title,
    producer,
    year,
    hallOfFame,
    lyrics: { intro, chorus, prechorus }
  };

  try {
    const docRef = await addDoc(collection(db, SONGS_COLLECTION), newSong);
    songDatabase.push({ id: docRef.id, ...newSong });

    adminMsg.innerText = `✅ 「${title}」をFirestoreへ追加しました！`;
    adminMsg.className = "message success";
    adminMsg.classList.remove("hidden");

    document.getElementById("add-song-form").reset();
    renderSongList();
  } catch (error) {
    console.error("追加エラー:", error);
    alert("データの追加に失敗しました。");
  }
});

// 管理者画面の曲一覧描画
function renderSongList() {
  const container = document.getElementById("song-list-container");
  if (!container) return;
  container.innerHTML = "";

  songDatabase.forEach((song, index) => {
    const item = document.createElement("div");
    item.className = "song-item";
    item.style.cursor = "pointer";
    item.innerHTML = `🎵 <strong>${song.title}</strong> (${song.producer || 'ボカロP未設定'})`;
    
    // タップ・クリックで編集専用画面に遷移
    item.addEventListener("click", () => {
      openEditScreen(index);
    });

    container.appendChild(item);
  });
}

// 楽曲編集画面を開く
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

  // 編集専用画面（edit-song-screen）を表示
  showScreen("edit-song-screen");
}

// 編集画面からのキャンセルボタン
document.getElementById("cancel-edit-btn").addEventListener("click", () => {
  showScreen("admin-screen");
});

// 編集実行（更新）
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
    songDatabase[currentEditingIndex] = { id: targetSong.id, ...updatedData };
    alert(`「${updatedData.title}」の情報を更新しました！`);
    renderSongList();
    showScreen("admin-screen");
  } catch (error) {
    console.error("更新エラー:", error);
    alert("データの更新に失敗しました。");
  }
});

// 削除モーダルダイアログの制御
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

// 本当に削除する（実行）
document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (currentEditingIndex === null) return;
  const targetSong = songDatabase[currentEditingIndex];

  try {
    if (targetSong.id) {
      await deleteDoc(doc(db, SONGS_COLLECTION, targetSong.id));
    }
    songDatabase.splice(currentEditingIndex, 1);

    deleteModal.classList.add("hidden");
    alert(`「${targetSong.title}」を削除しました。`);
    renderSongList();
    showScreen("admin-screen");
  } catch (error) {
    console.error("削除エラー:", error);
    alert("データの削除に失敗しました。");
  }
});

// 起動時にデータ読み込み実行
loadSongsFromFirebase();
