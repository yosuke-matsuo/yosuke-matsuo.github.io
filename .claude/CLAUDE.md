# yosuke-matsuo.github.io の作業ルール

松尾洋介（九州医療科学大学 薬化学講座）の研究者ページと HRMS Calc。GitHub Pages（main ブランチのルート、ビルドなし）で公開。

## 進め方
- 説明・報告は日本語。
- main には直接 push しない。ブランチで作業し、ユーザーがプルリクエストを確認して Merge する。
- 変更をコミット・push したら、確認を待たずにプルリクエストまで作成する（ブランチのプルリクエストが Merge 済みなら、最新の main からやり直して新しいプルリクエストにする）。説明には変更内容とテスト結果を書く。
- 変更後は _dev/tests のテストを実行し、結果（実行できなかったテストを含む）を報告する。確認していないことを確認済みと書かない。

## 必ず守ること
- google53ef92aca7338314.html（Search Console の確認ファイル）は削除・変更しない。
- 未発表のデータは載せない。メールアドレスは画像（images/email.png）だけで表示し、文字・リンクにしない。
- 開発用のファイルやメモは _dev/ か .claude/ に置く（GitHub Pages で公開されない）。ルートに README や .md を置かない。.nojekyll は追加しない。
- 依頼に必要のない変更（特に研究内容・業績のページ）はしない。デザイン・配色・簡潔な文章を保ち、装飾や冗長な説明を増やさない。

## 個人ページ（index / research / publications / tools / 404）
- 日英両方を用意する（data-ja・data-en 属性、または data-lang の span）。言語は ?lang= と localStorage（ym-language）で引き継ぐ。
- 外部リンクは target="_blank" rel="noopener noreferrer"。
- 業績ページの画像は width・height に実寸、先頭以外は loading="lazy"、decoding="async"。画像の文字が読めなくなる圧縮はしない。

## HRMS Calc（hrms-calc/）
- ブラウザー内で完結する静的ツール。入力内容を外部に送信する処理を加えない。冒頭の「計算はすべてブラウザー内で行い、入力した内容はどこにも送信しません。」を残す。
- 文字列は app.js の strings（ja と en の両方）。
- constants.js（NIST の最も存在比の高い同位体の質量、電子質量 0.0005485799090441 Da = CODATA 2022）と isotopes.js（NIST の存在比）は、根拠なく変更しない。
- m/z = (Σ nᵢmᵢ − z·mₑ)/|z|。電子の質量の説明と Christmann, Org. Lett. 2025, 27, 4–7（https://doi.org/10.1021/acs.orglett.4c03458）へのリンクを残す。
- 表記：入力欄以外の分子式は原子数を下付き、イオンの電荷は上付き、m/z の m と z はイタリック（app.js の rich() を使う）。<option> は Unicode の上付き・下付き文字。
- 論文・SI用の記載文は J. Org. Chem.（ACS）の投稿規定の例の書式で、イオン化法は省略：HRMS m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.
- MIT License は hrms-calc のコードだけに適用する。
