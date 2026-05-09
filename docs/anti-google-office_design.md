<!-- SPDX-License-Identifier: MPL-2.0 -->

# Office Breakage Blocker for Google Drive 設計方針書

## 概要

Google Drive 上で Microsoft Office ファイル（`.pptx`, `.xlsx`, `.docx`）を Google Docs / Sheets / Slides で開くことによる以下の問題を防止するためのブラウザ拡張機能を開発する。
Phase 1 は Firefox を先行対象とする。
安全側に倒し、設定で有効化された Google Docs / Sheets / Slides への直接アクセスもサービス単位で制限する。

- フォント崩れ
- レイアウト崩れ
- SmartArt 崩れ
- アニメーション消失
- Google形式への意図しない変換
- ファイル互換性破壊

対象ブラウザ：

- Mozilla Firefox（Phase 1 MVP）
- Google Chrome（Phase 2）
- Microsoft Edge（Phase 2）

---

## 目的

### 実現したいこと

Google Drive 上で以下を禁止する。

- 「Google スプレッドシートで開く」
- 「Google スライドで開く」
- 「Google ドキュメントで開く」
- 「新しいタブで開く」

Drive UI 上の無効化は、選択中または操作対象のファイルが Microsoft Office ファイル（`.pptx`, `.xlsx`, `.docx`）であると判定できる場合に適用する。
対象ファイル種別が判定できない場合は、Drive UI の通常操作を壊さないことを優先し、DOM 操作ではなく `docs.google.com` の URL ブロックで保護する。

ただし、無効化対象は固定ではなく、ユーザーまたは管理者が設定から選択できるようにする。

- スプレッドシートのみ無効化
- スライドのみ無効化
- ドキュメントのみ無効化
- 上記の任意の組み合わせで無効化

Google Docs 系 URL の直接アクセスを禁止する。

- `docs.google.com/spreadsheets/*`
- `docs.google.com/presentation/*`
- `docs.google.com/document/*`

直接アクセス時点では元ファイルが Office ファイルか Google ネイティブ形式かを安定して判定できない。
そのため、URL ブロックは設定で有効なサービス単位で `docs.google.com` の URL 全体に適用する。
Google ネイティブ形式の利用を許可する例外要件は、Phase 2 のホワイトリストまたは管理ポリシーで扱う。
このため、Phase 1 の製品方針は「Office ファイル保護を主目的としつつ、設定対象の Google Docs / Sheets / Slides 起動自体を禁止する」と定義する。

Office ファイルは以下のみ許可する。

- Preview（プレビュー）
- Download（ダウンロード）

---

## 非目的

以下は対象外とする。

- Google Workspace の Drive 共有・編集ポリシー制御
- Google Workspace 管理コンソール自体の設定変更
- Drive API 制御
- DLP（Data Loss Prevention）
- ファイル暗号化
- OCR / AI 検査
- ネットワークレベル制御

---

## アーキテクチャ

```text
Browser
 ├─ Content Script（Firefox Phase 1）
 │   ├─ Drive DOM監視
 │   ├─ メニュー項目の視覚的無効化
 │   └─ ボタン無効化
 │
 ├─ Background Script（Firefox Phase 1）
 │   ├─ 設定読み込み
 │   ├─ 管理ポリシー優先制御
 │   └─ DNR 動的ルール同期
 │
 ├─ DeclarativeNetRequest（Firefox Phase 1）
 │   └─ docs.google.com ブロック
 │
 └─ Block Page
     └─ ユーザー向け説明
```

Firefox は Phase 1 の正本実装とする。
`manifest.firefox.json` は `background.scripts` を前提にし、Chrome / Edge の `background.service_worker` へ後続移植する。
共通ロジックは `src/shared/` に置き、ブラウザ固有の manifest と background entrypoint だけを分離する。

### 設定・ポリシー反映方針

拡張機能は、以下の設定値を参照して動作する。

- 個人利用時: `browser.storage.sync`
- Enterprise 利用時: `storage.managed`

実行時には、管理ポリシーを優先し、管理ポリシーが存在しない場合のみユーザー設定を使用する。
`storage.managed` は拡張機能から書き込めない読み取り専用領域として扱い、Firefox では native manifest または `3rdparty` enterprise policy による配布を優先して設計する。
Chrome / Edge では Phase 2 で管理ストレージ用スキーマと配布ポリシーを追加する。

---

## 技術選定

| 項目      | 採用                  |
| --------- | --------------------- |
| 言語      | TypeScript            |
| 拡張仕様  | WebExtensions API     |
| Manifest  | Manifest V3           |
| ビルド    | Vite                  |
| DOM監視   | MutationObserver      |
| URL制御   | declarativeNetRequest |
| 状態管理  | browser.storage       |
| Lint      | ESLint                |
| Formatter | Prettier              |

---

## ディレクトリ構成

```text
anti-google-office/
├─ src/
│  ├─ content/
│  │  ├─ drive-menu-guard.ts
│  │  ├─ drive-dom-adapter.ts
│  │  └─ drive-patterns.ts
│  │
│  ├─ background/
│  │  ├─ background-firefox.ts
│  │  └─ service-worker-chromium.ts
│  │
│  ├─ pages/
│  │  └─ blocked.html
│  │
│  └─ shared/
│     ├─ config.ts
│     ├─ constants.ts
│     └─ dnr-rules.ts
│
├─ manifest.firefox.json
├─ manifest.chrome.json        # Phase 2
├─ manifest.edge.json          # Phase 2
│
├─ package.json
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.test.json
├─ tsconfig.config.json
├─ tsconfig.base.json
├─ vite.config.ts
└─ README.md
```

---

## 機能設計

### 1. Drive UI 制御

対象画面：

```text
https://drive.google.com/*
```

Content Script を注入する。

```json
{
  "matches": ["https://drive.google.com/*"],
  "js": ["drive-menu-guard.js"]
}
```

Google Drive は SPA のため、DOM の動的変化を `MutationObserver` で監視する。
Drive DOM への依存は Content Script 本体に散らさず、以下の責務へ分離する。

- `drive-menu-guard.ts`: 初期化、設定読み込み、監視開始、無効化適用の orchestration
- `drive-dom-adapter.ts`: Drive DOM からメニュー項目、選択ファイル、表示テキストを抽出する薄い adapter
- `drive-patterns.ts`: UI テキスト、role、aria 属性、ファイル種別判定パターンを定義するデータ層

Google Drive の GUI 変更時は、原則として `drive-dom-adapter.ts` と `drive-patterns.ts` の修正で追従する。
`drive-menu-guard.ts` に Google Drive 固有のセレクタや UI 文言を直接書かない。

無効化対象：

- Google スプレッドシート
- Google スライド
- Google ドキュメント
- 新しいタブで開く

ただし、Google スプレッドシート / Google スライド / Google ドキュメントは設定により個別に ON/OFF できる。
「新しいタブで開く」は、Office ファイルを Google Docs / Sheets / Slides で開く導線になり得るため、Office ファイルを操作している場合は常時無効化対象とする。
Office ファイル以外の Drive 操作では無効化しない。

UI 上では該当項目を完全に消さず、以下のように視覚的に無効化する。

- 項目は表示したままにする
- 文字色を薄くする
- 背景を薄いグレーで塗る
- クリック・キーボード操作を無効化する
- 項目名の後ろに「（拡張機能により無効化）」を表示する

これにより、ユーザーは「本来存在する操作だが、拡張機能により禁止されている」ことを理解できる。

検出方式は CSS セレクタ固定ではなく、以下を組み合わせる。

- `role`
- `aria-label`
- `innerText`
- file extension
- data attribute
- URL path

理由は、Google Drive の DOM 構造が頻繁に変更されるため。
判定ロジックは「複数シグナルのスコアリング」として実装し、単一シグナルだけで危険操作と断定しない。

例：

```ts
if (
  driveDomAdapter.isMenuItem(element) &&
  driveDomAdapter.getMenuItemConfidence(element) >= MIN_MENU_CONFIDENCE &&
  drivePatterns.matchesBlockedText(driveDomAdapter.getMenuItemText(element))
) {
  disableMenuItem(element);
}
```

---

### 2. URL ブロック

対象 URL：

```text
https://docs.google.com/spreadsheets/*
https://docs.google.com/presentation/*
https://docs.google.com/document/*
```

Firefox Phase 1 では `declarativeNetRequest` を利用する。
`webNavigation` や `tabs.update` は主制御にせず、DNR で実現できない要件が出た場合の代替候補に留める。

Chrome / Edge Phase 2 でも `declarativeNetRequest` を利用し、Firefox 先行実装の DNR ルール生成ロジックを共有する。

ブロック後は拡張内ページへ遷移する。

```text
blocked.html
```

---

### 3. Block Page

表示文言例：

```text
この組織では、Google Docs / Sheets / Slides の利用を制限しています。

Drive の「プレビュー」または「ダウンロード」を使用してください。
```

---

## MIME Type ベース制御

将来的には MIME Type による対象判定も検討する。

| MIME Type                                                                   | 制御  |
| --------------------------------------------------------------------------- | ----- |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`         | block |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation` | block |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document`   | block |

---

## Manifest V3 方針

Manifest V3 を採用する。

理由：

- Chrome 標準
- Edge 標準
- Firefox は Phase 1 で `background.scripts` 前提に実装する
- Chrome / Edge は Phase 2 で Service Worker 化する
- 将来的なストア配布に適している

---

## Content Script 詳細設計

### drive-menu-guard.ts

役割：

- Drive UI の監視
- 危険メニュー項目の視覚的無効化
- ボタン無効化

初期化例：

```ts
if (document.body) {
  initializeGuard();
} else {
  document.addEventListener("DOMContentLoaded", initializeGuard, {
    once: true,
  });
}
```

監視対象：

- context menu
- action menu
- file open menu
- toolbar menu

MutationObserver 例：

```ts
const observer = new MutationObserver(handleMutations);

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

検出対象文字列：

```ts
const blockedTexts = [
  "Google スプレッドシート",
  "Google スライド",
  "Google ドキュメント",
  "新しいタブで開く",
];
```

実装では、文字列だけで無効化せず、操作対象ファイルが Office ファイルかどうかを先に判定する。
判定材料は、Google Drive の選択状態、メニュー表示元の `aria-label`、ファイル名、詳細ペインに表示される MIME / 拡張子相当の情報とする。
判定できない場合は DOM 操作を行わない。
判定材料は `drive-patterns.ts` に定義し、Firefox 先行実装で得た DOM パターンをテスト fixture として保存する。
Google Drive の GUI 変更が疑われる場合は fixture を追加し、adapter の抽出結果を単体テストで確認してから本体ロジックを変更する。

設定反映後の判定イメージ：

```ts
type OfficeService = "sheets" | "slides" | "docs";

type GuardSettings = {
  blockSheets: boolean;
  blockSlides: boolean;
  blockDocs: boolean;
  hideDisabledLabel: boolean;
};

type OfficeFileKind = "xlsx" | "pptx" | "docx";

const serviceTextMap: Record<OfficeService, string[]> = {
  sheets: ["Google スプレッドシート", "Google Sheets"],
  slides: ["Google スライド", "Google Slides"],
  docs: ["Google ドキュメント", "Google Docs"],
};

type DriveDomSignal = {
  role?: string;
  ariaLabel?: string;
  text?: string;
  href?: string;
  fileName?: string;
};

function getBlockedTexts(settings: GuardSettings): string[] {
  return [
    ...(settings.blockSheets ? serviceTextMap.sheets : []),
    ...(settings.blockSlides ? serviceTextMap.slides : []),
    ...(settings.blockDocs ? serviceTextMap.docs : []),
    "新しいタブで開く",
    "Open in new tab",
  ];
}
```

判定ロジック：

```ts
function shouldDisableMenuItem(
  element: HTMLElement,
  settings: GuardSettings,
  fileKind: OfficeFileKind | null,
): boolean {
  if (fileKind === null) {
    return false;
  }

  const signal = driveDomAdapter.extractSignal(element);

  return (
    drivePatterns.getFileKind(signal) === fileKind &&
    drivePatterns.matchesBlockedAction(signal, getBlockedTexts(settings))
  );
}
```

UI制御方式は、原則として `remove()` や `display: none` ではなく、表示を残したまま視覚的に無効化する。

理由：

- ユーザーに「操作は禁止されている」ことを明示できる
- Google Drive の DOM 構造を大きく変えずに済む
- Drive 内部イベントの破壊を避けやすい
- 再描画時の安定性を高める

視覚的無効化の実装イメージ：

```ts
function disableMenuItem(element: HTMLElement): void {
  if (element.dataset.driveOfficeGuardDisabled === "true") {
    return;
  }

  element.dataset.driveOfficeGuardDisabled = "true";
  element.setAttribute("aria-disabled", "true");
  element.setAttribute("tabindex", "-1");

  element.style.opacity = "0.45";
  element.style.backgroundColor = "rgba(0, 0, 0, 0.06)";
  element.style.cursor = "not-allowed";

  const suffix = document.createElement("span");
  suffix.textContent = "（拡張機能により無効化）";
  suffix.className = "anti-google-office-disabled-label";
  suffix.style.marginLeft = "8px";
  suffix.style.fontSize = "0.85em";

  element.appendChild(suffix);

  element.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  element.addEventListener(
    "keydown",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}
```

注意点：

- `pointer-events: none` は使用しない
- クリックイベントは capture phase で止める
- `innerHTML` は使用しない
- 二重にラベルを追加しないよう `data-anti-google-office-disabled` で制御する
- Google Drive 側の再描画で元に戻る可能性があるため、MutationObserver で再適用する
- Google Drive 固有のセレクタ、文言、属性名は `drive-patterns.ts` 以外に追加しない
- 新しい Drive UI パターンを見つけた場合は fixture と抽出テストを先に追加する

---

## Background 詳細設計

### background-firefox.ts

役割：

- 設定の読み込みと正規化
- `storage.managed` / `storage.sync` の優先順位制御
- 設定変更時の DNR 動的ルール更新
- インストール時、起動時、設定変更時の DNR 期待状態同期

Firefox Phase 1 では `background.scripts` で `background-firefox.ts` を読み込む。
Chrome / Edge Phase 2 では同じ共有ロジックを `service-worker-chromium.ts` から呼び出す。
background 固有 API の差異は entrypoint 側で吸収し、DNR ルール生成、設定正規化、管理ポリシー優先判定は `src/shared/` に置く。

対象ホスト：

```ts
const blockedHosts = ["docs.google.com"];
```

対象Path：

```ts
const blockedPaths = ["/spreadsheets/", "/presentation/", "/document/"];
```

設定反映後は、無効化対象サービスに応じて対象 Path を動的に決定する。

```ts
function getBlockedPaths(settings: GuardSettings): string[] {
  return [
    ...(settings.blockSheets ? ["/spreadsheets/"] : []),
    ...(settings.blockSlides ? ["/presentation/"] : []),
    ...(settings.blockDocs ? ["/document/"] : []),
  ];
}
```

ブロック判定：

```ts
function isBlockedUrl(url: string): boolean {
  const parsedUrl = new URL(url);

  return (
    parsedUrl.hostname === "docs.google.com" &&
    blockedPaths.some((path) => parsedUrl.pathname.startsWith(path))
  );
}
```

Background Script は `tabs.update` を主制御にしない。
Firefox Phase 1 では DNR の `redirect` ルールを正とし、Background Script は設定変更に応じて動的ルールを更新する。
Block Page は Phase 1 では設定に基づき、現在制限中の Google Docs / Sheets / Slides だけを表示する。
URL 別の理由表示や監査ログは Phase 3 で扱う。

動的ルール更新例：

```ts
await browser.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1001, 1002, 1003],
  addRules: buildDnrRules(settings),
});
```

---

## DeclarativeNetRequest 詳細

### Dynamic Rules

Phase 1 では、Firefox で設定変更に追従するため静的 ruleset ではなく Dynamic Rules を使用する。
ルール ID はサービスごとに固定し、更新時は既知 ID を削除してから有効な設定分だけ追加する。

```ts
const RULE_ID_SHEETS = 1001;
const RULE_ID_SLIDES = 1002;
const RULE_ID_DOCS = 1003;

const dnrRuleTemplates = [
  {
    id: RULE_ID_SHEETS,
    service: "sheets",
    pathPrefix: "/spreadsheets/",
  },
  {
    id: RULE_ID_SLIDES,
    service: "slides",
    pathPrefix: "/presentation/",
  },
  {
    id: RULE_ID_DOCS,
    service: "docs",
    pathPrefix: "/document/",
  },
] as const;
```

DNR ルールは、ユーザー設定または管理ポリシーに応じて有効化するルールを切り替える。

- Sheets ブロック用ルール
- Slides ブロック用ルール
- Docs ブロック用ルール

Firefox では `declarativeNetRequest.updateDynamicRules` を使用し、設定変更時に動的ルールを更新する。
Dynamic Rules はブラウザセッションと拡張機能更新をまたいで保持されるため、拡張機能のインストール時、起動時、設定変更時に必ず期待状態へ同期する。

ルール生成例：

```ts
function buildDnrRule(
  id: number,
  pathPrefix: string,
): browser.DeclarativeNetRequest.Rule {
  return {
    id,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        extensionPath: "/blocked.html",
      },
    },
    condition: {
      urlFilter: `||docs.google.com${pathPrefix}`,
      resourceTypes: ["main_frame"],
    },
  };
}
```

必要権限：

- `declarativeNetRequest`
- `storage`
- `host_permissions` の `https://docs.google.com/*`

`redirect` で拡張内ページへ遷移するため、対象 URL への host permission を必須とする。
また、`extensionPath` で拡張内ページへ遷移するため、`blocked.html` を `web_accessible_resources` に含める。

---

## Firefox 対応

Firefox 対応は Phase 1 で実施する。
Firefox 実装を正本とし、Chrome / Edge は Phase 2 で移植する。

Firefox では以下を考慮する。

- `browser` namespace
- Promise API
- Manifest V3 の差異
- DNR API の差異
- `background.scripts` と Chrome / Edge の Service Worker の差異

共通化のため、`webextension-polyfill` を採用する。

```bash
npm install webextension-polyfill
```

以下のような実装は避ける。

```ts
const api = chrome ?? browser;
```

代わりに以下で統一する。

```ts
import browser from "webextension-polyfill";
```

Phase 1 の完了条件：

- Firefox の対象バージョンを明示する
- `declarativeNetRequest` で `docs.google.com` の main_frame redirect が実現できるか確認する
- `background.scripts` で設定同期と DNR 動的ルール更新が動作することを確認する
- `storage.managed` の配布方式を `policies.json` または native manifest のどちらに寄せるか決定する
- Firefox Add-ons の審査要件に合わせて権限説明を整理する

### Chrome / Edge 移植方針

Chrome / Edge は Phase 2 対象とする。
Firefox 先行実装のうち、以下は共有して移植する。

- `drive-dom-adapter.ts`
- `drive-patterns.ts`
- `config.ts`
- `dnr-rules.ts`
- Options Page

Chrome / Edge で差し替えるものは以下に限定する。

- manifest
- background entrypoint
- managed storage schema 配布
- ストア審査向け権限説明

---

## Manifest 設計

### Firefox

```json
{
  "manifest_version": 3,
  "name": "Office Breakage Blocker for Google Drive",
  "version": "0.1.0",

  "permissions": ["storage", "declarativeNetRequest"],

  "host_permissions": ["https://drive.google.com/*", "https://docs.google.com/*"],

  "background": {
    "scripts": ["background-firefox.js"],
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["https://drive.google.com/*"],
      "js": ["drive-menu-guard.js"],
      "run_at": "document_idle"
    }
  ],

  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  },

  "web_accessible_resources": [
    {
      "resources": ["blocked.html"],
      "matches": ["https://docs.google.com/*"]
    }
  ],

  "browser_specific_settings": {
    "gecko": {
      "id": "anti-google-office@example.invalid"
    }
  }
}
```

### Chrome / Edge

Chrome / Edge は Phase 2 で以下を分離する。

```text
manifest.chrome.json
manifest.edge.json
```

Chrome / Edge では `background.service_worker` を使用する。
Firefox の `background.scripts` をそのまま流用せず、`service-worker-chromium.ts` から共有ロジックを呼び出す。
Chrome / Edge の `storage.managed` は `managed_schema.json` を manifest に指定する。

---

## 設定画面

Phase 1 で Options Page を追加する。
ユーザー設定が存在しない場合は初期値を保存せず、読み込み時にデフォルト値を適用する。
管理ポリシーが存在する項目は Options Page 上で読み取り専用表示にする。

設定例：

| 設定              | 内容                                                             | Phase |
| ----------------- | ---------------------------------------------------------------- | ----- |
| blockSheets       | Google スプレッドシートを無効化する                              | 1     |
| blockSlides       | Google スライドを無効化する                                      | 1     |
| blockDocs         | Google ドキュメントを無効化する                                  | 1     |
| hideDisabledLabel | 「拡張機能により無効化」の括弧書きを表示せずグレーアウトのみ行う | 1     |
| allowRules        | 例外許可ルール                                                   | 2     |

設定保存には以下を使用する。

```ts
browser.storage.sync;
```

初期値は、安全側に倒すためすべて ON とする。

```json
{
  "blockSheets": true,
  "blockSlides": true,
  "blockDocs": true,
  "hideDisabledLabel": false
}
```

Enterprise 環境では管理者が `storage.managed` により同等の設定を配布できるようにする。
管理ポリシー値はユーザー設定より優先し、ユーザーは上書きできない。

---

## ホワイトリスト

ホワイトリストは Phase 2 対象とする。
Phase 1 では例外許可を実装しない。

想定例：

```text
service:docs allow
fileId:1AbCdEf... allow
workspacePolicy:office-editor-exception allow
```

用途：

- 一部サイト許可
- テスト環境許可
- 管理者による例外設定

注意点：

- `docs.google.com` は全組織で共通ホストのため、単純なホスト名ホワイトリストでは要件を満たせない
- 許可条件は、対象サービス、Drive ファイル ID、管理ポリシーのいずれで表現するかを Phase 2 で決定する
- 個人情報やメールドメインを content script で収集しない

---

## Enterprise 対応

### Chrome Enterprise

Google Admin Console で以下を行う。

- 強制インストール
- 削除禁止
- 拡張設定配布

Phase 2 で `storage.managed` の読み込みに対応する。
配布には管理ストレージ用スキーマとポリシー値を用意する。

```json
{
  "blockDocs": true,
  "blockSheets": true,
  "blockSlides": true
}
```

管理ポリシーの読み込み方針：

- `storage.managed.get()` が失敗した場合は管理ポリシーなしとして扱い、ユーザー設定へフォールバックする
- 管理ポリシーに存在するキーだけを管理対象とし、未指定キーはユーザー設定またはデフォルト値を使用する
- `storage.managed` へ書き込まない

### 独自ドメイン Google Workspace 対応

Enterprise 環境では、`gmail.com` アカウントだけでなく、独自ドメインで運用されている Google Workspace を前提に対応する。

例：

```text
user@example.com
user@corp.example.jp
```

対応方針：

- アカウントのメールドメインに依存してブロック判定を行わない
- `drive.google.com` / `docs.google.com` の URL と UI 表示を基準に制御する
- 組織ごとの差異は `storage.managed` による管理ポリシーで吸収する
- 必要に応じて対象サービス、通知文言、Phase 2 の例外許可ルールを管理者が配布できるようにする

### Edge for Business

Phase 2 で Chrome とほぼ同じ設計で対応する。

### Firefox Enterprise

Phase 1 で native manifest または `3rdparty` enterprise policy による managed storage 配布を検討する。

---

## パフォーマンス方針

Google Drive は DOM が複雑で重いため、以下は禁止する。

- 常時全DOM走査
- 毎秒 polling
- `querySelectorAll` の無限実行

推奨：

- MutationObserver + debounce
- メニュー表示時のみ処理
- 対象ノード周辺のみ探索
- 文字列判定対象を menuitem 相当に限定
- 既に無効化済みの要素は `data-anti-google-office-disabled` で再処理しない
- 設定値は Background Script から必要時に読み、Content Script 側で短時間キャッシュする
- Drive DOM 解析は adapter 経由に限定し、全機能が個別に DOM を走査しない
- Drive GUI パターンごとの fixture を持ち、DOM 変更時の修正対象を adapter と pattern に限定する

---

## Google Drive 仕様変更検知とフェイルセーフ

Google Drive は DOM 構造やメニュー構成が頻繁に変更される可能性がある。
誤った DOM 操作により通常操作を破壊しないため、仕様変更を検知した場合は安全側に倒す。

### 保守性方針

Google Drive の GUI 変更へ追従しやすくするため、実装は以下の境界を守る。

- Drive DOM からの情報抽出は `drive-dom-adapter.ts` に集約する
- UI 文言、role、aria 属性、URL path、拡張子などの判定パターンは `drive-patterns.ts` に集約する
- 本体処理は adapter が返す `DriveDomSignal` のみを参照し、生 DOM に直接依存しない
- 新しい Drive GUI を確認した場合は fixture を追加し、抽出結果の単体テストで既存挙動を保証する
- 判定 confidence が閾値未満の場合は DOM を変更せず、URL ブロックで保護する

### 検知対象

以下のような状態を仕様変更の疑いとして扱う。

- 想定している `role="menuitem"` 相当の要素が取得できない
- メニュー項目のテキスト構造が想定と大きく異なる
- `aria-label` / `innerText` / `role` の組み合わせが既知パターンに一致しない
- Google Drive の主要コンテナ構造が取得できない
- メニュー候補要素が過剰に検出され、誤判定の可能性が高い

### フェイルセーフ動作

仕様変更を検知した場合、Content Script は以下の動作を行う。

- 拡張機能による DOM の変更を停止する
- メニュー項目の視覚的無効化を行わない
- 画面上に通知を表示する
- URL ブロックは Background Script / DNR 側で継続する

表示文言：

```text
Googleドライブの仕様変更を検知したため、ボタンの無効化は行われません
```

通知は Google Drive 画面の右上など、操作を妨げにくい位置に表示する。
通知 DOM は拡張機能側で生成し、`innerHTML` は使用しない。

### 実装イメージ

```ts
function detectDriveSpecChange(): boolean {
  const menuItems = document.querySelectorAll('[role="menuitem"]');

  if (menuItems.length > 200) {
    return true;
  }

  return false;
}

function notifyDriveSpecChange(): void {
  const notice = document.createElement("div");
  notice.textContent =
    "Googleドライブの仕様変更を検知したため、ボタンの無効化は行われません";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.className = "anti-google-office-notice";
  document.body.appendChild(notice);
}
```

メニュー未表示時は `role="menuitem"` が 0 件でも正常状態の可能性があるため、0 件だけでは仕様変更と判定しない。
仕様変更判定は、メニュー表示を検知した後に、候補要素の構造や件数が既知パターンから大きく外れる場合に限定する。

### 注意点

フェイルセーフは Drive UI の DOM 変更を止めるための仕組みであり、`docs.google.com` への直接アクセスブロックとは独立して動作する。
そのため、仕様変更検知時でも URL ブロックによる保護は継続する。

---

## リリース方針

配布先：

- Firefox Add-ons（Phase 1）
- Chrome Web Store（Phase 2）
- Microsoft Edge Add-ons（Phase 2）

CI/CD：

- GitHub Actions
- build
- lint
- test
- zip artifact
- GitHub Releases

タグ例：

```text
v0.1.0
v0.1.1
v0.2.0
```

---

## README 方針

README に以下を記載する。

- インストール方法
- ブロック対象
- 制限事項
- Enterprise 配布方法
- 管理ポリシー例
- 開発者向けビルド手順

---

## 制限事項

ブラウザ拡張単体では完全防止ではない。

以下は回避可能：

- 拡張無効化
- 別ブラウザ利用
- curl/API 利用
- 管理外端末からのアクセス

本当に強制したい場合は以下が必要。

- Chrome Enterprise
- Edge for Business
- Firefox Enterprise
- MDM
- Endpoint 管理
- DLP

---

## MVP 開発順

### Step 1

Firefox 向けの Drive menu item disable を実装する。

### Step 2

Firefox 向けの docs.google.com block を実装する。

### Step 3

block page を実装する。

### Step 4

Firefox 対応版をパッケージ化する。

### Step 5

管理ポリシーと Options Page の動作を確認する。

### Step 6

Drive GUI パターン fixture と DOM adapter の単体テストを整備する。

### Step 7

Chrome / Edge への移植方針を整理する。

---

## Phase 1 MVP

実装対象：

- Drive メニュー項目の視覚的無効化
- docs.google.com ブロック
- block page
- Firefox 対応
- Sheets / Slides / Docs の個別ブロック設定
- Google Drive 仕様変更検知時のフェイルセーフ通知
- Options Page
- `storage.managed` の読み取り対応
- Drive DOM adapter / pattern 分離
- Drive GUI パターン fixture と抽出テスト

### Phase 1 MVP 進捗

- [x] Firefox MV3 向け `manifest.firefox.json` を追加
- [x] Vite / TypeScript / ESLint / Prettier / Vitest 設定を追加
- [x] `storage.managed` 優先、未指定キーは sync/default へ fallback する設定処理を追加
- [x] DNR dynamic rules で rule id 1001/1002/1003 を使うルール生成を追加
- [x] Firefox background で install/startup/storage 変更時の DNR 同期を追加
- [x] Drive 固有文言・判定を `drive-patterns.ts` に集約
- [x] Drive DOM adapter と Drive menu guard を追加
- [x] `innerHTML`、`pointer-events: none`、DOM 要素削除を使わない無効化処理を追加
- [x] block page を追加
- [x] Options Page を追加
- [x] Drive fixture と adapter/rules/config の単体テストを追加
- [x] README の実装手順と設計書リンクを更新
- [x] レビュー指摘に基づき、Content Script fallback の managed 優先解決と無効化状態の復元を追加

未実施:

- [ ] Firefox 実機で `dist/manifest.json` を一時アドオンとして読み込み、DNR redirect と Options Page を確認する

---

## Phase 2

追加対象：

- Chrome / Edge 対応
- MIME Type 制御
- ホワイトリスト
- 管理ポリシーの高度化
- 独自ドメイン Google Workspace 向け設定テンプレート

---

## Phase 3

追加対象：

- 監査ログ
- 管理サーバ連携
- Remote Config
- 組織単位制御
- 利用状況レポート

---

## ライセンス候補

推奨：MPL 2.0

理由：

- 改変公開を要求できる
- 拡張配布と相性がよい
- 企業利用も可能
- MIT よりも派生コード保護がしやすい

---

## 最終目標

ユーザーは Google Drive 上で以下のみ可能にする。

- Preview
- Download

Office ファイルは以下の状態を実現する。

- Google変換されない
- レイアウト破壊されない
- 誤保存されない
- フォントやアニメーションが壊れない

---

## まとめ

本設計では、Sheets / Slides / Docs を一律に禁止するだけでなく、ユーザーまたは管理者が必要なサービスのみを個別に無効化できる構成とする。
また、独自ドメインの Google Workspace 環境でも利用できるよう、メールドメインに依存せず Google Drive / docs.google.com の挙動を基準に制御する。
さらに、Google Drive の仕様変更を検知した場合は DOM 変更を停止し、画面上に通知を表示することで、安全性と保守性を優先する。

Office Breakage Blocker for Google Drive は、Google Drive の利便性を維持しつつ、Microsoft Office ファイルを Google Docs / Sheets / Slides で開くことによる互換性破壊を防ぐための WebExtensions ベースのブラウザ拡張機能である。

特に以下を重視する。

- PowerPoint / Excel / Word 資産の保護
- Preview / Download 中心の運用
- Phase 1 で Firefox 対応、Phase 2 で Chrome / Edge 対応
- 将来的な Enterprise 配布
- TypeScript による保守性の高い実装
