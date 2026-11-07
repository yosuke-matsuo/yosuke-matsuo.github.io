"""Build hrms-calc/isotopes.js (isotope masses and natural abundances) from the NIST
'Atomic Weights and Isotopic Compositions' ASCII table, and check it against constants.js."""
import json, re, sys
src, constants, out = sys.argv[1:4]
text = open(src, encoding='utf-8', errors='replace').read()
recs = re.findall(r'Atomic Number = (\d+)\s+Atomic Symbol = (\w+)\s+Mass Number = (\d+)\s+Relative Atomic Mass = ([\d.]+)\S*\s+Isotopic Composition = ([\d.]*)', text)
sym_by_z = {}
iso = {}
for z, sym, a, m, comp in recs:
    sym = sym_by_z.setdefault(z, sym)          # D and T belong to H
    if comp:
        iso.setdefault(sym, []).append([int(a), m, comp])
js = open(constants, encoding='utf-8').read()
elements = json.loads(js[js.index('{'):js.index('};') + 1])
data = {}
for e, v in elements.items():
    lst = iso[e]
    top = max(lst, key=lambda x: float(x[2]))
    assert top[0] == v['isotope'] and top[1] == v['mass'], (e, top, v)
    total = sum(float(x[2]) for x in lst)
    assert abs(total - 1) < 2e-3, (e, total)
    data[e] = [[a, float(m), float(c)] for a, m, c in lst]
assert len(data) == 84
with open(out, 'w', encoding='utf-8') as f:
    f.write('/* Isotope masses and natural abundances: NIST Atomic Weights and Isotopic Compositions; retrieved 2026-11-07.\n'
            '   [mass number, relative atomic mass, isotopic composition (mole fraction)] */\n')
    f.write('export const ISOTOPES = {\n' + ',\n'.join(f' {json.dumps(e)}: {json.dumps(v)}' for e, v in data.items()) + '\n};\n')
print('isotopes.js:', len(data), 'elements,', sum(len(v) for v in data.values()), 'isotopes')
