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

1. このフォルダを GitHub にアップロードする

```bash
cd C:\Users\okaju\keiba
git init
git add .
git commit -m "Add keiba shutuba viewer"
gh repo create keiba-viewer --public --source=. --push
```

`gh` がない場合は、GitHub で空のリポジトリを作り、表示される手順どおりに push してください。

2. [Render ダッシュボード](https://dashboard.render.com/) で **New + → Blueprint** を選ぶ

3. 作った GitHub リポジトリを接続する

4. `render.yaml` が読み込まれるので、そのまま **Apply** する

5. 数分後に `https://keiba-viewer-xxxx.onrender.com` のような URL が発行される

6. スマホのブラウザでその URL を開き、ホーム画面に追加すると便利です

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
