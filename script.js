
  margin-top: 12px;
}

.pass-btn:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
}

/* 正解発表画面 */
.song-details-card {
  background-color: #0f172a;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid #334155;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 1.1rem;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item .label {
  color: #94a3b8;
}

.detail-item .value {
  font-weight: bold;
  color: #38bdf8;
}

/* スコア画面 */
.score-card {
  text-align: center;
  margin: 30px 0;
}

.score-label {
  color: #94a3b8;
  font-size: 1rem;
}

.score-display {
  font-size: 3rem;
  font-weight: bold;
  color: #38bdf8;
  margin-top: 10px;
}

/* 管理者画面メッセージ */
.message {
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 16px;
  text-align: center;
  font-size: 0.9rem;
}

.message.error {
  background-color: #f87171;
  color: #7f1d1d;
}

.message.success {
  background-color: #4ade80;
  color: #14532d;
}
