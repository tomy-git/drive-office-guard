<!-- SPDX-License-Identifier: MPL-2.0 -->

# ブラウザ拡張機能のバージョニング・リリース戦略

# 概要

本ドキュメントは、GitHubで管理されるブラウザ拡張機能プロジェクトのバージョニングおよびリリース管理戦略を定義します。

目的:

- バージョン番号の唯一の信頼できる情報源を持つ
- ファイル間のバージョン不一致を防止する
- GitHub Releases の自動化を可能にする
- 将来の拡張ストアへの自動デプロイに備える
- リリース作業をシンプルかつ再現可能に保つ

対応ストア:

- Mozilla Firefox Add-ons (AMO)
- Google Chrome Web Store
- Microsoft Edge Add-ons

---

# 基本方針

## 単一の信頼できる情報源

`package.json` が唯一の正規バージョン情報源です。

例:

```json
{
  "version": "0.1.1"
}
```

以下の値は常に一致している必要があります:

| 対象           | 例                  |
| -------------- | ------------------- |
| package.json   | 0.1.1               |
| manifest.json  | 0.1.1               |
| Gitタグ        | v0.1.1              |
| GitHubリリース | v0.1.1              |
| ZIPファイル名  | extension-0.1.1.zip |

---

# 推奨リポジトリ構成

```text
project-root/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── scripts/
│   ├── copy-extension-assets.mjs
│   └── verify-manifest-version.mjs
├── src/
├── dist/
├── manifest.firefox.json
├── package.json
└── README.md
```

---

# バージョン管理フロー

## リリース手順

### パッチリリース

```bash
npm version patch
git push --follow-tags
```

# マイナーリリース

```bash
npm version minor
git push --follow-tags
```

# メジャーリリース

```bash
npm version major
git push --follow-tags
```

---

# Gitタグ戦略

Gitタグは必ず以下の形式を使用してください:

```text
vX.Y.Z
```

# 例:

```text
v0.1.0
v0.1.1
v1.0.0
```

---

# manifest.json生成方針

## 方針

`dist/manifest.json` を直接編集しないでください。

代わりに:

1. `package.json` からバージョンを読み取る
2. ビルド時に `dist/manifest.json` を生成する

---

# Firefox ベースマニフェスト

ファイル:

```text
manifest.firefox.json
```

`manifest.firefox.json` は Firefox 用ベース manifest として管理し、`version` は定義しません。
`version` は build 時に `package.json` から `dist/manifest.json` へ注入します。

例:

```json
{
  "manifest_version": 3,
  "name": "Office Breakage Blocker for Google Drive",
  "description": "Prevents Google Drive from opening Microsoft Office files in Google Docs, Sheets, or Slides and breaking their layout."
}
```

---

# バージョン注入スクリプト

ファイル:

```text
scripts/copy-extension-assets.mjs
```

実装方針:

- `package.json` を読み込む
- `manifest.firefox.json` を読み込む
- `manifest.version` に `package.json` の `version` を設定する
- `dist/manifest.json` を生成する
- HTML と icons を `dist/` へコピーする

`scripts/verify-manifest-version.mjs` は、以下を検証します。

- `dist/manifest.json` の `version` が `package.json` と一致する
- `manifest.firefox.json` に `version` キーが存在しない

---

# package.json scripts

```json
{
  "scripts": {
    "build": "npm run clean && npm run build:background && npm run build:content && npm run build:options && npm run build:blocked && npm run copy:assets",
    "check:manifest-version": "node scripts/verify-manifest-version.mjs",
    "lint:ext": "web-ext lint --source-dir dist",
    "package:firefox": "npm run build && web-ext build --source-dir dist --artifacts-dir web-ext-artifacts --filename drive-office-guard-${npm_package_version}.zip --overwrite-dest",
    "release:patch": "npm version patch",
    "release:minor": "npm version minor",
    "release:major": "npm version major"
  }
}
```

---

# Git無視ファイル方針

生成されたファイルはコミットしないでください。

推奨 `.gitignore`:

```gitignore
dist/
web-ext-artifacts/
*.zip
```

---

# GitHub Actions戦略

## 推奨バリデーションチェック

GitHub Actions でバージョンの整合性を検証し、重複リリースを防止します。

推奨チェック:

| チェック内容                              | 目的                                               |
| ----------------------------------------- | -------------------------------------------------- |
| package.json バージョン重複チェック       | 既にリリース済みのバージョン再利用を防止           |
| Gitタグとpackage.jsonの整合性チェック     | 不一致なリリースバージョンを防止                   |
| manifest.jsonバージョン生成バリデーション | ビルド成果物に正しいバージョンが含まれているか確認 |

---

# プルリクエスト時のバリデーション例

プルリクエスト時の推奨バリデーション:

- 既存リリースバージョンを再利用しているPRを拒否する
- 次回リリースバージョンが一意であることを確認する

ワークフロー例:

```yaml
name: Check version

on:
  pull_request:
    branches:
      - main

jobs:
  check-version:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check package version is not already released
        run: |
          VERSION=$(node -p "require('./package.json').version")
          TAG="v${VERSION}"

          echo "package.json version: ${VERSION}"
          echo "expected tag: ${TAG}"

          if git rev-parse "${TAG}" >/dev/null 2>&1; then
            echo "Error: ${TAG} already exists. Please bump package.json version."
            exit 1
          fi
```

---

# リリース時のバリデーション例

リリースワークフローでの推奨バリデーション:

- Gitタグとpackage.jsonのバージョンが一致していることを確認
- 不整合なリリースは自動的に拒否する

ワークフロー例:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Check tag matches package version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          TAG="${GITHUB_REF_NAME}"

          echo "package.json version: ${VERSION}"
          echo "git tag: ${TAG}"

          if [ "${TAG}" != "v${VERSION}" ]; then
            echo "Error: Git tag and package.json version do not match."
            exit 1
          fi
```

---

# トリガー

リリースのトリガーとしてGitタグのpushを使用します。

例:

```yaml
on:
  push:
    tags:
      - "v*"
```

---

# 推奨CI/CDフロー

```text
タグPush
  ↓
依存関係インストール
  ↓
拡張機能ビルド
  ↓
拡張機能リント
  ↓
ZIPパッケージ作成
  ↓
GitHubリリース作成
  ↓
(任意) ストアへアップロード
```

---

# ZIP命名規則

推奨:

```text
extension-name-X.Y.Z.zip
```

例:

```text
drive-office-guard-0.1.1.zip
```

---

# ストア配信戦略

## 初期段階

最初は手動アップロードを推奨します。

理由:

- デバッグが容易
- レビュー対応が容易
- ストアエラーからの復旧が簡単

## 後期段階

リリースフローが安定した後は、

- Firefox AMO API
- Chrome Web Store API
- Edge Add-ons API

をGitHub Actionsに統合できます。

---

# 推奨初期ワークフロー

## 日常開発

```bash
git checkout -b feature/xxx
```

通常通り開発を進めます。

---

## リリース

```bash
npm version patch
git push --follow-tags
```

GitHub Actionsが以下を自動で処理します:

- ビルド
- バリデーション
- ZIP生成
- GitHubリリース作成

---

# 推奨将来拡張

## オプション

### 変更履歴の自動生成

利用可能なツール例:

- conventional-changelog
- release-please
- semantic-release

---

### 完全自動セマンティックバージョニング

将来的に導入可能:

- Conventional Commits
- semantic-release

初期段階の拡張開発では運用が複雑になるため推奨しません。

---

# 最終推奨構成

小〜中規模のブラウザ拡張機能プロジェクトにおいては、

- `package.json` を唯一のバージョン情報源とする
- リリースにはGitタグを利用する
- `manifest.json`は生成物とする
- 自動化にはGitHub Actionsを活用する
- ビルド成果物はコミットしない

これにより、クリーンで拡張性があり、保守コストの低いリリースワークフローを実現できます。

---

# 実装進捗記録

## 2026-05-10 バージョン単一情報源化とリリース自動化

状態: DONE

担当: implementer worker / orchestration

最終更新: 2026-05-10

対象タスク:

- [x] `package.json` を唯一の正規バージョン情報源にする。
- [x] build 時に `dist/manifest.json` の `version` を `package.json` から注入する。
- [x] `dist/manifest.json` は生成物、`manifest.firefox.json` は Firefox 用ベース manifest として扱う。
- [x] `lint:ext`、`package:firefox`、`release:patch`、`release:minor`、`release:major` scripts を追加する。
- [x] `.gitignore` に ZIP 生成物の無視方針を反映する。
- [x] 既存 CI に version 重複チェック、typecheck、lint、format、build、manifest version 検証、web-ext lint を追加する。
- [x] PR タグ重複チェックを `pull_request` のみで発火させる。
- [x] tag push `v*` 用の release workflow を追加し、タグと `package.json` の一致確認、検証、ZIP 作成、GitHub Release 作成を行う。
- [x] 差し戻し対応: `package:firefox` 単体で build から ZIP 生成まで再現できるようにする。
- [x] 差し戻し対応: `manifest.firefox.json` に `version` が再追加された場合に検証で失敗させる。
- [x] 差し戻し対応: `verify-manifest-version` の失敗系を Vitest で固定化する。
- [x] 差し戻し対応: 本ドキュメント前半を実リポジトリ構成に合わせる。

判断:

- `manifest.firefox.json` から固定 `version` を削除し、Firefox 用ベース manifest として維持する。
- `scripts/copy-extension-assets.mjs` で `package.json` と `manifest.firefox.json` を読み込み、`dist/manifest.json` 生成時に `package.json` の `version` を注入する。
- `scripts/verify-manifest-version.mjs` を追加し、ローカル検証、CI、release workflow の共通チェックとして使用する。`dist/manifest.json` と `package.json` の version 一致に加え、`manifest.firefox.json` に `version` キーが存在しないことも検証する。
- Firefox 用 ZIP は `npm run build && web-ext build --source-dir dist --artifacts-dir web-ext-artifacts --filename drive-office-guard-${npm_package_version}.zip --overwrite-dest` で生成し、stale な `dist/` を ZIP 化しない。
- GitHub Release 作成は tag push `v*` のみをトリガーにし、`gh release create` で生成 ZIP を添付する。
- `verify-manifest-version` の失敗系は、CLI を一時プロジェクトに対して実行する Vitest で固定化する。
- 本ドキュメントの manifest 生成方針は、一般例ではなく本リポジトリの `manifest.firefox.json` / `scripts/copy-extension-assets.mjs` 構成に合わせる。

検証結果:

| 項目                             | 結果 | 備考                                                                                                                        |
| -------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`              | OK   | app/test/config の TypeScript 型チェックが成功。                                                                            |
| `npm run lint`                   | OK   | ESLint が成功。                                                                                                             |
| `npm run format`                 | OK   | Prettier チェックが成功。                                                                                                   |
| `npm test`                       | OK   | 6 files / 31 tests passed。`manifest.firefox.json` の `version` 再追加と `dist/manifest.json` 不一致の失敗系を確認。        |
| `npm run build`                  | OK   | `dist/manifest.json` を生成。                                                                                               |
| `npm run check:manifest-version` | OK   | `dist/manifest.json` と `package.json` が `0.1.0` で一致し、`manifest.firefox.json` に `version` がないことを確認。         |
| `npm run lint:ext`               | OK   | exit 0。Firefox Android の `strict_min_version` と `data_collection_permissions` 組み合わせに関する既存 manifest 警告あり。 |
| `npm run package:firefox`        | OK   | build を内包して実行し、`web-ext-artifacts/drive-office-guard-0.1.0.zip` を再生成。                                         |
| `npm run license:check`          | OK   | SPDX ヘッダー確認が成功。                                                                                                   |

残課題:

- `web-ext` 実行時にローカル update check 用設定ストアの権限警告が表示されるが、lint/package は成功している。
- Firefox 実機での一時アドオン読み込み、DNR redirect、Options Page の手動確認は本タスク範囲外として未実施。
