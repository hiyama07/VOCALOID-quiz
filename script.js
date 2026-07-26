// --- グローバル変数・データ管理 ---
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

// --- クイズ画面 UI初期化 & 描画処理 ---
function setupGameUI(mode) {
  const soloArea = document.getElementById("solo-answer-input-area");
  const multiArea = document.getElementById("multi-answer-buzz-area");

  if (mode === "multi") {
    if (soloArea) soloArea.classList.add("hidden");
    if (multiArea) multiArea.classList.remove("hidden");
  } else {
    // solo / timeattack など
    if (soloArea) soloArea.classList.remove("hidden");
    if (multiArea) multiArea.classList.add("hidden");
  }

  // 歌詞表示エリアの更新
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
      renderAdminSongList(songsData);
    });
  }

  // 2. 管理者メニューを閉じる
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

      if (selectedMode === "vs") {
        showScreen("vs-game-screen");
      } else {
        showScreen("game-screen");
      }

      // 選択モードに合わせてUIを表示整理
      setupGameUI(selectedMode);
    });
  }

  // 4. 中断ボタン
  const quitBtns = [document.getElementById("quit-btn"), document.getElementById("vs-quit-btn")];
  quitBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        showScreen("menu-screen");
      });
    }
  });

  // 5. カテゴリー「年代別」選択時の表示切替
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

  // 6. プレイヤーモード変更時の入力域切り替え（メニュー画面内）
  const playerModeSelect = document.getElementById("player-mode-select");
  if (playerModeSelect) {
    playerModeSelect.addEventListener("change", (e) => {
      // タイムアタックの場合の出題数固定処理などもここに追加できます
      const mode = e.target.value;
      const countSelect = document.getElementById("count-select");
      if (mode === "timeattack" && countSelect) {
        countSelect.value = "50";
      }
    });
  }

  // 7. ボカロP順ソート
  const sortArtistBtn = document.getElementById("sort-artist-btn");
  if (sortArtistBtn) {
    sortArtistBtn.addEventListener("click", () => {
      const sorted = [...songsData].sort((a, b) => 
        a.artist.localeCompare(b.artist, "ja")
      );
      renderAdminSongList(sorted);
    });
  }

  // 8. 曲名順ソート
  const sortTitleBtn = document.getElementById("sort-title-btn");
  if (sortTitleBtn) {
    sortTitleBtn.addEventListener("click", () => {
      const sorted = [...songsData].sort((a, b) => 
        a.title.localeCompare(b.title, "ja")
      );
      renderAdminSongList(sorted);
    });
  }

  // 9. 楽曲追加フォーム送信
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
        
        songForm.reset();
        alert("楽曲を追加しました！");
      }
    });
  }

  // 10. 回答送信ボタン（ダミー動作）
  const soloSubmitBtn = document.getElementById("solo-submit-btn");
  if (soloSubmitBtn) {
    soloSubmitBtn.addEventListener("click", () => {
      const input = document.getElementById("solo-input");
      if (input && input.value.trim() !== "") {
        alert(`回答「${input.value}」を受け付けました！`);
        input.value = "";
      }
    });
  }
});
