# Flick Strike

片手フリックで遊べるオフライン対応モバイルアクションゲーム。

## 遊び方

- **フリック** → フリックした方向に弾を発射
- 四方から迫る敵を倒してスコアを稼ごう
- 連続撃破でコンボボーナス！
- 3回被弾するとゲームオーバー

## 敵の種類

| 敵 | 特徴 |
|---|---|
| Grunt (円) | 標準スピード |
| Fast (菱形) | 高速・ジグザグ移動 |
| Tank (六角形) | 低速だがHP3 |
| Shooter (三角) | 中速・HP2 |
| Boss (星) | WAVE5毎に出現・HP10 |

## 技術仕様

- Pure HTML5 / CSS3 / JavaScript (外部依存なし)
- Canvas API によるレンダリング
- Web Audio API による効果音生成（ファイル不要）
- Touch Events によるフリック検出
- Service Worker による完全オフライン対応
- PWA 対応（ホーム画面追加可）

## 起動方法

任意のHTTPサーバーで `index.html` を配信するだけ。

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```
