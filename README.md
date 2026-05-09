# Office Breakage Blocker for Google Drive

Google Drive 上で Microsoft Office ファイル（`.pptx`, `.xlsx`, `.docx`）を Google Docs / Sheets / Slides で開くことによるレイアウト崩れ、フォント崩れ、SmartArt 崩れ、アニメーション消失、意図しない Google 形式への変換を防ぐためのブラウザ拡張機能です。

Phase 1 では Firefox を先行対象とし、Chrome / Edge は Phase 2 で対応します。

## 目的

Google Drive 上の Office ファイルについて、以下の操作を制限します。

- 「Google スプレッドシートで開く」
- 「Google スライドで開く」
- 「Google ドキュメントで開く」
- 「新しいタブで開く」

これによりOffice ファイルに対して許可する操作は、原則として以下に限定します。

- Preview（プレビュー）
- Download（ダウンロード）

共有URLなどによる直接アクセスでは元ファイルが Office ファイルか Google ネイティブ形式かを安定して判定できないため、Phase 1 では安全側に倒し、設定で有効化された Google Docs / Sheets / Slides の URL への直接アクセスもサービス単位で制限します。

## 対象ブラウザ

| ブラウザ        | 対応方針    |
| --------------- | ----------- |
| Mozilla Firefox | Phase 1 MVP |
| Google Chrome   | Phase 2     |
| Microsoft Edge  | Phase 2     |

## 主な機能

- Google Drive のメニュー項目を視覚的に無効化
- `docs.google.com/spreadsheets/*` のブロック
- `docs.google.com/presentation/*` のブロック
- `docs.google.com/document/*` のブロック
- ブロック時に、現在制限中の Google Docs / Sheets / Slides だけを表示する説明ページ
- Sheets / Slides / Docs の個別ブロック設定
- `storage.managed` による管理ポリシー読み取り
- Google Drive 仕様変更検知時のフェイルセーフ通知

## 実装方針

Firefox の Manifest V3 を先行実装とし、background は `background.scripts` を使用します。URL ブロックは `declarativeNetRequest` の Dynamic Rules を使い、設定変更時に有効なルールを同期します。

Google Drive の GUI 変更に追従しやすくするため、Drive DOM への依存は以下に分離します。

- `drive-menu-guard.ts`: 初期化、設定読み込み、監視開始、無効化適用
- `drive-dom-adapter.ts`: Drive DOM からメニュー項目、選択ファイル、表示テキストを抽出
- `drive-patterns.ts`: UI 文言、role、aria 属性、URL path、拡張子などの判定パターン

新しい Drive UI パターンが見つかった場合は fixture と抽出テストを追加し、本体ロジックへ DOM 依存を広げない方針です。

## 設定

初期値は安全側に倒し、すべて有効とします。

```json
{
  "blockSheets": true,
  "blockSlides": true,
  "blockDocs": true,
  "hideDisabledLabel": false
}
```

`hideDisabledLabel` を `true` にすると、Google Drive のメニュー上ではグレーアウトだけを行い、「拡張機能により無効化」の括弧書きを追加しません。

個人利用時は `browser.storage.sync` を使用します。Enterprise 利用時は `storage.managed` を優先し、管理ポリシーに存在するキーはユーザー設定で上書きできない設計とします。

## Enterprise 配布

Firefox Enterprise では、native manifest または `3rdparty` enterprise policy による managed storage 配布を検討します。

Chrome Enterprise と Edge for Business は Phase 2 で対応し、Firefox 先行実装の共通ロジックを移植します。

## 制限事項

ブラウザ拡張単体では完全な防止策にはなりません。以下は回避可能です。

- 拡張機能の無効化
- 別ブラウザの利用
- curl / API によるアクセス
- 管理外端末からのアクセス

厳密に強制する場合は、Firefox Enterprise、Chrome Enterprise、Edge for Business、MDM、Endpoint 管理、DLP などの併用が必要です。

## 開発手順

前提:

- Node.js 20 以上
- npm

セットアップ:

```bash
npm install
```

検証:

```bash
npm run typecheck
npm run lint
npm run format
npm test
npm run test:coverage
npm run build
```

単体テストの対象範囲と追加方針は [テスト実施手順](./docs/how_to_test.md) を参照してください。

Firefox での手動確認:

1. `npm run build` を実行する。
2. Firefox で `about:debugging#/runtime/this-firefox` を開く。
3. `dist/manifest.json` を一時的なアドオンとして読み込む。
4. Google Drive 上の Office ファイルと `docs.google.com` の対象 URL を確認する。

## 開発ステータス

Phase 1 MVP の Firefox 実装を追加済みです。Firefox 実機での一時アドオン読み込みと DNR redirect の手動確認は未実施です。

- Drive メニュー項目の視覚的無効化
- `docs.google.com` block
- block page
- Firefox 対応版のパッケージ化
- 管理ポリシーと Options Page
- Drive GUI パターン fixture と DOM adapter の単体テスト
- Chrome / Edge への移植方針整理は Phase 2 対象

## ライセンス

ライセンス候補は MPL 2.0 です。

## 設計書

詳細は [anti-google-office_design.md](./docs/anti-google-office_design.md) を参照してください。
