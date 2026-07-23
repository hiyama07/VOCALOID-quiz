// Firebase SDKの読み込み（バージョンを統一して安定化）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 発行された設定キー
const firebaseConfig = {
  apiKey: "AIzaSyD9MGcLh2z_cc0qoug2SZSpKeNX4bAH02s",
  authDomain: "vocaloid-quiz-5005f.firebaseapp.com",
  projectId: "vocaloid-quiz-5005f",
  storageBucket: "vocaloid-quiz-5005f.firebasestorage.app",
  messagingSenderId: "671477870013",
  appId: "1:671477870013:web:ce2275e9cbb11560cb76d4"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SONGS_COLLECTION = "songs";

// デフォルト楽曲（修正版）
const defaultSongs = [
  {
    title: "メルト",
    producer: "ryo",
    year: 2009,
    hallOfFame: true,
    lyrics: {
      intro: ["朝 目が覚めて", "真っ先に思い浮かぶ", "君のこと"],
      chorus: ["メルト 溶けてしまいそう", "好きだなんて絶対に言えない", "だけど メルト", "目も合わせられない"],
      prechorus: ["お願い時間を止めて", "泣きそうなの", "でも嬉しくて", "死んでしまうわ！"]
    }
  },
  {
    title: "千本桜",
    producer: "黒うさP",
    year: 2011,
    hallOfFame: true,
    lyrics: {
      intro: ["大胆不敵にハイカラ革命", "磊々落々反戦国家", "日の丸印の二輪車転がし", "悪霊退散 ICBM"],
      chorus: ["千本桜 夜ニ紛レ", "君ノ声モ届カナイヨ", "此処は宴 鋼の檻", "その断頭台で見下ろして"],
      prechorus: ["環状線を走り抜けて", "東奔西走なんのその 少年少女戦国無双浮世の随に"]
    }
  },
  {
    title: "カゲロウデイズ",
    producer: "じん",
    year: 2011,
    hallOfFame: true,
    lyrics: {
      intro: ["8月15日の午後12時半くらいのこと", "天気が良い", "病気になりそうなほど眩しい日差しの中", "することも無いから君と駄弁っていた"],
      chorus: ["バッと通ったトラックが", "君を轢きずって泣き叫ぶ", "血飛沫の色", "君の香りと混ざり合ってむせ返った", "嘘みたいな陽炎が", "「嘘じゃないぞ」って嗤ってる"],
      prechorus: ["何度世界が眩んでも", "陽炎が嗤って奪い去る", "繰り返して何十年。", "もうとっくに気が付いていたろ。", "こんなよくある話なら", "結末はきっと1つだけ。", "繰り返した夏の日の向こう。"]
    }
  }
];

// 状態管理
let songs = [];
let currentQuizList = [];
let currentQuestionIndex = 0;
let score = 0;
let currentPhraseIndex = 0;
let autoPhraseInterval = null;
let soloTimeLeft = 15;
let soloTimerInterval = null;

// DOM要素
const screens = {
  menu: document.getElementById('menu-screen'),
  game: document.getElementById('game-screen'),
  answer: document.getElementById('answer-screen'),
  final: document.getElementById('final-screen'),
  admin: document.getElementById('admin-screen')
};

// 画面切り替え
function showScreen(targetScreen) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  targetScreen.classList.add('active');
}

// データベースから楽曲を取得（データが無い場合は初期化）
async function loadSongsFromFirebase() {
  try {
    const querySnapshot = await getDocs(collection(db, SONGS_COLLECTION));
    songs = [];
    querySnapshot.forEach((doc) => {
      songs.push({ id: doc.id, ...doc.data() });
    });

    if (songs.length === 0) {
      for (const song of defaultSongs) {
        const docRef = await addDoc(collection(db, SONGS_COLLECTION), song);
        songs.push({ id: docRef.id, ...song });
      }
    }
  } catch (error) {
    console.error("データ取得エラー:", error);
    alert("データの読み込みに失敗しました。ページを再読み込みしてください。");
  }
}

// 初期化処理
async function init() {
  await loadSongsFromFirebase();
  setupEventListeners();
}

// イベントリスナー設定
function setupEventListeners() {
  document.getElementById('category-select').addEventListener('change', (e) => {
    const eraGroup = document.getElementById('era-group');
    if (e.target.value === 'era') {
      eraGroup.classList.remove('hidden');
    } else {
      eraGroup.classList.add('hidden');
    }
  });

  document.getElementById('start-btn').addEventListener('click', startQuiz);

  document.getElementById('open-admin-btn').addEventListener('click', () => {
    renderAdminSongList();
    showScreen(screens.admin);
  });

  document.getElementById('close-admin-btn').addEventListener('click', () => {
    showScreen(screens.menu);
  });

  document.getElementById('add-song-form').addEventListener('submit', handleAddSong);
  document.getElementById('next-phrase-btn').addEventListener('click', showNextPhrase);

  document.getElementById('solo-submit-btn').addEventListener('click', handleSoloSubmit);
  document.getElementById('solo-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSoloSubmit();
  });
  document.getElementById('pass-btn').addEventListener('click', handlePass);

  document.getElementById('buzzer-btn').addEventListener('click', handleBuzzer);
  document.getElementById('next-question-btn').addEventListener('click', nextQuestion);
  document.getElementById('back-to-menu-btn').addEventListener('click', () => showScreen(screens.menu));
  document.getElementById('quit-btn').addEventListener('click', () => {
    clearInterval(autoPhraseInterval);
    clearInterval(soloTimerInterval);
    showScreen(screens.menu);
  });
}

// クイズ開始
function startQuiz() {
  const category = document.getElementById('category-select').value;
  const era = document.getElementById('era-select').value;
  const count = parseInt(document.getElementById('count-select').value);

  let filtered = [...songs];

  if (category === 'halloffame') {
    filtered = filtered.filter(s => s.hallOfFame);
  } else if (category === 'era') {
    filtered = filtered.filter(s => {
      const y = s.year;
      if (era === '~2011') return y <= 2011;
      if (era === '2012~2015') return y >= 2012 && y <= 2015;
      if (era === '2016~2018') return y >= 2016 && y <= 2018;
      if (era === '2019~2021') return y >= 2019 && y <= 2021;
      if (era === '2022~') return y >= 2022;
      return true;
    });
  }

  if (filtered.length === 0) {
    alert('条件に一致する楽曲がありません。設定を変更してください。');
    return;
  }

  filtered.sort(() => Math.random() - 0.5);
  currentQuizList = filtered.slice(0, Math.min(count, filtered.length));
  currentQuestionIndex = 0;
  score = 0;

  showScreen(screens.game);
  loadQuestion();
}

// 問題の読み込み
function loadQuestion() {
  clearInterval(autoPhraseInterval);
  clearInterval(soloTimerInterval);

  const currentSong = currentQuizList[currentQuestionIndex];
  const part = document.getElementById('part-select').value;
  const phraseMode = document.getElementById('phrase-mode-select').value;
  const playerMode = document.getElementById('player-mode-select').value;

  document.getElementById('question-progress').textContent = `第 ${currentQuestionIndex + 1} / ${currentQuizList.length} 問`;
  
  const lyricsBox = document.getElementById('lyrics-box');
  lyricsBox.innerHTML = '';
  currentPhraseIndex = 0;

  const phrases = currentSong.lyrics && currentSong.lyrics[part] ? currentSong.lyrics[part] : ["（該当パートの歌詞が未登録です）"];

  const appendPhrase = (text) => {
    const p = document.createElement('p');
    p.className = 'lyric-line';
    p.textContent = text;
    lyricsBox.appendChild(p);
  };

  appendPhrase(phrases[0]);

  const manualNextWrapper = document.getElementById('manual-next-wrapper');
  if (phraseMode === 'manual' && phrases.length > 1) {
    manualNextWrapper.classList.remove('hidden');
  } else {
    manualNextWrapper.classList.add('hidden');
  }

  if (phraseMode === 'auto' && phrases.length > 1) {
    autoPhraseInterval = setInterval(() => {
      currentPhraseIndex++;
      if (currentPhraseIndex < phrases.length) {
        appendPhrase(phrases[currentPhraseIndex]);
      } else {
        clearInterval(autoPhraseInterval);
      }
    }, 15000);
  }

  const soloArea = document.getElementById('solo-answer-area');
  const multiArea = document.getElementById('multi-answer-area');
  const choicesBox = document.getElementById('choices-box');
  const buzzerBtn = document.getElementById('buzzer-btn');
  const timerDisplay = document.getElementById('timer-display');

  if (playerMode === 'solo') {
    soloArea.classList.remove('hidden');
    multiArea.classList.add('hidden');
    document.getElementById('solo-input').value = '';

    soloTimeLeft = 15;
    timerDisplay.textContent = soloTimeLeft;
    soloTimerInterval = setInterval(() => {
      soloTimeLeft--;
      timerDisplay.textContent = soloTimeLeft;
      if (soloTimeLeft <= 0) {
        clearInterval(soloTimerInterval);
        showAnswer(false);
      }
    }, 1000);

  } else {
    soloArea.classList.add('hidden');
    multiArea.classList.remove('hidden');
    choicesBox.classList.add('hidden');
    buzzerBtn.classList.remove('hidden');
    timerDisplay.textContent = '--';
  }
}

function showNextPhrase() {
  const currentSong = currentQuizList[currentQuestionIndex];
  const part = document.getElementById('part-select').value;
  const phrases = (currentSong.lyrics && currentSong.lyrics[part]) || [];

  currentPhraseIndex++;
  if (currentPhraseIndex < phrases.length) {
    const lyricsBox = document.getElementById('lyrics-box');
    const p = document.createElement('p');
    p.className = 'lyric-line';
    p.textContent = phrases[currentPhraseIndex];
    lyricsBox.appendChild(p);
  }

  if (currentPhraseIndex >= phrases.length - 1) {
    document.getElementById('manual-next-wrapper').classList.add('hidden');
  }
}

function handleSoloSubmit() {
  const input = document.getElementById('solo-input').value.trim();
  const currentSong = currentQuizList[currentQuestionIndex];
  const isCorrect = input.toLowerCase() === currentSong.title.toLowerCase();
  showAnswer(isCorrect);
}

function handlePass() {
  showAnswer(false);
}

function handleBuzzer() {
  document.getElementById('buzzer-btn').classList.add('hidden');
  const choicesBox = document.getElementById('choices-box');
  choicesBox.classList.remove('hidden');

  const currentSong = currentQuizList[currentQuestionIndex];
  let dummySongs = songs.filter(s => s.id !== currentSong.id);
  dummySongs.sort(() => Math.random() - 0.5);

  let choices = [currentSong];
  if (dummySongs.length > 0) choices.push(dummySongs[0]);
  if (dummySongs.length > 1) choices.push(dummySongs[1]);

  choices.sort(() => Math.random() - 0.5);

  const btns = choicesBox.querySelectorAll('.choice-btn');
  btns.forEach((btn, idx) => {
    if (choices[idx]) {
      btn.style.display = 'block';
      btn.textContent = choices[idx].title;
 
