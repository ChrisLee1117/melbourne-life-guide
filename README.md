# 🇦🇺 墨爾本生活助手 Melbourne Life Guide

自動更新墨爾本活動 + 超市特價，每天早上8時自動搜尋最新資訊。

---

## 🚀 部署步驟（10分鐘完成）

### 第一步：上傳去 GitHub

1. 登入 [github.com](https://github.com)
2. 點 **New repository**
3. 名稱填：`melbourne-life-guide`
4. 選 **Public**，點 **Create repository**
5. 上傳所有檔案（拖放或用 git）

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/你的名字/melbourne-life-guide.git
git push -u origin main
```

---

### 第二步：連接 Vercel

1. 去 [vercel.com](https://vercel.com)，用 GitHub 登入
2. 點 **New Project**
3. 選你的 `melbourne-life-guide` repo
4. 點 **Deploy**（先唔使改任何設定）
5. 等 2 分鐘，部署完成！

---

### 第三步：申請 Anthropic API Key

1. 去 [console.anthropic.com](https://console.anthropic.com)
2. 註冊帳號（有免費額度）
3. 去 **API Keys** → **Create Key**
4. 複製 Key（以 `sk-ant-` 開頭）

---

### 第四步：加入 Vercel Blob 儲存

1. 喺 Vercel 後台，去你的 project
2. 點 **Storage** → **Create Database** → **Blob**
3. 跟住指示完成
4. Vercel 會自動加入 `BLOB_READ_WRITE_TOKEN` 環境變數

---

### 第五步：加入環境變數

喺 Vercel 後台 → **Settings** → **Environment Variables**，加入：

| 變數名 | 值 |
|--------|-----|
| `ANTHROPIC_API_KEY` | 你的 API Key（sk-ant-...） |

---

### 第六步：第一次手動更新

部署完成後，去：
```
https://你的網址.vercel.app/api/update
```

等 30 秒，應該見到：
```json
{"success": true, "count": 15, "lastUpdated": "2026-06-01"}
```

之後每天早上8時會**自動更新** ✅

---

### 第七步：加入 EVENTS_BLOB_URL（最後一步）

1. 執行完 `/api/update` 後，去 Vercel Storage → Blob
2. 見到 `events.json` 檔案，複製其 URL
3. 去 Environment Variables，加入：

| 變數名 | 值 |
|--------|-----|
| `EVENTS_BLOB_URL` | events.json 的完整 URL |

4. 重新部署：**Deployments** → **Redeploy**

---

## 📁 檔案結構

```
melbourne-life-guide/
├── api/
│   ├── update.js      # 自動搜尋活動（每天執行）
│   └── events.js      # 返回活動資料給前端
├── public/
│   └── index.html     # 前端 App
├── vercel.json        # Vercel 設定（含 Cron Job）
├── package.json       # 依賴套件
└── README.md          # 本文件
```

---

## 💰 費用

| 服務 | 費用 |
|------|------|
| GitHub | 免費 |
| Vercel（Hobby） | 免費 |
| Vercel Blob（1GB） | 免費 |
| Anthropic API（每次更新） | ~$0.01–0.03 美元 |
| **每月總計** | **~$0.30–$1 美元** |

---

## 🔧 手動更新

任何時候想立即更新：
```
https://你的網址.vercel.app/api/update
```

---

## ❓ 問題？

傳訊息畀 Claude：「Melbourne app 有問題：[描述]」
