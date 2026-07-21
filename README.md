# glossai

読んでいる英文を日本語で解説してくれるオープンソースの英語リーダー。

英文を貼り付けると glossai が読解を支援します。単語をクリック、または短いフレーズをドラッグ選択すると、意味・IPA発音・ニュアンス・語源・例文を日本語の解説と音声再生つきで表示します。ワンクリックで文章全体の段落ごとの読解解説も生成できます。

glossai は BYOK (bring your own key) かつセルフホスト前提です。API キーはモデルプロバイダ以外のどこにも中継しません。

![screenshot placeholder](./docs/screenshot.png)

## 機能

- **貼り付けて読むだけ** — 英文を貼り付けるだけ。アカウント不要、必要なのは API キーのみ。
- **単語・フレーズ検索** — 単語をクリック、または 2〜6 語をドラッグ選択すると、意味・品詞・IPA・ニュアンス・語源のポップオーバーを表示。
- **音声つき例文** — 各単語に文脈に沿った例文を 2 つ生成。それぞれに再生ボタンつき。
- **文章全体の読み上げ** — AI解説の横 (および履歴の引用原文) の読み上げボタンで文章全体を音声合成して再生。再生/停止のトグルつき。
- **AI 読解解説** — 文章全体を一文ずつストリーミングで解説。学ぶ価値のある重要表現も抽出。
- **解説内の英語もクリック可能** — AI 読解解説の中で引用された英単語・フレーズもクリックでき、本文と同じ GlossCard が開きます。
- **永続キャッシュと履歴** — 単語検索と読解解説はローカルの SQLite データベースにキャッシュされ、同じ単語や文章の再検索は生成し直さず即座に返ります。どちらも `/history` ページ (単語 / 文章タブ) から閲覧でき、文章を展開して解説を読み直したり、リーダーに送り直したりできます。[データ保存](#データ保存) を参照。
- **BYOK・セルフホスト** — 自分の Anthropic / OpenAI API キーを使用。リクエストのライフサイクルを超えてサーバー側に保存されるものはありません。
- **プラグイン式プロバイダ** — LLM と TTS のバックエンドは薄いインターフェースと小さなレジストリ (`src/lib/llm`, `src/lib/tts`) の背後にあり、プロバイダの差し替え・追加でルートハンドラや UI を触る必要がありません。TTS は macOS 組み込みの `say` でそのまま動くため、API キーなしで音声が使えます。

## クイックスタート

```bash
pnpm i
cp .env.example .env.local
# .env.local を編集して API キーを設定
pnpm dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

## 設定

設定はすべて環境変数 (`.env.local`) で行います:

| 変数 | 必須 | デフォルト | 説明 |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | `GLOSSAI_LLM_PROVIDER=anthropic` の場合は必須 | — | 読解解説と単語・フレーズ検索に使用。 |
| `OPENAI_API_KEY` | `GLOSSAI_TTS_PROVIDER=openai` の場合は必須 | — | OpenAI API 経由の音声合成に使用。 |
| `GLOSSAI_LLM_PROVIDER` | いいえ | `anthropic` | `anthropic` または `claude-code` — 下記 [Claude サブスクリプションを使う](#claude-サブスクリプションを使う-claude-code-バックエンド) を参照。 |
| `GLOSSAI_MODEL` | いいえ | `claude-opus-4-8` (`anthropic`) / `sonnet` (`claude-code`) | 読解解説と単語検索の両エンドポイントで使うモデル。 |
| `GLOSSAI_TTS_PROVIDER` | いいえ | `say` | `say` (macOS 組み込み TTS、API キー不要) または `openai` (`gpt-4o-mini-tts`、`OPENAI_API_KEY` が必要)。 |
| `GLOSSAI_TTS_VOICE` | いいえ | `Samantha` (`say`) / `alloy` (`openai`) | 使用中の TTS プロバイダの声の名前。`say` の場合は `say -v '?'` に載っている名前であること。 |
| `GLOSSAI_DB` | いいえ | `data/glossai.db` | SQLite キャッシュ/履歴データベースのパス。[データ保存](#データ保存) を参照。 |

## プロバイダ (プラグインアーキテクチャ)

LLM と TTS のバックエンドはどちらも小さなレジストリ — `src/lib/llm/registry.ts` と `src/lib/tts/registry.ts` — の背後のプラグイン式プロバイダです。新しいバックエンドの追加は 3 ステップ:

1. **インターフェースを実装する** — `LlmProvider` (`src/lib/llm/types.ts`) または `TtsProvider` (`src/lib/tts/types.ts`) を、既存プロバイダと同じ場所に新しいファイルで実装。
2. **登録する** — 対応する `registry.ts` の `providers` マップに 1 行追加。
3. **切り替える** — `GLOSSAI_LLM_PROVIDER` または `GLOSSAI_TTS_PROVIDER` に登録名を設定。

他のファイルの変更は不要です。ルートハンドラはインターフェースしか見ません。未登録のプロバイダ名は、デフォルトに黙ってフォールバックせず、登録済み名の一覧つきで即座にエラーになります。

組み込みプロバイダ:

| レジストリ | 名前 | ファイル | 備考 |
| --- | --- | --- | --- |
| LLM | `anthropic` (デフォルト) | `src/lib/llm/anthropic.ts` | 公式 Anthropic SDK。`ANTHROPIC_API_KEY` に課金。 |
| LLM | `claude-code` | `src/lib/llm/claude-code.ts` | ローカルの `claude` CLI。API キーではなくサブスクリプションログイン。 |
| TTS | `say` (デフォルト) | `src/lib/tts/say.ts` | macOS 組み込みの `say`。API キー不要、macOS 専用。 |
| TTS | `openai` | `src/lib/tts/openai.ts` | OpenAI API 経由の `gpt-4o-mini-tts`。 |

## Claude サブスクリプションを使う (Claude Code バックエンド)

Claude のサブスクリプション (Pro/Max) を持っていて API クレジットを別途払いたくない場合は、次を設定してください:

```bash
GLOSSAI_LLM_PROVIDER=claude-code
```

読解解説と単語検索のエンドポイントが、Anthropic API の代わりにローカルの [Claude Code](https://claude.com/product/claude-code) CLI (`claude -p`、ヘッドレス/print モード) を経由するようになります。このバックエンドでは `ANTHROPIC_API_KEY` は不要です。この設定は TTS とは独立しています — 上記の `GLOSSAI_TTS_PROVIDER` を参照。

要件:

- `claude` CLI がインストール済みで `PATH` に通っていること。
- ログイン済みであること (`claude auth login` — API キーではなくサブスクリプション OAuth)。

補足:

- これは個人・ローカル利用向けの構成です。リクエストごとに `claude` サブプロセスを起動するため、API 直接呼び出しよりレイテンシが高くなります (生成時間に加えてリクエストあたり数秒程度の固定オーバーヘッド)。
- ツール・MCP サーバー・セッション永続化は一切使いません。すべてのリクエストは glossai が送るプロンプトのみに閉じた、ステートレスな単発呼び出しです。
- `GLOSSAI_MODEL` は `claude --model` と同じ値 (`sonnet`/`opus`/`haiku` などのエイリアス、または完全なモデル ID) を受け付けます。このバックエンドではリクエストあたりのレイテンシとサブスクリプションの共有レート制限を抑えるため、デフォルトは `sonnet` です。

## データ保存

単語・フレーズ検索と読解解説はすべてサーバー側の SQLite データベースにキャッシュされ、同じ単語の再検索 (や解説済み文章の再読) は LLM を呼び直さず生成を完全にスキップします。両テーブルが `/history` ページの単語タブ・文章タブの元データです。

- **場所**: `GLOSSAI_DB` (デフォルト `data/glossai.db`。初回実行時に作成され、親ディレクトリがなければ自動作成)。
- **内容**: 単語・フレーズの検索カード (`words` テーブル: 表層形、文脈、生成された JSON、検索回数、タイムスタンプ) と読解解説テキスト (`explains` テーブル。原文のハッシュがキー)。API キーは保存されず、リクエストメタデータも各エントリを生成したプロバイダ/モデル以外は保存されません。
- **リセット**: DB ファイル (と WAL モードの `-wal`/`-shm` ファイル) を削除してください。次のリクエスト時に空のスキーマが再作成されます。

## BYOK

glossai は自分のインフラで自分の API キーを使って動かす設計です。上記の環境変数をリクエスト時に読む以外に、組み込みのプロキシ・利用量制限・キー管理はありません。公開デプロイする場合は、認証やレート制限を自前で前段に置いてください — glossai には含まれていません。

## ライセンス

MIT — [LICENSE](./LICENSE) を参照。
