"""Comprueba la transferencia sin importar ni ejecutar el motor científico."""
from pathlib import Path
import hashlib, itertools, json
root=Path(__file__).resolve().parents[1]
def read(rel):
    return json.loads((root/rel).read_text('utf-8'),parse_constant=lambda v: (_ for _ in ()).throw(ValueError(v)))
checked=0
for row in (root/'SHA256_TRANSFERENCIA.txt').read_text('utf-8').splitlines():
    expected,rel=row.split('  ',1)
    actual=hashlib.sha256((root/rel).read_bytes()).hexdigest()
    assert actual==expected,rel
    checked+=1
p=read('DERIVADOS_SITE_REGRET/paquete_frontend.json')
passport=read('DERIVADOS_SITE_REGRET/datos/pasaporte.json')
assert p['provenance']==passport
expected=set(itertools.product(['A','B'],['W1','W2'],[0,2,10],['nominal','bias_plus','bias_minus','correlated_plus','correlated_minus']+[f'published_{i:04d}' for i in range(1,6)]))
actual=[(s['site_id'],s['window_id'],s['height_m'],s['variant']) for s in p['scenarios']]
assert len(actual)==120 and len(set(actual))==120 and set(actual)==expected
assert len(p['comparisons'])==6
for w in ['W1','W2']: assert len(p['ephemerides'][w]['times_utc'])==4321
for s in p['scenarios']: assert len(s['state_codes'])==4320 and set(s['state_codes'])<=set(range(5))
print(f'OK: {checked} hashes; JSON estricto; pasaporte idéntico; 120 escenarios únicos completos; seis comparaciones. Sin ejecutar ciencia ni usar Internet.')
