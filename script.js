import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc 
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

    // 初期楽曲がデータベースに不足している場合は補填
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

const screens = {
  menu: document.getElementById("menu-screen"),
  game: document.getElementById("game-screen"),
  answer: document.getElementById("answer-screen"),
  final: document.getElementById("final-screen"),
  admin: document.getElementById("admin-screen")
};

function showScreen(screenKey) {
  Object.values(screens).forEach(screen => screen.classList.remove("active"));
  screens[screenKey].classList.add("active");
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
  showScreen("game");
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
    showScreen("menu");
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

  showScreen("answer");
}

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

document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  showScreen("menu");
});

// 管理者メニュー操作
const adminMsg = document.getElementById("admin-msg");
const addTitleInput = document.getElementById("add-title");

// 管理者メニューを開く
document.getElementById("open-admin-btn").addEventListener("click", () => {
  adminMsg.classList.add("hidden");
  renderSongList();
  showScreen("admin");
});

// 管理者メニューから「戻る」ボタン
document.getElementById("close-admin-btn").addEventListener("click", () => {
  showScreen("menu");
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

// 管理者画面の曲一覧描画（初期曲含む全件が表示されます）
function renderSongList() {
  const container = document.getElementById("song-list-container");
  if (!container) return;
  container.innerHTML = "";

  songDatabase.forEach((song, index) => {
    const item = document.createElement("details");
    item.className = "song-item";

    const introText = (song.lyrics && song.lyrics.intro) ? song.lyrics.intro.join("\n") : "";
    const chorusText = (song.lyrics && song.lyrics.chorus) ? song.lyrics.chorus.join("\n") : "";
    const prechorusText = (song.lyrics && song.lyrics.prechorus) ? song.lyrics.prechorus.join("\n") : "";

    item.innerHTML = `
      <summary>
        🎵 ${song.title} (${song.producer || 'ボカロP未設定'})
      </summary>
      <div class="edit-form-content">
        <label>タイトル:
          <input type="text" id="edit-title-${index}" value="${song.title}">
        </label>
        <label>ボカロP:
          <input type="text" id="edit-producer-${index}" value="${song.producer || ''}">
        </label>
        <label>投稿年:
          <input type="number" id="edit-year-${index}" value="${song.year || 2011}">
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="edit-halloffame-${index}" ${song.hallOfFame ? 'checked' : ''}> 殿堂入り
        </label>
        <label>歌い始め歌詞 (改行区切り):
          <textarea id="edit-intro-${index}" rows="3">${introText}</textarea>
        </label>
        <label>サビ歌詞 (改行区切り):
          <textarea id="edit-chorus-${index}" rows="3">${chorusText}</textarea>
        </label>
        <label>ラスサビ前歌詞 (改行区切り):
          <textarea id="edit-prechorus-${index}" rows="3">${prechorusText}</textarea>
        </label>
        <button id="save-btn-${index}" class="btn primary small-btn">変更を保存</button>
      </div>
    `;

    container.appendChild(item);

    document.getElementById(`save-btn-${index}`).addEventListener("click", () => {
      updateSong(index);
    });
  });
}

// データ更新処理
async function updateSong(index) {
  const targetSong = songDatabase[index];
  const parseText = (id) => document.getElementById(id).value.split(/\r?\n|\r/).map(s => s.trim()).filter(s => s.length > 0);

  const updatedTitle = document.getElementById(`edit-title-${index}`).value.trim();
  const updatedProducer = document.getElementById(`edit-producer-${index}`).value.trim();
  const updatedYear = parseInt(document.getElementById(`edit-year-${index}`).value, 10);
  const updatedHallOfFame = document.getElementById(`edit-halloffame-${index}`).checked;

  if (!updatedTitle) {
    alert("タイトルを入力してください");
    return;
  }

  const updatedData = {
    title: updatedTitle,
    producer: updatedProducer,
    year: updatedYear,
    hallOfFame: updatedHallOfFame,
    lyrics: {
      intro: parseText(`edit-intro-${index}`),
      chorus: parseText(`edit-chorus-${index}`),
      prechorus: parseText(`edit-prechorus-${index}`)
    }
  };

  try {
    if (targetSong.id) {
      const songRef = doc(db, SONGS_COLLECTION, targetSong.id);
      await updateDoc(songRef, updatedData);
    }
    songDatabase[index] = { id: targetSong.id, ...updatedData };
    alert(`「${updatedTitle}」の情報を更新しました！`);
    renderSongList();
  } catch (error) {
    console.error("更新エラー:", error);
    alert("データの更新に失敗しました。");
  }
}

// 起動時にデータ読み込み実行
loadSongsFromFirebase();
