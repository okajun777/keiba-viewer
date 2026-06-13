# 出馬表ビューア

netkeiba の出馬表を、スマホ横向きで見やすく切り替え表示するビューアです。

## 機能

- 日付の切り替え（前後ボタン + 横スクロール）
- 開催場所の切り替え（東京・阪神・函館 など）
- レース番号の切り替え（1R〜12R）
- 枠色付きの出馬表表示

## ローカルで起動

```bash
pip install -r requirements.txt
python app.py
```

ブラウザで `http://localhost:5000` を開いてください。

## 外出先から見る

### 方法A: 今すぐ試す（ngrok）

PC を起動したまま、一時的にインターネット公開できます。

```powershell
cd C:\Users\okaju\keiba
.\start-public.ps1
```

表示された `https://xxxx.ngrok-free.app` をスマホのブラウザで開きます。

**いま公開中の URL（この PC が起動している間のみ有効）:**

https://unleasable-overmeekly-tomika.ngrok-free.dev

- PC をスリープ／シャットダウンすると見られなくなります
- ngrok の無料版は URL が再起動のたびに変わります

### 方法B: いつでも見られる（Render・おすすめ）

自宅 PC を起動しなくても、外出先から使えます。

### 手順

1. 次の URL を開く（Render にログイン済みならそのまま進めます）

https://dashboard.render.com/blueprint/new?repo=https://github.com/okajun777/keiba-viewer

2. **Apply**（または **Deploy Blueprint**）をクリック

3. 数分後に `https://okajun-keiba-shutuba.onrender.com` で公開されます

GitHub リポジトリ: https://github.com/okajun777/keiba-viewer

### 無料プランの注意

- しばらくアクセスがないとスリープします。最初の表示に 30 秒ほどかかることがあります
- HTTPS 対応なので、外出先のモバイル回線からそのまま使えます

## 自宅 PC だけで一時的に公開する場合

PC を起動したまま、すぐ試したいときは [ngrok](https://ngrok.com/) でも公開できます。

```bash
python app.py
ngrok http 5000
```

表示された `https://xxxx.ngrok-free.app` をスマホで開きます。PC を止めると見られなくなります。

## 注意

- データは [netkeiba.com](https://www.netkeiba.com/) から取得しています
- 過度なアクセスは避けてください
- オッズ・成績は必ず主催者発表と照合してください
