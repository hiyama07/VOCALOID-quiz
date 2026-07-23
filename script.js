// Firebase SDKの読み込み
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

// デフォルト楽曲（データベースが空の時に自動登録されます）
const defaultSongs = [
  {
    title: "メルト",
    producer: "ryo",
    year: 2007,
    hallOfFame: true,
    lyrics: {
      intro: ["朝 目が覚めて", "真っ先に思い浮かぶ", "君のこと"],
      chorus: ["メルト 溶けてしまいそう", "好きだなんて絶対に言えない", "だけど メルト", "目も合わせられない"],
      prechorus: ["天気予報が 嘘をついた", "土砂降りの雨が降る"]
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
      prechorus: ["百戦錬磨の見た目は将校", "いざ往かん 宴の夜"]
    }
  },
  {
    title: "カゲロウデイズ",
    producer: "じん",
    year: 2011,
    hallOfFame: true,
    lyrics: {
      intro: ["8月1日の午後12時半くらいのこと", "天気が良い", "病みそうなくらい眩しい日差しの中"],
      chorus: ["「まあ、夢なら覚めたね」と小さく呟いた", "だけど、それじゃああまりに味気ない"],
      prechorus: ["バッサリ切られた影の合間を", "グラグラ揺れる日炎の中"]
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

// データベースから楽曲を取得（無ければ初期データを送信）
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
    alert("データの読み込みに失敗しました。設定を確認してください。");
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
   
