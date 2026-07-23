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
let editingSongId = null;

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
    alert("条件に一致する曲が登録されていません。別の条件を選ぶか曲を追加してください。"
