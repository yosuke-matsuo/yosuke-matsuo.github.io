# yosuke-matsuo.github.io

松尾 洋介の個人ページ（GitHub Pages）。

## ファイル構成
- index.html / research.html / publications.html / profile.html … 各ページ
- styles.css / app.js … デザインと日英切り替え
- images/email.png … メールアドレス（画像）
- images/toc/ … 代表論文のTOC図（ファイル名は DOI の / を _ に置き換えたもの）
- .nojekyll … GitHub Pages にそのまま配信させるための空ファイル（消さない）

## TOC図の差し替え
images/toc/ の同じ名前のファイルを上書きするだけ。拡張子は .png か .svg。
両方ある場合は .png が優先される。形式を変えるときは古いほうを削除する。

- images/toc/10.1021_acs.jnatprod.5c01064.png  … J. Nat. Prod. 2026
- images/toc/10.1039_d5ob01323b.png  … Org. Biomol. Chem. 2025
- images/toc/10.1016_j.tet.2025.134751.png  … Tetrahedron 2025
- images/toc/10.1039_d5nj01278c.png  … New J. Chem. 2025
- images/toc/10.1002_asia.202100380.png  … Chem. Asian J. 2021
- images/toc/10.1002_ejoc.202001579.png  … Eur. J. Org. Chem. 2021
- images/toc/10.1021_acs.jnatprod.0c00691.png  … J. Nat. Prod. 2020
- images/toc/10.1002_anie.201706532.png  … Angew. Chem. Int. Ed. 2017
- images/toc/10.1055_s-0036-1588529.png  … Synlett 2017
- images/toc/10.1021_acs.jnatprod.5b00832.png  … J. Nat. Prod. 2016
- images/toc/10.1021_ol503212v.png  … Org. Lett. 2015
- images/toc/10.1016_j.tet.2015.03.016.png  … Tetrahedron 2015

## 更新のしかた
論文・学会発表が出たら Claude に「この論文を追加して」と依頼 → 更新版ZIPの中身をリポジトリにアップロード（同名ファイルは上書き）。
