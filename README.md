<!-- SPDX-License-Identifier: MPL-2.0 -->

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
npm run preflight
```

単体テストの対象範囲と追加方針は [テスト実施手順](./docs/how_to_test.md) を参照してください。

Firefox での手動確認:

1. `npm run build` を実行する。
2. Firefox で `about:debugging#/runtime/this-firefox` を開く。
3. `dist/manifest.json` を一時的なアドオンとして読み込む。
4. Google Drive 上の Office ファイルと `docs.google.com` の対象 URL を確認する。

## バージョンとリリース

`package.json` の `version` を唯一の正規バージョン情報源とします。`manifest.firefox.json` には `version` を定義せず、`npm run build` 時に `dist/manifest.json` へ `package.json` の `version` を注入します。

現在は GitHub Release と Firefox 用 ZIP 生成までを自動化しています。Firefox Add-ons、Chrome Web Store、Microsoft Edge Add-ons への自動アップロードは未対応です。各アドオンストアへの提出は、当面は手動で行います。

### 通常の修正 PR

1. 作業ブランチを作成する。

   ```bash
   git checkout -b feature/xxx
   ```

2. 拡張機能を修正する。

3. ローカル自動検証を実行する。

   ```bash
   npm run preflight
   ```

   `preflight` は SPDX ヘッダー確認、typecheck、lint、format、test、build、manifest version 検証、`web-ext lint` を実行します。カバレッジ確認が必要な変更では、追加で `npm run test:coverage` を実行します。

4. Firefox 実機でローカル確認する。

   ```bash
   npm run build
   ```

   Firefox で `about:debugging#/runtime/this-firefox` を開き、`dist/manifest.json` を一時的なアドオンとして読み込みます。

   確認観点:
   - Google Drive 上の Office ファイルメニューが制限される
   - Docs / Sheets / Slides の対象 URL がブロックされる
   - Options Page の設定が反映される
   - block page の表示が崩れていない

5. 必要に応じて、Firefox 配布用 ZIP の生成も確認する。

   ```bash
   npm run package:firefox
   ```

   生成物:

   ```text
   web-ext-artifacts/drive-office-guard-<version>.zip
   ```

6. GitHub に push して Pull Request を作成する。

   ```bash
   git push -u origin feature/xxx
   ```

   Pull Request では CI が以下を確認します。
   - SPDX ヘッダー
   - typecheck
   - lint
   - format
   - test
   - build
   - manifest version
   - `web-ext lint`
   - 既存タグと同じ `package.json` version を再利用していないこと

7. Pull Request のレビュー後、`main` へマージする。

### 現在のリリース手順

`main` へマージ後、リリース担当者が最新の `main` を取得して version bump と tag push を行います。

```bash
git checkout main
git pull
npm run release:patch
git push --follow-tags
```

マイナー、メジャーリリースでは、それぞれ以下を使用します。

```bash
npm run release:minor
npm run release:major
```

`npm version` により `package.json` の `version` と `vX.Y.Z` 形式の Git タグが作成されます。タグを push すると GitHub Actions の Release workflow が以下を実行します。

- タグ名と `package.json` の version 一致確認
- SPDX ヘッダー確認
- typecheck / lint / format / test
- build と manifest version 検証
- `web-ext lint`
- Firefox ZIP 生成
- GitHub Release 作成と ZIP 添付

GitHub Release 作成後は、手動でストアへ提出します。

1. GitHub Release に添付された `drive-office-guard-<version>.zip` を取得する。
2. Firefox Add-ons の開発者コンソールで新しいバージョンとして ZIP をアップロードする。
3. ストア側の検証結果、権限表示、説明文、スクリーンショット、公開範囲を確認する。
4. ストア審査へ提出する。
5. 審査結果と公開状態を確認し、必要に応じて GitHub Release の説明や運用メモを更新する。

### 将来のリリース手順

将来的にストア API 連携を追加した後は、`git push --follow-tags` 後の Release workflow 内で Firefox Add-ons、Chrome Web Store、Microsoft Edge Add-ons へのアップロードまで自動化します。

その場合も、修正 PR の流れは変えません。変更されるのは、GitHub Release 後の手動ストア提出が自動 job に置き換わる部分です。

自動ストア配布で追加する想定:

- Chrome / Edge 向け manifest と成果物の生成
- 各ストア API 認証情報の GitHub Actions secrets 管理
- Firefox Add-ons、Chrome Web Store、Microsoft Edge Add-ons へのアップロード job
- ストア審査へ自動提出するか、アップロードまでで止めるかの運用切り替え
- ストア別のリリース失敗時に GitHub Release と成果物をどう扱うかのロールバック手順

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

本リポジトリは MPL 2.0 で提供します。SPDX ライセンス識別子は `MPL-2.0` です。

手書きのソース、テスト、設定、ドキュメントに SPDX ヘッダーを付与するには、以下を実行します。

```bash
npm run license:headers
```

JSON はコメントを書けないため、`REUSE.toml` で一括管理します。

付与漏れの確認:

```bash
npm run license:check
```

## 設計書

詳細は [anti-google-office_design.md](./docs/anti-google-office_design.md) を参照してください。
