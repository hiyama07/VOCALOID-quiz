// --- グローバル変数・データ管理 ---
// 登録された楽曲の管理用配列（実運用時はFirebase等と同期）
let songsData = [
  { id: 1, title: "メルト", artist: "ryo" },
  { id: 2, title: "千本桜", artist: "黒うさP" },
  { id: 3, title: "マトリョシカ", artist: "ハチ" },
  { id: 4, title: "カゲロウデイズ", artist: "じん" },
  { id: 5, title: "ワールドイズマイン", artist: "ryo" }
];

// --- 画面切替共通処理 ---
function showScreen(screenId) {
  const container = document.querySelector('.container');
  
  // すべての画面から active クラスを削除
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  // 対象の画面に active クラスを付与
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }

  // VSモード（2人対戦）の時だけ横長デザインにする
  if (screenId === 'vs-game-screen') {
    container.classList.add('landscape-mode');
  } else {
    container.classList.remove('landscape-mode');
  }
}

// --- 管理者画面の楽曲リスト描画関数 ---
function renderAdminSongList(songs) {
  const listEl = document.getElementById("admin-song-list");
  if (!listEl) return;

  listEl.innerHTML = ""; // 初期化

  if (songs.length === 0) {
    listEl.innerHTML = '<li style="text-align:center; color:#64748b; font-size:0.85rem; padding:1rem;">登録楽曲がありません</li>';
    return;
  }

  songs.forEach(song => {
    const li = document.createElement("li");
    li.className = "admin-song-item";
    li.innerHTML = `
      <div class="admin-song-info">
        <span class="admin-song-title">${song.title}</span>
        <span class="admin-song-artist">P: ${song.artist}</span>
      </div>
    `;
    listEl.appendChild(li);
  });
}

// --- ダミーのクイズ開始処理 ---
function initGame() {
  const lyricsBox = document.getElementById('lyrics-box');
  const vsLyricsBox = document.getElementById('vs-lyrics-box');

  const sampleLyric = '<div class="lyric-line">🎵 歌詞データ読み込み完了（テスト表示）</div>';

  if (lyricsBox) lyricsBox.innerHTML = sampleLyric;
  if (vsLyricsBox) vsLyricsBox.innerHTML = sampleLyric;
}

// --- 初期化 & イベント登録 ---
document.addEventListener("DOMContentLoaded", () => {

  // 1. 管理者メニューを開く
  const openAdminBtn = document.getElementById("open-admin-btn");
  if (openAdminBtn) {
    openAdminBtn.addEventListener("click", () => {
      showScreen("admin-screen");
      renderAdminSongList(songsData); // 管理者画面を開いた時にリスト描画
    });
  }

  // 2. 管理者メニューを閉じる（メニューに戻る）
  const closeAdminBtn = document.getElementById("close-admin-btn");
  if (closeAdminBtn) {
    closeAdminBtn.addEventListener("click", () => {
      showScreen("menu-screen");
    });
  }

  // 3. ゲームスタートボタン
  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const modeSelect = document.getElementById("player-mode-select");
      const selectedMode = modeSelect ? modeSelect.value : "solo";

      // 選択したモードに応じて画面を切り替え
      if (selectedMode === "vs") {
        showScreen("vs-game-screen");
      } else {
        showScreen("game-screen");
      }

      // クイズ画面初期化
      initGame();
    });
  }

  // 4. ゲーム中断ボタン（通常 & VS）
  const quitBtn = document.getElementById("quit-btn");
  if (quitBtn) {
    quitBtn.addEventListener("click", () => {
      showScreen("menu-screen");
    });
  }

  const vsQuitBtn = document.getElementById("vs-quit-btn");
  if (vsQuitBtn) {
    vsQuitBtn.addEventListener("click", () => {
      showScreen("menu-screen");
    });
  }

  // 5. カテゴリーの「年代別」選択時に年代枠を表示
  const categorySelect = document.getElementById("category-select");
  const eraGroup = document.getElementById("era-group");
  if (categorySelect && eraGroup) {
    categorySelect.addEventListener("change", (e) => {
      if (e.target.value === "era") {
        eraGroup.classList.remove("hidden");
      } else {
        eraGroup.classList.add("hidden");
      }
    });
  }

  // 6. プレイヤーモードに応じた入力域の表示切替
  const playerModeSelect = document.getElementById("player-mode-select");
  const soloArea = document.getElementById("solo-answer-input-area");
  const multiArea = document.getElementById("multi-answer-buzz-area");

  if (playerModeSelect) {
    playerModeSelect.addEventListener("change", (e) => {
      const mode = e.target.value;
      if (mode === "multi") {
        if (soloArea) soloArea.classList.add("hidden");
        if (multiArea) multiArea.classList.remove("hidden");
      } else {
        if (soloArea) soloArea.classList.remove("hidden");
        if (multiArea) multiArea.classList.add("hidden");
      }
    });
  }

  // 7. ボカロP順に並べ替えボタン
  const sortArtistBtn = document.getElementById("sort-artist-btn");
  if (sortArtistBtn) {
    sortArtistBtn.addEventListener("click", () => {
      const sorted = [...songsData].sort((a, b) => 
        a.artist.localeCompare(b.artist, "ja")
      );
      renderAdminSongList(sorted);
    });
  }

  // 8. 曲名順に並べ替えボタン
  const sortTitleBtn = document.getElementById("sort-title-btn");
  if (sortTitleBtn) {
    sortTitleBtn.addEventListener("click", () => {
      const sorted = [...songsData].sort((a, b) => 
        a.title.localeCompare(b.title, "ja")
      );
      renderAdminSongList(sorted);
    });
  }

  // 9. 楽曲追加フォーム送信時の処理
  const songForm = document.getElementById("song-form");
  if (songForm) {
    songForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const titleInput = document.getElementById("song-title");
      const artistInput = document.getElementById("song-artist");

      if (titleInput && artistInput) {
        const newSong = {
          id: Date.now(),
          title: titleInput.value,
          artist: artistInput.value
        };
        songsData.push(newSong);
        renderAdminSongList(songsData);
        
        // フォームリセット
        songForm.reset();
        alert("楽曲を追加しました！");
      }
    });
  }
});
