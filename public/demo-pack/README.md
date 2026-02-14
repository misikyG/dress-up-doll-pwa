# 示範圖包（Demo Pack）

此資料夾用於放置示範用紙娃娃圖包。

## 檔案結構

```
demo-pack/
├── manifest.json      ← 圖包描述檔（定義所有物件）
├── images/            ← 圖片資料夾
│   ├── sample-character.png    ← 範例人物圖（2000x3800px 推薦）
│   ├── sample-hair.png         ← 範例髮型圖
│   └── sample-top.png          ← 範例上衣圖
└── README.md
```

## 如何新增圖片

1. 將 PNG 圖片放入 `images/` 資料夾
2. 在 `manifest.json` 的 `items` 陣列中新增對應條目
3. 每張圖片建議尺寸為 2000x3800 像素（與畫布相同大小）

## manifest.json 格式說明

```json
{
  "id": "unique-id",
  "name": "file-name",
  "displayName": "顯示名稱",
  "category": "character | hair | top | bottom | dress | shoes | accessory | carry | expression | filter | background | underwear | outer | other",
  "image": "images/filename.png",
  "tags": ["標籤1", "標籤2"]
}
```
