// 初期サンプル楽曲データ
const defaultSongs = [  {
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
      intro: ["エマージェンシー","0時 奴らは","クレイジー・インザ・タウン","家に篭って ゴロゴロゴロゴロと",
"堕落の夜に絡みついた"],
      chorus: ["引き籠り 絶対 ジャスティス","俺の私だけの折 の中で",
"聴き殺してランデブー","俺の私の音が君に染まるまで"],
      prechorus: ["相も変わらずJamる街","止まぬNervous に 拐われないで"]
    }
  }
];

// ローカルストレージからの読み込み
let songDatabase = JSON.parse(localStorage.getItem("vocaloid_quiz_songs")) || defaultSongs;

function saveDatabase() {
  localStorage.setItem("vocaloid_quiz_songs", JSON.stringify(songDatabase));
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
  mode: "solo", // solo | multi
  phraseMode: "auto", // auto | manual
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

  // フィルタリング処理
  let filtered = songDatabase.filter(song => {
    // パートの歌詞が存在するかチェック
    if (!song.lyrics[part] || song.lyrics[part].length === 0) return false;

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
    return true; // "all"
  });

  if (filtered.length === 0) {
    alert("条件に一致する曲が登録されていません。別の条件を選ぶか曲を追加してください。");
    return;
  }

  // ランダムシャッフルして指定問題数抽出
  filtered.sort(() => Math.random() - 0.5);
  const questions = filtered.slice(0, Math.min(count, filtered.length));

  // ゲーム状態初期化
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

  // 進捗更新
  document.getElementById("question-progress").innerText = 
    `第 ${gameState.currentIndex + 1} / ${gameState.questions.length} 問`;

  // UIリセット
  document.getElementById("lyrics-box").innerHTML = "";
  document.getElementById("solo-input").value = "";

  if (gameState.mode === "multi") {
    document.getElementById("buzzer-btn").classList.remove("hidden");
    document.getElementById("choices-box").classList.add("hidden");
  }

  // 1行目のフレーズ表示
  addNextPhrase();

  // 自動モードの場合はタイマー開始
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
        // 全フレーズ表示済みの場合はタイマー停止
        clearInterval(gameState.timerInterval);
      }
    }
  }, 1000);
}

// 手動で次のフレーズを表示
document.getElementById("next-phrase-btn").addEventListener("click", () => {
  addNextPhrase();
});

// ---- 1人モード：回答処理 ----
document.getElementById("solo-submit-btn").addEventListener("click", handleSoloAnswer);
document.getElementById("solo-input").addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSoloAnswer();
});

function handleSoloAnswer() {
  const input = document.getElementById("solo-input").value.trim().toLowerCase();
  const correct = gameState.currentSong.title.trim().toLowerCase();

  // 簡易判定（完全一致または部分一致の柔軟判定）
  const isCorrect = input !== "" && (correct.includes(input) || input.includes(correct));
  finishQuestion(isCorrect);
}

// ---- 複数人モード：早押し・選択肢処理 ----
document.getElementById("buzzer-btn").addEventListener("click", () => {
  clearInterval(gameState.timerInterval); // タイマー一時停止
  document.getElementById("buzzer-btn").classList.add("hidden");

  // 正解＋ダミー2つの選択肢を作成
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

  // シャッフル
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

// パスボタン
document.getElementById("pass-btn").addEventListener("click", () => {
  finishQuestion(false, true);
});

// ---- 正解判定＆画面遷移 ----
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

  // 正解情報表示
  document.getElementById("detail-title").innerText = gameState.currentSong.title;
  document.getElementById("detail-producer").innerText = gameState.currentSong.producer;
  document.getElementById("detail-year").innerText = gameState.currentSong.year + "年";

  showScreen("answer");
}

// 次の問題へ
document.getElementById("next-question-btn").addEventListener("click", () => {
  gameState.currentIndex++;
  if (gameState.currentIndex < gameState.questions.length) {
    showScreen("game");
    loadQuestion();
  } else {
    // 最終判定画面
    document.getElementById("final-score").innerText = gameState.score;
    document.getElementById("final-total").innerText = gameState.questions.length;
    showScreen("final");
  }
});

// メニューへ戻る
document.getElementById("back-to-menu-btn").addEventListener("click", () => {
  showScreen("menu");
});

// ---- 管理者メニュー機能 ----
const adminScreen = document.getElementById("admin-screen");
const adminMsg = document.getElementById("admin-msg");

document.getElementById("open-admin-btn").addEventListener("click", () => {
  adminMsg.classList.add("hidden");
  showScreen("admin");
});

document.getElementById("close-admin-btn").addEventListener("click", () => {
  showScreen("menu");
});

// 曲の重複チェック＆追加処理
document.getElementById("add-song-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const title = document.getElementById("add-title").value.trim();
  const producer = document.getElementById("add-producer").value.trim();
  const year = parseInt(document.getElementById("add-year").value, 10);
  const hallOfFame = document.getElementById("add-halloffame").checked;

  const parseText = (id) => document.getElementById(id).value.split("\n").map(s => s.trim()).filter(s => s.length > 0);

  const intro = parseText("add-intro");
  const chorus = parseText("add-chorus");
  const prechorus = parseText("add-prechorus");

  // 重複チェック (タイトル名で判定)
  const isDuplicate = songDatabase.some(song => song.title.toLowerCase() === title.toLowerCase());

  if (isDuplicate) {
    adminMsg.innerText = "⚠️ 既に追加済みです！別の曲名を入力してください。";
    adminMsg.className = "message error";
    adminMsg.classList.remove("hidden");
    return;
  }

  // 追加オブジェクト作成
  const newSong = {
    title,
    producer,
    year,
    hallOfFame,
    lyrics: {
      intro,
      chorus,
      prechorus
    }
  };

  songDatabase.push(newSong);
  saveDatabase();

  adminMsg.innerText = `✅ 「${title}」を新たに追加しました！`;
  adminMsg.className = "message success";
  adminMsg.classList.remove("hidden");

  // フォーム初期化
  document.getElementById("add-song-form").reset();
});
