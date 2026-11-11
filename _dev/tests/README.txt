HRMS Calc と個人サイトのテスト（_dev/ は GitHub Pages では公開されません）

リポジトリのルートで実行します。
プルリクエストと main への push では、GitHub Actions（.github/workflows/tests.yml）が 1 と 2 を自動で実行します。

1. 計算・科学的回帰テスト（Node.js 20.11 以降、ブラウザー不要）
     node --test _dev/tests/unit.test.mjs _dev/tests/features.test.mjs
   unit.test.mjs：定数（NIST・CODATA 2022 をテスト内に独立入力して照合）、C6H12O6 の期待値、19種類のイオン、
   原子を含まないイオンの拒否、ppm・mDa の境界、入力検証、検索上限による不完全状態、総当たりとの一致。
   features.test.mjs：同位体パターン（同位体組成の総当たりと照合）、論文・SI用の記載文、記載チェック、一括計算の入力。

2. ブラウザーテスト（Playwright と Chromium が必要）
     npm install playwright && npx playwright install chromium
     python3 -m http.server 8765 &        （リポジトリのルートで）
     node _dev/tests/browser.test.cjs
   BASE_URL=https://yosuke-matsuo.github.io node _dev/tests/browser.test.cjs で公開中のサイトも確認できます。
   Chromium の場所を指定する場合：CHROMIUM=/path/to/chrome
   file:// では ES Modules と Worker が動かないため、必ず HTTP で確認します。

3. 同位体データの再作成（任意）
     python3 _dev/tests/make_isotopes.py <NISTのASCII表> hrms-calc/constants.js hrms-calc/isotopes.js

英語版ページ（en/*.html）の再作成
     python3 _dev/build_en.py           日本語のページから en/ を作り直す（個人ページを変更したら実行）
     python3 _dev/build_en.py --check   en/ が日本語のページと一致しているか確認（ブラウザーテストでも確認）
