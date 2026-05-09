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
│       └── release.yml
├── scripts/
│   └── update-manifest-version.js
├── src/
│   └── manifest.base.json
├── dist/
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

# ベースマニフェスト例

ファイル:

```text
src/manifest.base.json
```

# 例:

```json
{
  "manifest_version": 3,
  "name": "Example Extension",
  "description": "Example browser extension.",
  "version": "0.0.0"
}
```

---

# バージョン注入スクリプト

ファイル:

```text
scripts/update-manifest-version.js
```

# 例:

```js
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const manifest = JSON.parse(fs.readFileSync("src/manifest.base.json", "utf8"));

manifest.version = pkg.version;

fs.mkdirSync("dist", { recursive: true });

fs.writeFileSync("dist/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
```

---

# package.json例

```json
{
  "scripts": {
    "build": "vite build && node scripts/update-manifest-version.js",
    "lint:ext": "web-ext lint --source-dir dist",
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
