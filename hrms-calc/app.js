import {ELEMENTS,IONS,parseFormula,ion,ionCounts,ppm,dbe,isotopePattern} from './core.js?v=20261107-2';
import {ionLabel,formulaHtml,siFormula,siSentence,checkText,parseBatch} from './si.js?v=20261107-2';
const $=id=>document.getElementById(id);
const strings={
 ja:{skip:'本文へ移動',
  lead:'HRMSの精密質量（m/z）の計算、分子式候補の検索、一括計算、論文・SIの記載文の作成とチェックができます。計算はすべてブラウザー内で行い、入力した内容はどこにも送信しません。',
  electronHead:'電子の質量を考慮して計算します。',electronShort:'正イオンでは電子の質量を引き、負イオンでは足します。考慮しないと数ppmずれます。',electronSurvey:'2023～2024年の<i>Org. Lett.</i>誌のSI約3000件の調査では、精密質量データの約3割に記載の誤りがあり、その約3分の2は電子の質量を考慮していないものでした（<a href="https://doi.org/10.1021/acs.orglett.4c03458" target="_blank" rel="noopener noreferrer">Christmann, <i>Org. Lett.</i> 2025, <i>27</i>, 4⁠–⁠7</a>）。',details:'詳しく',
  tabCalc:'精密質量',tabFinder:'分子式検索',tabBatch:'一括計算',tabCheck:'記載チェック',
  journals:'主な雑誌のHRMSの書き方',journalsLink:'主な雑誌の書き方',psj:'日本薬学会',jsp:'日本生薬学会',
  journalsIntro:'投稿規定に載っている記載例を、そのまま示します（2026年11月7日に原文を確認）。HRMS Calc の記載文は ACS の書式で、計算値はイオンの値（電子の質量を考慮）です。',
  jAcs:'分子式と計算値には、付加した原子（H・Na など）を含めます。イオン化法と質量分析計の種類も書きます。分子量1000未満では、計算値との差が 0.003 m/z 以内なら通常は十分とされています。例の計算値は、電子の質量を引いたイオンの値です。',
  jJnp:'J. Nat. Prod. の規定では、データの書き方は ACS Research Data Guidelines に従うとされ、例はそちらのものです（J. Org. Chem. の例とは ESI-TOF の部分だけが違います）。誤差の上限は 5 ppm または 0.003 m/z で、装置のメーカー・型式・主な設定も書きます。',
  jWiley:'Angew. Chem.（version 10/26）と、Chemistry Europe・ACES の雑誌に共通の規定（version 09/26）で同じ例です。分子式は中性分子に Na+ を足す形で書き、イオンの種類は計算値の後ろに置きます。Angew. Chem. では、高分解能を 5 ppm の精度とし、測定条件（m/z の範囲、分解能、質量精度）の記載を求めています。例の計算値 548.3352 は電子の質量を考慮していない値で、[M+Na]+ の値は 548.3346 です。どちらの規定でも、天然物の単離・構造決定の論文では元素分析のデータが必要とされています。',
  jJnm:'Springer から出版されている日本生薬学会の雑誌です。日本薬学会の雑誌と同じ化合物の例で、計算値は中性分子の値です（電子の質量を引いた M⁺ の値は 332.1254）。規定は2019年4月10日の改訂です。',
  jMdpi:'Molbank のチェックリストの例で、ACS とほぼ同じ形です。分子量1000未満では、計算値との差が 0.003 m/z 以内なら通常は十分とされています。',
  jTet:'質量分析では、m/z、イオンの種類、計算値と実測値を書きます。構造が新しい低分子化合物には、通常 ¹H・¹³C NMR と HRMS が必要とされています。例には分子式が書かれていません。',
  jThieme:'calcd と found は小文字で、後ろにコロンを付けます。例の分子式は中性分子 M のもので、計算値 475.5285 は、この分子式の [M + H]+ の値（475.2585）と一致しません。',
  jPsj:'実測値を先に書き、計算値を括弧に入れます。イオンの種類は書きません。例の計算値は中性分子の値（332.12599）で、電子の質量を引いた M⁺ の値は 332.1254 です。',
  jNotListed:'確認した規定には、電子の質量についての記載はありませんでした。',
  method:'計算方法',sources:'出典・参考文献',
  formula:'分子式（中性分子 M）',ion:'イオンの種類',optionalFound:'実測 m/z（任意）',
  posIons:'正イオン',negIons:'負イオン',ionNone:'付加・脱離なし',ionColM:'M',ionCol2M:'2M',ionColZ2:'M（2価）',
  syntax:'H・Na などの付加・脱離は「イオンの種類」で選びます。括弧・同位体・電荷は入力できません。',
  calculate:'計算する',calcPlaceholder:'分子式を入力すると、ここに結果が表示されます。',
  mz:'計算 m/z',neutral:'中性分子 M',ionFormula:'イオンの組成',measured:'実測 m/z',diff:'誤差',
  siTitle:'論文・SI用の記載',siSource:'J. Org. Chem.（ACS）の投稿規定の例と同じ書式です（イオン化法は省略）。',
  siAppend:'Na・K・Li・Cl を分子式の末尾に書く（例：C6H12O6Na）',siCopy:'記載文をコピー',
  siNeedFound:'実測 m/z を入力すると「Found」まで作成します。',
  isoTitle:'同位体パターン',peak:'ピーク',relative:'相対強度 (%)',
  isoNote:'相対強度は最も強いピークを100とします。',
  found:'実測 m/z',tolerance:'許容誤差 ±',
  rangeHelp:'中性分子 M の原子数の範囲（最小〜最大）を元素ごとに指定します。使わない元素は最大を 0 にします。付加イオンの原子は含めません。',
  moreElements:'その他の元素（金属・希土類など）',search:'候補を検索',cancel:'検索を中止',
  candidateNote:'許容誤差に入る組成を、誤差の小さい順に表示します。',
  filterTitle:'候補の絞り込み（任意）',
  filterDbe:'DBE が0以上の整数になる組成だけ（窒素ルールと同じ条件。P・金属などを含み DBE を計算できない組成は残します）',
  filterRatio:'元素比が一般的な範囲の組成だけ（H/C 0.2–3.1、N/C ≤ 1.3、O/C ≤ 1.2、P/C ≤ 0.3、S/C ≤ 0.8、Si/C ≤ 0.5。炭素を含まない組成は残します）',
  excludedFmt:n=>`絞り込みで除外 ${n} 件`,reset:'初期値に戻す',linkCopy:'この条件のリンクをコピー',
  savedNote:'イオンの種類・許容誤差・原子数の範囲・絞り込みは、このブラウザーに保存され、次回も使われます。',
  copy:'結果をコピー',
  batchHelp:'1行に1化合物を、名前（任意）・分子式・イオン（任意）・実測 m/z（任意）の順に、タブ・空白・カンマで区切って入力します。Excelの表も貼り付けられます。',
  batchInput:'化合物の一覧',batchIon:'イオンの種類（省略した行）',batchRun:'一括計算する',example:'例を入れる',
  label:'名前',line:'行',note:'メモ',copyTable:'表をコピー（Excel用）',copySiAll:'記載文をまとめてコピー',
  batchCount:(n,e)=>`${n} 件を計算しました`+(e?`（${e} 行は計算できませんでした）`:''),batchEmpty:'化合物を入力してください。',
  errToken:v=>`読み取れない項目：${v}`,errIon:v=>`イオンの種類を認識できません：${v}`,
  checkHelp:'論文・SIのHRMSの記載を貼り付けると、計算値（calcd）を検算します。複数の化合物をまとめて確認できます。',
  checkInput:'HRMSの記載',checkTol:'実測値の許容差 ± (ppm)',checkRun:'チェックする',
  checkNone:'「calcd for 分子式 数値」の形の記載が見つかりませんでした。',
  checkSummary:(n,a,b,c)=>`${n} 件を確認しました：一致 ${a} 件、要確認 ${b} 件、誤りの可能性 ${c} 件`,
  stOk:'一致',stWarn:'要確認',stError:'誤りの可能性',stUnparsed:'読み取り不可',
  cOk:'',cRounding:'最終桁の丸めが異なります。',
  cElectron:'記載の計算値は、電子の質量を補正していない値です。',
  cElectronSign:'記載の計算値は、電子の質量の加減が逆です。',
  cNeutralFormula:'分子式が中性分子 M のものです（計算値はイオンとして正しい値）。',
  cNeutralFormulaElectron:'分子式が中性分子 M のもので、記載の計算値は電子の質量も補正していません。',
  cMismatch:'計算値が一致しません。分子式・イオン・数値を確認してください。',
  cChargeAssumed:'電荷の記載がないため、±1 として照合しました。',
  cFewDigits:'桁数が少ないため、電子の質量の扱いは判定できません。',
  cFoundOff:tol=>`実測値との差が ±${tol} ppm を超えています。`,
  cFormula:'分子式を読み取れません（元素記号と数字のみ対応）。',
  stated:'記載の計算値',recalc:'正しい計算値',
  definition:'<i>n</i><sub>i</sub> は付加・脱離後のイオンに含まれる原子数、<i>m</i><sub>i</sub> は各元素の同位体質量、<i>z</i> は符号付きの電荷数です。2価以上のイオンは |<i>z</i>| で割ります。',
  electron:'正電荷1つにつき電子1個分の質量を引き、負電荷1つにつき足します（<i>m</i><sub>e</sub> = 0.0005485799090441 Da）。',
  precision:'結合エネルギーなどに相当する質量は含めません（通常の扱い）。表示は小数点以下6桁で、判定には丸める前の値を使います。',
  ppm:'誤差（ppm）=（実測値 − 計算値）/ 計算値 × 10⁶。誤差（mDa）=（実測値 − 計算値）× 1000。許容誤差は ± の範囲として使います。',
  filterMethod:'分子式検索の絞り込み：DBE の条件は、中性分子 M の DBE が0以上の整数であることです（C・H・N・O・S・ハロゲンの組成では窒素ルールと同じ条件）。元素比の条件は、Kind と Fiehn が示した「一般的な範囲」（データベースの分子式の99.7%を含む範囲）のうち、H・N・O・P・S・Si の炭素に対する比を使います。',
  urlMethod:'精密質量と分子式検索の入力は、ページのアドレス（URL）に入ります。そのアドレスをブックマーク・共有すると、同じ入力で開けます。一括計算と記載チェックの入力はアドレスに入りません。',
  ratioSource:'分子式の元素比の範囲',
  dbe:'DBE = 1 + C + N/2 − (H + F + Cl + Br + I)/2（中性分子 M の値。小数もそのまま表示）。C・H・N・O・S・ハロゲン以外を含む組成では「—」とします。',
  isotopes:'84元素に対応し、各元素で天然存在比が最も高い同位体の質量を使います（例：B は ¹¹B、Fe は ⁵⁶Fe）。Tc・Pm など天然の同位体組成がない元素は使えません。',
  isoMethod:'同位体パターンはNISTの存在比から計算し、同じ整数質量の同位体組成を1本にまとめます（m/z は存在比による加重平均）。高分解能では分かれて観測されることがあります。',
  checkMethod:'記載チェックでは、「calcd for」の後の分子式をイオンの組成として m/z を計算し直し、最終桁の丸めの範囲で一致するかを見ます。一致しない場合は、電子の質量の扱いの誤りや、中性分子の分子式のまま計算した可能性を調べます。',
  constants:'使用する同位体と質量を表示',
  isotopeSource:'同位体質量・存在比',electronSource:'電子質量',paperIntro:'HRMSデータの報告で多い誤り',
  accessDate:'データ参照日：2026年11月7日',
  electronWhy:'SIの精密質量データでは、この扱いの誤りが最も多いと報告されています。',
  sourceCode:'ソースコード',codeLicense:'HRMS Calcのプログラム：',
  rangeEmpty:'空欄です',rangeInt:'整数で入力してください',rangeBounds:'0〜1000の範囲で入力してください',rangeOrder:'最小が最大より大きくなっています',rangeNone:'少なくとも1つの元素で、最大を1以上にしてください。',
  minimum:'最小',maximum:'最大',
  running:'検索中…',complete:'検索完了',incomplete:'探索の上限に達したため、一部の結果です（見つかった候補の中での誤差順）。範囲を狭めて検索し直してください。',stopped:'検索を中止しました。',
  countFmt:n=>`候補 ${n} 件`,copyOk:'コピーしました',copyFail:'コピーできませんでした。選択してコピーしてください。',
  element:'元素',isotope:'同位体',mass:'質量 / Da',
  errorFormula:'分子式を確認してください。元素記号と正の整数だけを使えます。',
  errorFound:'実測 m/z は正の数で入力してください。',
  errorComposition:'この組成では指定したイオンになりません（脱プロトン化するHがない、など）。',
  errorRange:'原子数は0〜1000の整数で、最小 ≦ 最大にしてください。少なくとも1つの元素の最大を1以上にします。',
  errorSearch:'実測 m/z と許容誤差を確認してください（ppm は 0 以上、100万未満）。',
  errorLines:'一度に入力できるのは1000行までです。',
  errorGeneric:'計算できませんでした。入力を確認してください。',
  brandSub:'（HRMS精密質量計算ツール）',title:'HRMS Calc（HRMS精密質量計算ツール）'},
 en:{skip:'Skip to content',
  lead:'Calculates exact HRMS masses (m/z), finds candidate formulas, calculates many compounds at once, and writes and checks HRMS statements for papers and SI. Everything runs in your browser; nothing you enter is sent anywhere.',
  electronHead:'The electron mass is taken into account.',electronShort:'It is subtracted for positive ions and added for negative ions; ignoring it gives an error of a few ppm.',electronSurvey:'A survey of about 3000 SI files from <i>Org. Lett.</i> (2023–2024) found errors in about 30% of the reported accurate-mass data; about two-thirds of these came from ignoring the electron mass (<a href="https://doi.org/10.1021/acs.orglett.4c03458" target="_blank" rel="noopener noreferrer">Christmann, <i>Org. Lett.</i> 2025, <i>27</i>, 4⁠–⁠7</a>).',details:'Details',
  tabCalc:'Exact mass',tabFinder:'Find formulas',tabBatch:'Batch',tabCheck:'Check SI text',
  journals:'How major journals ask for HRMS data',journalsLink:'Other journals',psj:'Pharmaceutical Society of Japan',jsp:'Japanese Society of Pharmacognosy',
  journalsIntro:'Examples as printed in the author guidelines (checked against the originals on 7 November 2026). HRMS Calc writes statements in the ACS format, with calculated values for the ion (electron mass included).',
  jAcs:'Molecular formulas and Calcd values include any added atoms (usually H or Na); the ionization method and mass analyzer type are reported. Below 1000 amu, a Found value within 0.003 m/z unit of the Calcd value is usually adequate. The Calcd value of the example is that of the ion, with the electron mass subtracted.',
  jJnp:'J. Nat. Prod. asks for data to follow the ACS Research Data Guidelines, which give this example (it differs from the J. Org. Chem. example only in ESI-TOF). The error limit is 5 ppm or 0.003 m/z units, and the instrument make, model and key settings are described.',
  jWiley:'The same example appears in Angew. Chem. (version 10/26) and in the guidelines shared by the Chemistry Europe and ACES journals (version 09/26). The formula is written as the neutral molecule plus Na+, and the ion type follows the calculated value. Angew. Chem. defines high resolution as 5 ppm precision and asks for the HRMS parameters (m/z range, resolution, mass accuracy). The calcd value of the example, 548.3352, does not include the electron mass; the [M+Na]+ value is 548.3346. Both guidelines require elemental analysis data for papers on the isolation and structure elucidation of natural products.',
  jJnm:'Journal of the Japanese Society of Pharmacognosy, published by Springer. The example is the same compound as in the Pharmaceutical Society of Japan journals; its Calcd value is the neutral value (M⁺ with the electron mass subtracted: 332.1254). Guidelines revised on 10 April 2019.',
  jMdpi:'The example from the Molbank checklist is almost the same as ACS. Below 1000 amu, found values within 0.003 m/z unit of the Calcd value are usually adequate.',
  jTet:'MS data list m/z values, ion type, and calculated and found values. Structurally novel small molecules typically need ¹H and ¹³C NMR and HRMS. The example gives no molecular formula.',
  jThieme:'Lowercase calcd and found, each followed by a colon. The formula in the example is that of the neutral M, and the calcd value 475.5285 does not match the [M + H]+ value of that formula (475.2585).',
  jPsj:'The found value comes first and the Calcd value is in parentheses; the ion type is not given. The Calcd value of the example is the neutral value (332.12599); with the electron mass subtracted, M⁺ is 332.1254.',
  jNotListed:'None of the guidelines checked mentions the electron mass.',
  method:'Method',sources:'Sources and references',
  formula:'Molecular formula (neutral M)',ion:'Ion type',optionalFound:'Measured m/z (optional)',
  posIons:'Positive ions',negIons:'Negative ions',ionNone:'none',ionColM:'M',ionCol2M:'2M',ionColZ2:'M (z = 2)',
  syntax:'Choose adducts and losses such as H or Na under “Ion type”. Parentheses, isotopes and charges cannot be entered.',
  calculate:'Calculate',calcPlaceholder:'Enter a formula and the result appears here.',
  mz:'Calculated m/z',neutral:'Neutral M',ionFormula:'Ion composition',measured:'Measured m/z',diff:'Error',
  siTitle:'Statement for papers and SI',siSource:'Same format as the example in the J. Org. Chem. (ACS) author guidelines (without the ionization method).',
  siAppend:'Write Na, K, Li or Cl at the end of the formula (e.g. C6H12O6Na)',siCopy:'Copy statement',
  siNeedFound:'Enter the measured m/z to add “Found”.',
  isoTitle:'Isotope pattern',peak:'Peak',relative:'Relative intensity (%)',
  isoNote:'Intensities are relative to the strongest peak (100).',
  found:'Measured m/z',tolerance:'Tolerance ±',
  rangeHelp:'Set the range of atom counts (minimum–maximum) for each element of the neutral M. Set the maximum to 0 for unused elements. Do not include adduct atoms.',
  moreElements:'More elements (metals, rare earths and others)',search:'Find formulas',cancel:'Cancel search',
  candidateNote:'Compositions within the tolerance, from the smallest error.',
  filterTitle:'Filter candidates (optional)',
  filterDbe:'Only compositions whose DBE is a non-negative integer (the same condition as the nitrogen rule; compositions with P, metals or other elements for which DBE cannot be calculated are kept)',
  filterRatio:'Only compositions with common element ratios (H/C 0.2–3.1, N/C ≤ 1.3, O/C ≤ 1.2, P/C ≤ 0.3, S/C ≤ 0.8, Si/C ≤ 0.5; compositions without carbon are kept)',
  excludedFmt:n=>`${n} excluded by the filters`,reset:'Reset to defaults',linkCopy:'Copy a link to these inputs',
  savedNote:'The ion type, tolerance, atom-count ranges and filters are saved in this browser and used next time.',
  copy:'Copy results',
  batchHelp:'One compound per line: name (optional), formula, ion (optional) and measured m/z (optional), separated by tabs, spaces or commas. Tables from Excel can be pasted.',
  batchInput:'Compounds',batchIon:'Ion type (for lines without one)',batchRun:'Calculate all',example:'Insert example',
  label:'Name',line:'Line',note:'Note',copyTable:'Copy table (for Excel)',copySiAll:'Copy all statements',
  batchCount:(n,e)=>`${n} compound${n===1?'':'s'} calculated`+(e?` (${e} line${e===1?'':'s'} could not be calculated)`:''),batchEmpty:'Enter one or more compounds.',
  errToken:v=>`Cannot read: ${v}`,errIon:v=>`Unknown ion type: ${v}`,
  checkHelp:'Paste HRMS statements from a paper or SI to recheck the calculated values (calcd). Many compounds can be checked at once.',
  checkInput:'HRMS statements',checkTol:'Tolerance for measured values ± (ppm)',checkRun:'Check',
  checkNone:'No statement of the form “calcd for formula value” was found.',
  checkSummary:(n,a,b,c)=>`${n} checked: ${a} correct, ${b} to review, ${c} possible error${c===1?'':'s'}`,
  stOk:'Correct',stWarn:'Review',stError:'Possible error',stUnparsed:'Not readable',
  cOk:'',cRounding:'The last digit is rounded differently.',
  cElectron:'The stated value was calculated without the electron mass.',
  cElectronSign:'The stated value adds and subtracts the electron mass the wrong way round.',
  cNeutralFormula:'The formula is that of the neutral M (the value is correct for the ion).',
  cNeutralFormulaElectron:'The formula is that of the neutral M, and the stated value was calculated without the electron mass.',
  cMismatch:'The calculated value does not match. Check the formula, ion and numbers.',
  cChargeAssumed:'No charge given, so ±1 was assumed.',
  cFewDigits:'Too few decimal places to judge the electron mass.',
  cFoundOff:tol=>`The measured value differs by more than ±${tol} ppm.`,
  cFormula:'The formula cannot be read (element symbols and numbers only).',
  stated:'Stated value',recalc:'Correct value',
  definition:'<i>n</i><sub>i</sub> is the number of atoms in the final ion, <i>m</i><sub>i</sub> the isotope mass of each element and <i>z</i> the signed charge. Ions with two or more charges are divided by |<i>z</i>|.',
  electron:'One electron mass is subtracted per positive charge and added per negative charge (<i>m</i><sub>e</sub> = 0.0005485799090441 Da).',
  precision:'Mass equivalents of binding energies are not included, as usual. Values are shown to six decimal places; judgments use unrounded values.',
  ppm:'Error (ppm) = (measured − calculated) / calculated × 10⁶. Error (mDa) = (measured − calculated) × 1000. The tolerance is applied as a ± range.',
  filterMethod:'Candidate filters: the DBE condition requires the DBE of the neutral M to be a non-negative integer (for C, H, N, O, S and halogens this is the same condition as the nitrogen rule). The element-ratio condition uses the ratios of H, N, O, P, S and Si to carbon in the “common range” given by Kind and Fiehn (covering 99.7% of the formulas in their database).',
  urlMethod:'The inputs of the calculator and the formula finder are kept in the page address (URL), so a bookmarked or shared address opens with the same inputs. Inputs of the batch and the checker are not kept in the address.',
  ratioSource:'Element-ratio ranges of formulas',
  dbe:'DBE = 1 + C + N/2 − (H + F + Cl + Br + I)/2 (for the neutral M, shown with any fraction). Compositions with elements other than C, H, N, O, S and halogens show —.',
  isotopes:'84 elements are supported, each with the mass of its most abundant isotope (for example ¹¹B for B and ⁵⁶Fe for Fe). Elements without a natural isotope composition, such as Tc and Pm, cannot be used.',
  isoMethod:'Isotope patterns are calculated from the NIST abundances; isotopologues with the same nominal mass are combined into one peak (m/z is the abundance-weighted mean). They may be resolved at high resolution.',
  checkMethod:'The checker takes the formula after “calcd for” as the composition of the ion, recalculates its m/z and checks agreement within rounding of the last digit. Otherwise it looks for errors in the electron mass or a value calculated from the neutral formula.',
  constants:'Show isotopes and masses used',
  isotopeSource:'Isotope masses and abundances',electronSource:'Electron mass',paperIntro:'Common errors in reporting HRMS data',
  accessDate:'Data accessed: 7 November 2026',
  electronWhy:'In accurate-mass data from SI files, errors in this were reported as the most frequent.',
  sourceCode:'Source code',codeLicense:'HRMS Calc code: ',
  rangeEmpty:'is empty',rangeInt:'must be a whole number',rangeBounds:'must be between 0 and 1000',rangeOrder:'minimum is larger than maximum',rangeNone:'Set a maximum of 1 or more for at least one element.',
  minimum:'Minimum',maximum:'Maximum',
  running:'Searching…',complete:'Search complete',incomplete:'The search limit was reached, so the results are partial (sorted by error among the candidates found). Narrow the ranges and search again.',stopped:'Search canceled.',
  countFmt:n=>`${n} candidate${n===1?'':'s'}`,copyOk:'Copied',copyFail:'Could not copy. Select the text and copy it manually.',
  element:'Element',isotope:'Isotope',mass:'Mass / Da',
  errorFormula:'Check the formula. Use element symbols and positive integers only.',
  errorFound:'Enter the measured m/z as a positive number.',
  errorComposition:'This composition cannot form the selected ion (for example, no H to remove for deprotonation).',
  errorRange:'Atom counts must be integers from 0 to 1000 with minimum ≤ maximum, and at least one element needs a maximum of 1 or more.',
  errorSearch:'Check the measured m/z and the tolerance (ppm must be at least 0 and below one million).',
  errorLines:'Up to 1000 lines can be entered at once.',
  errorGeneric:'The calculation failed. Check your input.',
  brandSub:' (HRMS Exact Mass Calculator)',title:'HRMS Calc (HRMS Exact Mass Calculator)'}
};
const EXAMPLES={
 batch:'Glucose\tC6H12O6\t[M+Na]+\t203.0524\nCatechin\tC15H14O6\t[M-H]-\t289.0716\nPunicalagin\tC48H28O30\t[M-2H]2-\t541.0263\nCaffeine C8H10N4O2 [M+H]+ 195.0877',
 check:'HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.\nHRMS (ESI) m/z: [M + H]+ Calcd for C8H11N4O2 195.0882; Found 195.0877.\nHRESIMS m/z 289.0716 [M − H]− (calcd for C15H13O6, 289.0718).\nHRMS (ESI) m/z: [M + Na]+ Calcd for C15H14O6 313.0683; Found 313.0679.'
};
function initialLang(){const q=new URLSearchParams(location.search).get('lang');if(q==='ja'||q==='en')return q;try{const s=localStorage.getItem('ym-language');if(s==='ja'||s==='en')return s;}catch(e){}return (navigator.language||'').startsWith('ja')?'ja':'en';}
let lang=initialLang(),worker=null,last=null,calcState=null,batchRows=null,checkRecords=null;
const t=k=>strings[lang][k];
const el=(tag,props={},...kids)=>{const e=document.createElement(tag);Object.assign(e,props);e.append(...kids);return e;};
const html=(tag,markup,cls)=>{const e=document.createElement(tag);e.innerHTML=markup;if(cls)e.className=cls;return e;};
const signed=(x,d)=>(x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(d);
// Text shown on the page: subscript atom counts in formulas, superscript the charge of ion notation, italic m/z.
// escape=false only for the fixed strings of this file (some contain <i>/<sub>).
const escH=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function rich(s,escape=true){
 let h=escape?escH(s):String(s);
 h=h.replace(/\[([^\]\n<>]{0,30}M[^\]\n<>]{0,30})\]\s?(\d*[+\-−])(?![\w])/g,(m,inner,ch)=>`[${inner.replace(/([A-Za-z])(\d+)/g,'$1<sub>$2</sub>')}]<sup>${ch.replace('-','−')}</sup>`);
 h=h.replace(/(^|[^A-Za-z0-9>\/])((?:[A-Z][a-z]?\d*){2,})(?![A-Za-z0-9])/g,(m,pre,f)=>/\d/.test(f)?pre+f.replace(/(\d+)/g,'<sub>$1</sub>'):m);
 return h.replace(/\bm\/z\b/g,'<i>m</i>/<i>z</i>');
}
const say=(node,text)=>{node.innerHTML=rich(text);};
const H=h=>({h});
// plain text for <option>: Unicode sub- and superscripts, e.g. [M + NH₄]⁺
const SUBS='₀₁₂₃₄₅₆₇₈₉',SUPS='⁰¹²³⁴⁵⁶⁷⁸⁹';
function ionOption(key){const m=/^(\[.*\])(\d*)([+−])$/.exec(ionLabel(key).text);
 return m[1].replace(/([A-Za-z])(\d+)/g,(x,a,d)=>a+[...d].map(c=>SUBS[c]).join(''))+[...m[2]].map(c=>SUPS[c]).join('')+(m[3]==='+'?'⁺':'⁻');}
function tableHead(table,labels){const tr=el('tr');for(const s of labels)tr.append(html('th',s==='z'?'<i>z</i>':rich(s,false)));table.querySelector('thead').replaceChildren(tr);}
function row(table,values){const tr=el('tr');for(const s of values){const td=el('td');if(s&&s.h!==undefined)td.innerHTML=s.h;else td.textContent=s;tr.append(td);}table.querySelector('tbody').append(tr);return tr;}
async function copyRich(text,markup,status){
 try{
  if(markup&&window.ClipboardItem&&navigator.clipboard.write)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([markup],{type:'text/html'})})]);
  else await navigator.clipboard.writeText(text);
  status.textContent=t('copyOk');
 }catch{try{await navigator.clipboard.writeText(text);status.textContent=t('copyOk');}catch{status.textContent=t('copyFail');}}
}
function errorText(code){return t({formula:'errorFormula',composition:'errorComposition',range:'errorRange',search:'errorSearch',found:'errorFound',lines:'errorLines'}[code]||'errorGeneric');}

// ---------- ion selects ----------
const POS=Object.keys(IONS).filter(k=>IONS[k][1]>0),NEG=Object.keys(IONS).filter(k=>IONS[k][1]<0);
for(const id of ['calcIon','searchIon','batchIon']){
 for(const [lab,keys] of [['posIons',POS],['negIons',NEG]]){const g=el('optgroup');g.dataset.t=lab;for(const k of keys)g.append(new Option(ionOption(k),k));$(id).append(g);}
 $(id).value='[M+H]+';
}
// ion picker: a button shows the current ion; it opens a table of all ion types (positive / negative;
// rows = atoms added or removed, columns = M, 2M, doubly charged). The hidden <select> keeps the value.
const ION_GRID={
 posIons:[['+H',['[M+H]+','[2M+H]+','[M+2H]2+']],['+Na',['[M+Na]+','[2M+Na]+',null]],['+K',['[M+K]+',null,null]],['+NH4',['[M+NH4]+',null,null]],
  ['+Li',['[M+Li]+',null,null]],['+H −H2O',['[M+H-H2O]+',null,null]],[null,['[M]+','[2M]+',null]]],
 negIons:[['−H',['[M-H]-','[2M-H]-','[M-2H]2-']],['+HCOO',['[M+HCOO]-',null,null]],['+CH3COO',['[M+CH3COO]-',null,null]],['+Cl',['[M+Cl]-',null,null]],
  [null,['[M]-','[2M]-',null]]]
};
const pickers=[];
function syncPickers(){for(const pk of pickers)pk.sync();}
function makePicker(id){
 const sel=$(id),wrap=el('div',{className:'ion-picker',id:id+'-picker'});
 const btn=el('button',{type:'button',className:'ion-current'}),cur=el('span',{id:id+'-current'}),panel=el('div',{className:'ion-panel',id:id+'-panel',hidden:true});
 btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',panel.id);btn.setAttribute('aria-labelledby',`${id}-label ${id}-current`);btn.append(cur);
 for(const [cap,rows] of Object.entries(ION_GRID)){
  const table=el('table'),caption=el('caption'),head=el('tr',{},el('td')),body=el('tbody');caption.dataset.t=cap;
  for(const k of ['ionColM','ionCol2M','ionColZ2']){const th=el('th',{scope:'col'});th.dataset.t=k;head.append(th);}
  for(const [lab,keys] of rows){
   const tr=el('tr'),th=el('th',{scope:'row'});if(lab)th.innerHTML=rich(lab);else th.dataset.t='ionNone';tr.append(th);
   for(const k of keys){const td=el('td');if(k){const b=el('button',{type:'button',textContent:ionOption(k)});b.dataset.ion=k;b.onclick=()=>choose(k);td.append(b);}tr.append(td);}
   body.append(tr);
  }
  table.append(caption,el('thead',{},head),body);panel.append(table);
 }
 wrap.append(btn,panel);sel.after(wrap);
 function open(){panel.hidden=false;btn.setAttribute('aria-expanded','true');panel.style.left='0px';
  const over=panel.getBoundingClientRect().right-(document.documentElement.clientWidth-12);if(over>0)panel.style.left=`${-over}px`;
  (panel.querySelector('button[aria-pressed=true]')||panel.querySelector('td button')).focus();}
 function close(focus){if(panel.hidden)return;panel.hidden=true;btn.setAttribute('aria-expanded','false');if(focus)btn.focus();}
 function sync(){cur.textContent=ionOption(sel.value);for(const b of panel.querySelectorAll('td button'))b.setAttribute('aria-pressed',String(b.dataset.ion===sel.value));}
 function choose(k){sel.value=k;sync();close(true);sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));}
 btn.onclick=()=>panel.hidden?open():close(false);
 wrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close(true);}});
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))close(false);});
 document.addEventListener('focusin',e=>{if(!wrap.contains(e.target))close(false);});
 sync();pickers.push({sync,close});
}
for(const id of ['calcIon','searchIon','batchIon'])makePicker(id);

// ---------- tabs ----------
const tabs=[...document.querySelectorAll('[role=tab]')];
function selectTab(tab,focus,updateHash=true){
 for(const x of tabs){const on=x===tab;x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1;$(x.getAttribute('aria-controls')).hidden=!on;}
  if(focus)tab.focus();
 if(updateHash)try{const u=new URL(location.href);u.hash=tab.getAttribute('aria-controls');history.replaceState(null,'',u);}catch(e){}
}
tabs.forEach((tab,i)=>{
 tab.onclick=()=>selectTab(tab);
 tab.onkeydown=e=>{const k={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:tabs.length-1}[e.key];if(k===undefined)return;e.preventDefault();selectTab(tabs[(k+tabs.length)%tabs.length],true);};
});
function tabFromHash(){const h=location.hash.slice(1);return tabs.find(x=>x.getAttribute('aria-controls')===h);}
selectTab(tabFromHash()||tabs[0],false,false);
// keep the address bar as it was opened when the hash is not a tab (e.g. #method)
window.addEventListener('hashchange',()=>{const tab=tabFromHash();if(tab)selectTab(tab,false,false);});

// ---------- statement settings (shared by the calculator and the batch) ----------
const si={append:true};
for(const c of document.querySelectorAll('[data-si]')){
 c.addEventListener(c.type==='checkbox'?'change':'input',()=>{
  si[c.dataset.si]=c.type==='checkbox'?c.checked:c.value;
  for(const d of document.querySelectorAll(`[data-si=${c.dataset.si}]`))if(d!==c){if(d.type==='checkbox')d.checked=c.checked;else d.value=c.value;}
  renderSi();$('siCopyStatus').textContent='';$('batchCopyStatus').textContent='';
 });
}
function sentence(counts,key,mz,found){return siSentence({key,ionFormula:siFormula(counts,key,si.append),calcd:mz,found});}

// ---------- calculator ----------
function readFound(raw){const v=raw.trim();if(v==='')return '';if(!/^\d+(\.\d+)?$/.test(v)||!(Number(v)>0))throw Error('found');return v;}
function calculate(showErrors){
 const fRaw=$('formula').value.trim();
 if(!fRaw){calcState=null;renderCalc();clearCalcUrl();return;}
 try{
  const counts=parseFormula(fRaw),key=$('calcIon').value,r=ion(counts,key),found=readFound($('calcFound').value);
  calcState={counts,key,r,found,pattern:isotopePattern(ionCounts(counts,key),r.z)};
  setUrl({f:fRaw,ion:key,found});
 }catch(e){calcState=showErrors?{error:e.message}:null;}
 renderCalc();
}
function renderCalc(){
 const box=$('calcResult'),main=$('calcMain');
 box.classList.toggle('error',!!(calcState&&calcState.error));
 $('calcPlaceholder').hidden=!!calcState;$('calcSi').hidden=$('calcIso').hidden=!(calcState&&!calcState.error);
 main.replaceChildren();$('siCopyStatus').textContent='';$('calcLinkStatus').textContent='';
 $('calcLinkRow').hidden=!(calcState&&!calcState.error);
 if(!calcState)return;
 if(calcState.error){main.append(html('p',rich(errorText(calcState.error)),'error'));return;}
 const {counts,key,r,found}=calcState;
 main.append(html('p',`${ionLabel(key).html} <span class="sep">·</span> ${t('ionFormula')} ${formulaHtml(r.ionFormula)}${r.z>0?'<sup>'+(r.z>1?r.z:'')+'+</sup>':'<sup>'+(r.z<-1?-r.z:'')+'−</sup>'}`,'result-ion'));
 main.append(html('p',`<span>${rich(t('mz'),false)}</span> <strong>${r.mz.toFixed(6)}</strong>`,'result-mz'));
 const facts=el('dl',{className:'result-facts'});
 const fact=(k,v)=>facts.append(el('div',{},html('dt',rich(k,false)),html('dd',v)));
 fact(t('neutral'),`${formulaHtml(r.formula)} · ${r.neutral.toFixed(6)} Da`);
 const d=dbe(counts);fact('DBE',d===null?'—':String(d));
 if(found){const f=Number(found);fact(t('measured'),`${found}（${t('diff')} ${signed(ppm(f,r.mz),2)} ppm, ${signed((f-r.mz)*1000,3)} mDa）`.replace(/[（）]/g,c=>lang==='ja'?c:c==='（'?' (':')'));}
 main.append(facts);
 renderSi();renderIso();
}
function renderSi(){
 if(calcState&&!calcState.error){
  const {counts,key,r,found}=calcState,s=sentence(counts,key,r.mz,found),p=$('siText');
  p.replaceChildren();$('siCopy').disabled=!s;
  if(s)p.innerHTML=s.html;
  const need=found?'':t('siNeedFound');
  if(need)p.append(el('span',{className:'hint need',textContent:(s?' ':'')+need}));
 }
 if(batchRows)renderBatchSiState();
}
function renderIso(){
 const peaks=calcState.pattern,table=$('isoTable');
 tableHead(table,[t('peak'),'m/z',t('relative')]);table.querySelector('tbody').replaceChildren();
 const name=s=>s===0?'M':`M${s>0?'+':'−'}${Math.abs(s)}`;
 for(const p of peaks)row(table,[name(p.shift),p.mz.toFixed(4),p.relative>=10?p.relative.toFixed(1):p.relative.toFixed(2)]);
 // bar chart
 const w=46,h=120,pad=18,W=Math.max(peaks.length*w,200);
 let svg=`<svg viewBox="0 0 ${W} ${h+34}" width="${W}" height="${h+34}" role="img"><line x1="0" y1="${h+pad}" x2="${W}" y2="${h+pad}" class="axis"/>`;
 peaks.forEach((p,i)=>{const bh=Math.max(p.relative/100*h,1),x=i*w+w/2;
  svg+=`<rect x="${x-9}" y="${h+pad-bh}" width="18" height="${bh}" class="bar${p.shift===0?' mono':''}"/>`+
   `<text x="${x}" y="${h+pad-bh-4}" class="val">${p.relative>=10?p.relative.toFixed(0):p.relative.toFixed(1)}</text>`+
   `<text x="${x}" y="${h+pad+14}" class="lab">${name(p.shift)}</text>`;});
 $('isoChart').innerHTML=svg+'</svg>';
}
$('calcForm').addEventListener('input',()=>calculate(false));
$('calcForm').addEventListener('change',()=>calculate(true));
$('calcForm').onsubmit=e=>{e.preventDefault();calculate(true);if(!$('formula').value.trim())$('formula').focus();};
$('siCopy').onclick=()=>{if(!calcState||calcState.error)return;const {counts,key,r,found}=calcState,s=sentence(counts,key,r.mz,found);if(s)copyRich(s.text,s.html,$('siCopyStatus'));};

// ---------- formula finder ----------
function headers(){return [t('formula'),t('ionFormula'),'z',t('mz'),'Δ ppm','Δ mDa','DBE'];}
function resultValues(r){return [r.formula,r.ionFormula,r.z,r.mz.toFixed(6),r.ppm.toFixed(3),r.mDa.toFixed(3),r.dbe??'—'];}
function renderResults(){const table=$('results');tableHead(table,headers());table.querySelector('tbody').replaceChildren();if(last){for(const r of last.results){const v=resultValues(r);v[0]=H(formulaHtml(r.formula));v[1]=H(formulaHtml(r.ionFormula));row(table,v);}$('searchStatus').textContent=`${last.complete?t('complete'):t('incomplete')} · ${t('countFmt')(last.results.length)}`+(last.excluded?` · ${t('excludedFmt')(last.excluded)}`:'');}}
for(const [e,v]of Object.entries(ELEMENTS)){
 const div=el('div',{className:'range'},el('b',{textContent:e}));
 for(const bound of ['min','max']){const input=el('input',{type:'number',min:0,max:1000,step:1,required:true,value:bound==='min'?0:({C:30,H:60,O:20}[e]||0)});input.dataset.element=e;input.dataset.bound=bound;div.append(input);if(bound==='min')div.append(el('span',{textContent:'–'}));}
 const common=['C','H','N','O','F','P','S','Cl','Br','I','B','Si','Na','K'];
 $(common.includes(e)?'ranges':'extraRanges').append(div);row($('constants'),[e,H(`<sup>${v.isotope}</sup>${e}`),v.mass]);
}
{const order=['C','H','N','O','S','P','F','Cl','Br','I','B','Si','Na','K'];const box=$('ranges');[...box.children].sort((x,y)=>order.indexOf(x.querySelector('b').textContent)-order.indexOf(y.querySelector('b').textContent)).forEach(n=>box.append(n));}
function cancel(){if(worker){worker.terminate();worker=null;}$('cancel').disabled=true;$('searchButton').disabled=false;}
function clearSearch(){cancel();last=null;$('searchStatus').textContent='';$('copyStatus').textContent='';$('copy').disabled=$('searchLink').disabled=true;renderResults();}
$('searchForm').oninput=event=>{clearSearch();if(event.target.closest('#extraRanges'))$('extraElements').open=true;};
function checkRanges(){for(const input of document.querySelectorAll('.range input'))input.removeAttribute('aria-invalid');
 for(const div of document.querySelectorAll('.range')){const [a,b]=div.querySelectorAll('input');for(const input of [a,b]){const v=input.value.trim();let why=null;
  if(v==='')why='rangeEmpty';else if(!/^-?\d+$/.test(v))why='rangeInt';else if(Number(v)<0||Number(v)>1000)why='rangeBounds';
  if(!why&&input===b&&Number(a.value)>Number(b.value))why='rangeOrder';
  if(why){const bound=t(input.dataset.bound==='min'?'minimum':'maximum');const label=lang==='ja'?`${input.dataset.element}（${bound}）：`:`${input.dataset.element} (${bound}): `;return {input,text:label+t(why)};}}}
 if(![...document.querySelectorAll('.range input')].some(i=>i.dataset.bound==='max'&&Number(i.value)>0))return {input:document.querySelector('.range input[data-bound=max]'),text:t('rangeNone')};
 return null;}
$('searchForm').onsubmit=event=>{event.preventDefault();clearSearch();
 const bad=checkRanges();if(bad){if(bad.input.closest('details'))bad.input.closest('details').open=true;bad.input.setAttribute('aria-invalid','true');bad.input.focus();$('searchStatus').textContent=bad.text;return;}
 try{
  const ranges=[...document.querySelectorAll('.range')].map(div=>{const inputs=div.querySelectorAll('input');return [inputs[0].dataset.element,Number(inputs[0].value),Number(inputs[1].value)];});
  worker=new Worker(new URL('./worker.js?v=20261107-2',import.meta.url),{type:'module'});$('cancel').disabled=false;$('searchButton').disabled=true;$('searchStatus').textContent=t('running');
  worker.onmessage=({data})=>{cancel();if(data.error){say($('searchStatus'),errorText(data.error));return;}last=data;renderResults();$('copy').disabled=!data.results.length;$('searchLink').disabled=false;};
  worker.onerror=()=>{cancel();$('searchStatus').textContent=t('errorGeneric');};
  worker.postMessage({found:Number($('found').value),tolerance:Number($('tolerance').value),unit:$('unit').value,adduct:$('searchIon').value,ranges,filters:{dbe:$('filterDbe').checked,ratio:$('filterRatio').checked}});
  setUrl(finderParams());
 }catch(e){cancel();say($('searchStatus'),errorText(e.message));}};
$('cancel').onclick=()=>{cancel();$('searchStatus').textContent=t('stopped');};
$('copy').onclick=async()=>{if(!last)return;const fl=[$('filterDbe').checked&&'DBE',$('filterRatio').checked&&(lang==='ja'?'元素比':'element ratios')].filter(Boolean).join(', ');const context=`${t('found')}: ${$('found').value}\t${$('searchIon').value}\t±${$('tolerance').value} ${$('unit').value}\t${last.complete?t('complete'):t('incomplete')}`+(fl?`\t${lang==='ja'?'絞り込み':'Filters'}: ${fl}`:'')+(last.excluded?`\t${t('excludedFmt')(last.excluded)}`:'');try{await navigator.clipboard.writeText([context,headers().join('\t'),...last.results.map(r=>resultValues(r).join('\t'))].join('\n'));$('copyStatus').textContent=t('copyOk');}catch{$('copyStatus').textContent=t('copyFail');}};

// ---------- batch ----------
function batchHeaders(){return [t('line'),t('label'),t('formula'),t('ion'),t('ionFormula'),t('mz'),t('measured'),'Δ ppm','DBE',t('note')];}
function batchValues(b){
 if(b.error)return [b.line,b.label,b.formula,b.error==='formula'?'':b.key,'','','','','',b.message];
 return [b.line,b.label,b.r.formula,b.key,b.r.ionFormula,b.r.mz.toFixed(6),b.found,b.found?ppm(Number(b.found),b.r.mz).toFixed(2):'',b.dbe??'—',''];
}
function runBatch(){
 $('batchCopyStatus').textContent='';
 let rows;try{rows=parseBatch($('batchInput').value,$('batchIon').value);}catch(e){batchRows=null;renderBatch();say($('batchStatus'),errorText(e.message));return;}
 batchRows=rows.map(b=>{
  if(b.error)return {...b,code:b.error};
  try{const r=ion(b.counts,b.key);return {...b,r,dbe:dbe(b.counts)};}catch(e){return {...b,error:e.message,code:e.message};}
 });
 renderBatch();
}
function renderBatch(){
 const table=$('batchResults');tableHead(table,batchHeaders());table.querySelector('tbody').replaceChildren();
 $('batchSi').hidden=$('batchTableActions').hidden=!(batchRows&&batchRows.some(b=>!b.error));$('batchTableStatus').textContent='';
 if(!batchRows){$('batchStatus').textContent='';return;}
 if(!batchRows.length){$('batchStatus').textContent=t('batchEmpty');return;}
 for(const b of batchRows){
  if(b.error)b.message=b.code==='token'?t('errToken')(b.bad):b.code==='ion'?t('errIon')(b.bad):errorText(b.code);
  const v=batchValues(b);if(b.formula&&(!b.error||b.counts))v[2]=H(formulaHtml(b.error?b.formula:b.r.formula));if(v[3])v[3]=H(ionLabel(v[3]).html);if(v[4])v[4]=H(formulaHtml(v[4]));
  const tr=row(table,v);if(b.error)tr.className='row-error';
 }
 const bad=batchRows.filter(b=>b.error).length;
 $('batchStatus').textContent=t('batchCount')(batchRows.length-bad,bad);
 renderBatchSiState();
}
function renderBatchSiState(){
 $('batchCopySi').disabled=!(batchRows||[]).some(b=>!b.error);
}
$('batchForm').onsubmit=e=>{e.preventDefault();runBatch();};
$('batchInput').addEventListener('input',()=>{if(batchRows){batchRows=null;renderBatch();}});
$('batchIon').addEventListener('change',()=>{if(batchRows)runBatch();});
$('batchExample').onclick=()=>{$('batchInput').value=EXAMPLES.batch;runBatch();};
$('batchCopyTsv').onclick=()=>{if(!batchRows)return;copyRich([batchHeaders().join('\t'),...batchRows.map(b=>batchValues(b).join('\t'))].join('\n'),null,$('batchTableStatus'));};
$('batchCopySi').onclick=()=>{
 if(!batchRows)return;const text=[],marks=[];
 for(const b of batchRows){if(b.error)continue;const s=sentence(b.counts,b.key,b.r.mz,b.found);if(!s)continue;
  const lab=b.label?`${b.label}: `:'';text.push(lab+s.text);marks.push(`<p>${lab.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}${s.html}</p>`);}
 copyRich(text.join('\n'),marks.join(''),$('batchCopyStatus'));
};

// ---------- checker ----------
const CODE_TEXT={ok:'cOk',rounding:'cRounding',electron:'cElectron',electronSign:'cElectronSign',neutralFormula:'cNeutralFormula',neutralFormulaElectron:'cNeutralFormulaElectron',mismatch:'cMismatch',chargeAssumed:'cChargeAssumed',fewDigits:'cFewDigits',formula:'cFormula'};
const STATUS_TEXT={ok:'stOk',warn:'stWarn',error:'stError',unparsed:'stUnparsed'};
function tolValue(){const v=Number($('checkTol').value);return Number.isFinite(v)&&v>=0?v:5;}
function codeText(c){return c==='foundOff'?t('cFoundOff')(tolValue()):t(CODE_TEXT[c]);}
function runCheck(){checkRecords=checkText($('checkInput').value,{tolerancePpm:tolValue()});renderCheck();}
function renderCheck(){
 const list=$('checkResults');list.replaceChildren();$('checkCopyStatus').textContent='';
 $('checkActions').hidden=!(checkRecords&&checkRecords.length);
 if(!checkRecords){$('checkSummary').textContent='';return;}
 if(!checkRecords.length){say($('checkSummary'),t('checkNone'));return;}
 const n=s=>checkRecords.filter(r=>r.status===s).length;
 $('checkSummary').textContent=t('checkSummary')(checkRecords.length,n('ok'),n('warn'),n('error')+n('unparsed'));
 for(const r of checkRecords){
  const li=el('li',{className:`check-item ${r.status}`});
  li.append(el('p',{className:'check-head'},el('span',{className:`badge ${r.status}`,textContent:t(STATUS_TEXT[r.status])}),' ',html('span',rich(r.codes.map(codeText).filter(Boolean).join(' ')))));
  li.append(html('p',rich(r.snippet),'check-snippet'));
  if(r.recalculated!==null){
   const parts=[`${t('stated')} ${r.stated}`,`${t('recalc')} ${r.recalculated.toFixed(4)} (${signed(r.diffMDa,2)} mDa)`];
   if(r.found!==null)parts.push(`${t('measured')} ${r.found} (${signed(r.ppm,2)} ppm)`);
   li.append(html('p',rich(parts.join(' · ')),'check-values'));
  }
  list.append(li);
 }
}
$('checkForm').onsubmit=e=>{e.preventDefault();runCheck();};
$('checkInput').addEventListener('input',()=>{if(checkRecords){checkRecords=null;renderCheck();}});
$('checkTol').addEventListener('input',()=>{if(checkRecords)runCheck();});
$('checkExample').onclick=()=>{$('checkInput').value=EXAMPLES.check;runCheck();};
$('checkCopy').onclick=()=>{
 if(!checkRecords)return;
 const lines=[[ '#','status','message','ion','formula','z',t('stated'),t('recalc'),'Δ mDa',t('measured'),'Δ ppm','text'].join('\t')];
 checkRecords.forEach((r,i)=>lines.push([i+1,t(STATUS_TEXT[r.status]),r.codes.map(codeText).filter(Boolean).join(' '),r.ion,r.formula,r.z??'',r.stated,r.recalculated?.toFixed(4)??'',r.diffMDa?.toFixed(2)??'',r.found??'',r.ppm?.toFixed(2)??'',r.snippet].join('\t')));
 copyRich(lines.join('\n'),null,$('checkCopyStatus'));
};

// ---------- language ----------
function translate(){
 document.documentElement.lang=lang;if(t('title'))document.title=t('title');
 for(const n of document.querySelectorAll('[data-t]')){if(t(n.dataset.t)===undefined)continue; // a missing string keeps the text written in the HTML
  if(n.tagName==='OPTGROUP')n.label=t(n.dataset.t);else if(n.tagName==='OPTION')n.textContent=t(n.dataset.t);else n.innerHTML=rich(t(n.dataset.t),false);}
 $('langJa').setAttribute('aria-pressed',String(lang==='ja'));$('langEn').setAttribute('aria-pressed',String(lang==='en'));
 $('tabs').setAttribute('aria-label',lang==='ja'?'機能':'Tools');
 for(const input of document.querySelectorAll('.range input'))input.setAttribute('aria-label',`${input.dataset.element} ${t(input.dataset.bound==='min'?'minimum':'maximum')}`);
 tableHead($('constants'),[t('element'),t('isotope'),t('mass')]);
 $('batchInput').placeholder=lang==='ja'?'例）Glucose\tC6H12O6\t[M+Na]+\t203.0524':'e.g. Glucose\tC6H12O6\t[M+Na]+\t203.0524';
 $('checkInput').placeholder='HRMS (ESI) m/z: [M + Na]+ Calcd for C6H12O6Na 203.0526; Found 203.0524.';
 renderResults();renderCalc();renderBatch();renderCheck();
}
function syncLangLinks(){for(const a of document.querySelectorAll('a[href]')){const h=a.getAttribute('href');if(!h||/^[a-z][a-z0-9+.-]*:/i.test(h)||h.startsWith('#'))continue;const [pq,frag]=h.split('#');const [path,q]=pq.split('?');if(!/\.html$/.test(path))continue;const ps=new URLSearchParams(q||'');ps.set('lang',lang);a.setAttribute('href',`${path}?${ps}${frag?'#'+frag:''}`);}}
function setLanguage(value){cancel();lang=value;try{localStorage.setItem('ym-language',value);}catch(e){}try{const u=new URL(location.href);u.searchParams.set('lang',value);history.replaceState(null,'',u);}catch(e){}syncLangLinks();$('searchStatus').textContent='';translate();}
$('langJa').onclick=()=>setLanguage('ja');$('langEn').onclick=()=>setLanguage('en');
translate();syncLangLinks();

// ---------- saved settings (this browser only) and inputs kept in the address ----------
const STORE='hrms-calc-settings',DEFAULT_MAX={C:30,H:60,O:20};
const isIon=k=>typeof k==='string'&&Object.hasOwn(IONS,k);
const validTol=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<1e6;
const validRange=v=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isInteger(n)&&n>=0&&n<=1000)&&v[0]<=v[1];
function loadSettings(){try{const v=JSON.parse(localStorage.getItem(STORE)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch(e){return {};}}
let settings=loadSettings();
function saveSettings(){try{localStorage.setItem(STORE,JSON.stringify(settings));}catch(e){}}
function rangeInputs(){return [...document.querySelectorAll('.range')].map(div=>div.querySelectorAll('input'));}
function readRanges(){const o={};for(const [a,b] of rangeInputs())o[a.dataset.element]=[Number(a.value),Number(b.value)];return o;}
function writeRanges(o){for(const [a,b] of rangeInputs()){const v=o[a.dataset.element];[a.value,b.value]=validRange(v)?v:[0,0];}
 if([...document.querySelectorAll('#extraRanges input[data-bound=max]')].some(i=>Number(i.value)>0))$('extraElements').open=true;}
function defaultRanges(){const o={};for(const e of Object.keys(ELEMENTS))o[e]=[0,DEFAULT_MAX[e]||0];return o;}
function finderSettings(){return {ion:$('searchIon').value,tol:Number($('tolerance').value),unit:$('unit').value,ranges:readRanges(),dbe:$('filterDbe').checked,ratio:$('filterRatio').checked};}
function applyFinder(f){
 if(isIon(f.ion))$('searchIon').value=f.ion;if(validTol(f.tol))$('tolerance').value=String(f.tol);if(['ppm','mDa'].includes(f.unit))$('unit').value=f.unit;
 if(f.ranges&&typeof f.ranges==='object')writeRanges(f.ranges);$('filterDbe').checked=f.dbe===true;$('filterRatio').checked=f.ratio===true;syncPickers();
}
if(isIon(settings.calcIon))$('calcIon').value=settings.calcIon;
if(isIon(settings.batchIon))$('batchIon').value=settings.batchIon;
if(settings.finder&&typeof settings.finder==='object')applyFinder(settings.finder);
if(validTol(settings.checkTol))$('checkTol').value=String(settings.checkTol);
if(typeof settings.siAppend==='boolean'){si.append=settings.siAppend;for(const c of document.querySelectorAll('[data-si=append]'))c.checked=si.append;}
$('calcIon').addEventListener('change',()=>{settings.calcIon=$('calcIon').value;saveSettings();});
$('batchIon').addEventListener('change',()=>{settings.batchIon=$('batchIon').value;saveSettings();});
$('checkTol').addEventListener('change',()=>{const v=Number($('checkTol').value);if(validTol(v)){settings.checkTol=v;saveSettings();}});
for(const c of document.querySelectorAll('[data-si=append]'))c.addEventListener('change',()=>{settings.siAppend=c.checked;saveSettings();});
$('searchForm').addEventListener('change',()=>{const f=finderSettings();if(validTol(f.tol)&&Object.values(f.ranges).every(validRange)){settings.finder=f;saveSettings();}});
$('resetSearch').onclick=()=>{
 applyFinder({ion:'[M+H]+',tol:5,unit:'ppm',ranges:defaultRanges(),dbe:false,ratio:false});$('extraElements').open=false;
 for(const input of document.querySelectorAll('.range input'))input.removeAttribute('aria-invalid');
 delete settings.finder;saveSettings();clearSearch();
};

// address: ?f=&ion=&found= (calculator) or ?mz=&ion=&tol=&unit=&r=C0-30,H0-60&filter=dbe,ratio (finder)
const URL_KEYS=['f','ion','found','mz','tol','unit','r','filter'];
function setUrl(params){try{const u=new URL(location.href);for(const k of URL_KEYS)u.searchParams.delete(k);
 if(params)for(const [k,v] of Object.entries(params))if(v!==''&&v!==undefined&&v!==null)u.searchParams.set(k,v);history.replaceState(null,'',u);}catch(e){}}
function clearCalcUrl(){if(new URLSearchParams(location.search).has('f'))setUrl(null);}
function finderParams(){
 const r=Object.entries(readRanges()).filter(([,v])=>v[1]>0).map(([e,v])=>`${e}${v[0]}-${v[1]}`).join(',');
 return {mz:$('found').value.trim(),ion:$('searchIon').value,tol:$('tolerance').value.trim(),unit:$('unit').value,r,filter:[$('filterDbe').checked&&'dbe',$('filterRatio').checked&&'ratio'].filter(Boolean).join(',')};
}
function shareLink(tab){const u=new URL(location.href);u.searchParams.delete('lang');u.hash=tab;return u.href;}
$('calcLink').onclick=()=>copyRich(shareLink('calculator'),null,$('calcLinkStatus'));
$('searchLink').onclick=()=>copyRich(shareLink('finder'),null,$('copyStatus'));
{
 const q=new URLSearchParams(location.search);
 if(q.has('mz')){
  const f={ion:q.get('ion'),tol:q.has('tol')?Number(q.get('tol')):NaN,unit:q.get('unit')},fl=(q.get('filter')||'').split(',');
  if(q.has('r')){f.ranges={};for(const part of q.get('r').split(',')){const m=/^([A-Z][a-z]?)(\d{1,4})-(\d{1,4})$/.exec(part.trim());if(m&&Object.hasOwn(ELEMENTS,m[1]))f.ranges[m[1]]=[Number(m[2]),Number(m[3])];}}
  f.dbe=fl.includes('dbe');f.ratio=fl.includes('ratio');applyFinder(f);
  $('found').value=q.get('mz').slice(0,40);
  if(!tabFromHash())selectTab(tabs.find(x=>x.getAttribute('aria-controls')==='finder'),false);
  $('searchForm').requestSubmit();
 }else if(q.has('f')){
  $('formula').value=q.get('f').slice(0,500);if(isIon(q.get('ion')))$('calcIon').value=q.get('ion');$('calcFound').value=(q.get('found')||'').slice(0,40);
  calculate(true);
 }
}
syncPickers();
