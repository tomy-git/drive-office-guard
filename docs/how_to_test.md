<!-- SPDX-License-Identifier: MPL-2.0 -->

# 単体テスト実施手順

## 目的

このドキュメントは、Office Breakage Blocker for Google Drive の単体テストを実施するための手順をまとめる。
ローカル開発時、Pull Request 作成前、Drive UI パターン変更時の UT 確認に使用する。

## 前提条件

- Node.js 20 以上
- npm
- 依存パッケージが未インストールの場合は、以下を実行する。

```bash
npm install
```

## 単体テストの実行

単体テストは Vitest で実行する。

```bash
npm test
```

`npm test` は `vitest run` を実行する。テスト対象は `vitest.config.ts` の設定により `test/**/*.test.ts` で、実行環境は `jsdom` である。

## カバレッジの確認

単体テストのカバレッジは以下で確認する。

```bash
npm run test:coverage
```

`npm run test:coverage` は `vitest run --coverage` を実行する。カバレッジ対象は `src/**/*.ts` で、集計には V8 coverage provider を使用する。

実行後はターミナルにサマリーが表示され、HTML レポートは `coverage/` 配下に出力される。`coverage/` は生成物として Git 管理対象外とする。

## 現在の単体テスト範囲

現在の単体テストは以下を対象とする。

- `test/shared/config.test.ts`
  - 設定値の正規化
  - `storage.managed` 相当の管理設定と sync/default 設定のマージ
  - Guard 設定オブジェクトの妥当性判定
- `test/shared/dnr-rules.test.ts`
  - Dynamic Rules の固定 rule id
  - 有効なサービスだけを対象にした DNR redirect ルール生成
  - `docs.google.com` の対象 path 判定
- `test/content/drive-dom-adapter.test.ts`
  - Drive メニュー fixture からの操作 signal 抽出
  - 設定に応じた Docs / Sheets / Slides 操作の無効化判定
  - Office ファイルに対する「新しいタブで開く」操作の無効化判定
  - 選択行や共有ホーム表示からの Office ファイル情報補完
  - Google Drive の DOM 仕様変更リスク検知
- `test/content/drive-menu-guard.test.ts`
  - Office ファイルを Google エディタで開く既知メニューの無効化
  - 無効化したメニューのクリック抑止
  - 設定で無効化対象外になったサービスの除外
  - 仕様変更リスク検知時のフェイルセーフ通知
- `test/options/options.test.ts`
  - Options Page での設定保存成功時の保存値と通知
  - 設定保存失敗時のエラー通知
  - 管理ポリシーで固定された設定値の保存対象除外

Drive UI の DOM パターン確認には `test/fixtures/drive/*.html` を使用する。

## 単体テスト以外の関連チェック

以下は単体テストではないが、変更内容に応じて合わせて確認する。

```bash
npm run typecheck
npm run lint
npm run format
npm run build
```

各コマンドの用途は以下の通り。

- `npm run typecheck`: アプリ、テスト、設定ファイルの TypeScript 型チェック
- `npm run lint`: ESLint による静的解析
- `npm run format`: Prettier のフォーマット確認
- `npm run build`: Firefox 拡張として配布する `dist/` の生成確認

Pull Request 作成前にリポジトリ全体の品質ゲートを確認する場合は、以下を実行する。

```bash
npm run typecheck
npm run lint
npm run format
npm test
npm run test:coverage
npm run build
```

Firefox 向けアドオン ZIP まで確認する場合は、以下を実行する。

```bash
npm run package:firefox
```

生成された `web-ext-artifacts/firefox-addon.zip` は GitHub Actions の `package-firefox` job と同じ出力である。CI では `pull_request` と `main` への push ごとに artifact として保存する。

AMO への listed アドオン送信は、`v*` タグまたは手動実行の GitHub Actions でのみ行う。ローカルで同等の送信確認を行う場合は、AMO の JWT issuer/secret を `WEB_EXT_API_KEY` と `WEB_EXT_API_SECRET` に設定したうえで以下を実行する。

```bash
npm run package:source
npm run publish:firefox:listed
```

`publish:firefox:listed` は `dist/` を再ビルドし、AMO レビュー用の `web-ext-artifacts/source-code.zip` を添付して送信する。

## テスト追加方針

Drive UI の新しいメニュー構造や文言を確認した場合は、実装変更だけで済ませず、以下の順でテストを追加する。

1. `test/fixtures/drive/` に再現用 HTML fixture を追加する。
2. `test/content/drive-dom-adapter.test.ts` に signal 抽出と無効化判定の期待値を追加する。
3. 必要に応じて `src/content/drive-patterns.ts` または `src/content/drive-dom-adapter.ts` を更新する。
4. `npm test` を実行し、既存 fixture を含めて回帰がないことを確認する。

設定や URL ブロックの仕様を変更する場合は、以下にテストを追加する。

- 設定処理: `test/shared/config.test.ts`
- DNR ルール生成と URL 判定: `test/shared/dnr-rules.test.ts`

## 手動確認との切り分け

以下は単体テストでは確認できないため、必要に応じて Firefox 実機で確認する。

- `dist/manifest.json` を一時的なアドオンとして読み込めること
- Google Drive 上で Office ファイルの対象メニューが視覚的に無効化されること
- `docs.google.com/spreadsheets/*`
- `docs.google.com/presentation/*`
- `docs.google.com/document/*`
- Options Page の設定変更が URL ブロックとメニュー無効化に反映されること

手動確認前には `npm run build` を実行する。

## 失敗時の確認観点

`npm test` が失敗した場合は、以下を確認する。

- fixture の HTML 構造が実際の Drive UI と対応しているか
- `drive-patterns.ts` の文言、role、aria 属性、拡張子判定が期待値と合っているか
- 設定変更時に default、sync、managed の優先順位が崩れていないか
- DNR rule id と `docs.google.com` の path 判定が既存仕様と矛盾していないか

テストが追加できない変更は、完了報告に未実施理由と残リスクを記載する。
