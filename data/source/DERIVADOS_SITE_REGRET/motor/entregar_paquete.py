"""Crea contrato, informe y paquete integrable a partir de resultados calculados."""
from pathlib import Path
import datetime,hashlib,html,json,math,shutil,zipfile
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
ROOT=Path(__file__).resolve().parents[1]
def load(name):return json.loads((ROOT/name).read_text(encoding='utf8'))
def esc(x):return html.escape(str(x),quote=True)
def hashfile(p):
    h=hashlib.sha256()
    with p.open('rb')as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
def plot(title,x,series,xlabels,xmin=None,xmax=None):
    width,height=720,300;left,right,top,bottom=58,18,38,44
    x=np.asarray(x);xmin=float(x[0])if xmin is None else xmin;xmax=float(x[-1])if xmax is None else xmax
    values=[float(v)for _,vs,_,_ in series for v in vs if v is not None and math.isfinite(v)]
    ymin=math.floor(min(values)-.25);ymax=math.ceil(max(values)+.25)
    if ymax==ymin:ymax+=1
    def xx(v):return left+(float(v)-xmin)/(xmax-xmin)*(width-left-right)
    def yy(v):return top+(ymax-float(v))/(ymax-ymin)*(height-top-bottom)
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{esc(title)}"><rect width="100%" height="100%" fill="white"/><text x="{left}" y="22" font-family="sans-serif" font-size="15" font-weight="bold">{esc(title)}</text>']
    for y in np.linspace(ymin,ymax,5):
        py=yy(y);lines.append(f'<path d="M{left},{py}H{width-right}" stroke="#dce5e9"/><text x="{left-8}" y="{py+4}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#536773">{y:.1f}°</text>')
    for value,label in xlabels:
        px=xx(value);lines.append(f'<path d="M{px},{top}V{height-bottom}" stroke="#edf1f4"/><text x="{px}" y="{height-bottom+21}" text-anchor="middle" font-family="sans-serif" font-size="11">{esc(label)}</text>')
    for name,vs,color,dashed in series:
        pieces=[];current=[]
        for a,b in zip(x,vs):
            if b is None or not math.isfinite(b):
                if current:pieces.append(current);current=[]
            else:current.append(f'{xx(a):.2f},{yy(b):.2f}')
        if current:pieces.append(current)
        for p in pieces:
            dash='stroke-dasharray="5 4"'if dashed else ''
            lines.append(f'<polyline points="{" ".join(p)}" fill="none" stroke="{color}" stroke-width="1.6" {dash}/>')
    lines.append('</svg>');return ''.join(lines)

def context_map(sites):
    source=ROOT.parent/'RECOPILACION_DATOS_2026-11-14/datos_originales/PGDA78_Site01/Site01_final_adj_5mpp_surf.tif'
    xmin,ymin,xmax,ymax=-13000.,-14000.,-9000.,-10000.
    with rasterio.open(source)as ds:
        arr=ds.read(1,window=from_bounds(xmin,ymin,xmax,ymax,ds.transform),out_shape=(100,100),resampling=Resampling.average)
    lo,hi=float(np.min(arr)),float(np.max(arr));scaled=np.clip((arr-lo)/(hi-lo),0,1)
    left,top,size=80,50,600
    lines=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 740" role="img" aria-label="Mapa de elevación de Connecting Ridge con sitios A y B"><rect width="760" height="740" fill="white"/><text x="80" y="27" font-family="sans-serif" font-size="18" font-weight="bold">Connecting Ridge · contexto del DEM LOLA</text>']
    for r in range(100):
        for c in range(100):
            v=scaled[r,c];red=int(35+195*v);green=int(75+130*v);blue=int(110+45*v)
            lines.append(f'<rect x="{left+c*6}" y="{top+r*6}" width="6.1" height="6.1" fill="#{red:02x}{green:02x}{blue:02x}"/>')
    for i in range(5):
        p=left+i*150;q=top+i*150
        lines.append(f'<path d="M{p},{top}V{top+size}M{left},{q}H{left+size}" stroke="white" stroke-opacity=".45"/><text x="{p}" y="{top+size+22}" text-anchor="middle" font-family="sans-serif" font-size="12">{int(xmin+i*1000)}</text><text x="{left-10}" y="{q+4}" text-anchor="end" font-family="sans-serif" font-size="12">{int(ymax-i*1000)}</text>')
    for s in sites:
        x=left+(s['x_m']-xmin)/(xmax-xmin)*size;y=top+(ymax-s['y_m'])/(ymax-ymin)*size
        lines.append(f'<circle cx="{x}" cy="{y}" r="7" fill="#e93652" stroke="white" stroke-width="2"/><rect x="{x+10}" y="{y-23}" width="64" height="25" rx="3" fill="white"/><text x="{x+16}" y="{y-6}" font-family="sans-serif" font-size="14" font-weight="bold">{s["id"]} · ROI {s["roi"]}</text>')
    lines.append(f'<text x="380" y="700" text-anchor="middle" font-family="sans-serif" font-size="14">X / Y estereográficos en metros · MOON_ME_DE421</text><text x="80" y="725" font-family="sans-serif" font-size="12">Oscuro: {lo:.0f} m · Claro: {hi:.0f} m · Visualización promediada a 40 m/píxel; no usada en los cálculos.</text></svg>')
    svg=''.join(lines)
    (ROOT/'figuras').mkdir(exist_ok=True)
    (ROOT/'figuras/mapa_sitios.svg').write_text(svg,encoding='utf8')
    (ROOT/'datos/contexto_2d.json').write_text(json.dumps(dict(image='figuras/mapa_sitios.svg',bounds_xy_m=[xmin,ymin,xmax,ymax],frame='MOON_ME_DE421',display_pixel_size_m=40,resampling='average',role='visual_only_not_horizon_input',source='NASA PGDA78 Site01'),indent=2),encoding='utf8')
    return svg

def main():
    sites=load('datos/sitios.json');cfg=load('configuracion.json');passport=load('datos/pasaporte.json')
    scenarios=load('datos/escenarios.json');comparisons=load('datos/comparaciones.json');eph=load('datos/efemerides_nominales.json')
    spatial=load('validacion/convergencia_espacial.json');temporal=load('validacion/convergencia_temporal.json')
    horizons={s['id']:load('datos/horizonte_'+s['id']+'.json')for s in sites}
    package=dict(schema_version='site-regret/0.1',configuration=cfg,state_names=['NEITHER','SUN_ONLY','EARTH_ONLY','BOTH','UNKNOWN'],
        sites=sites,horizons=horizons,ephemerides=eph,scenarios=scenarios,comparisons=comparisons,provenance=passport)
    # Consumer validation of endpoint counts, units and finite-or-null JSON.
    errors=[]
    expected=2*2*3*10
    if len(scenarios)!=expected:errors.append('Unexpected scenario count')
    for r in scenarios:
        times=eph[r['window_id']]['times_utc']
        if len(r['state_codes'])!=len(times)-1:errors.append('Endpoint counted incorrectly')
        if any(v not in range(5)for v in r['state_codes']):errors.append('Invalid state code')
        if abs(sum(i['duration_minutes']for i in r['intervals'])/60-720)>1e-8:errors.append('Interval accounting')
    for sid,h in horizons.items():
        for v,heights in h['variants'].items():
            for height,data in heights.items():
                if len(data['elevation_deg'])!=1440:errors.append('Horizon shape')
                if any(data['unknown']):errors.append(f'Unresolved terrain {sid} {v} {height}')
    if errors:raise ValueError(errors[:10])
    (ROOT/'paquete_frontend.json').write_text(json.dumps(package,ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf8')
    (ROOT/'validacion/contrato_consumidor.json').write_text(json.dumps(dict(passed=True,scenarios=expected,issues=errors),indent=2),encoding='utf8')

    results={(r['site_id'],r['window_id'],r['height_m'],r['variant']):r for r in scenarios}
    title='SITE REGRET · Paquete de datos calculados'
    css='''body{margin:0;background:#f3f6f8;color:#183044;font:16px/1.6 system-ui,Segoe UI,sans-serif}main{max-width:1160px;background:white;margin:0 auto;padding:40px}h1{font-size:34px;line-height:1.2}h2{margin-top:42px;font-size:24px;border-top:1px solid #d9e3e8;padding-top:25px}a{color:#006f8b}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:10px;border:1px solid #dce4e9;text-align:left}th{background:#173b50;color:white}tr:nth-child(even){background:#f3f7f9}.table{overflow:auto}.cards,.plots{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card{border:1px solid #d8e6ec;border-radius:9px;padding:20px;background:#f6fafb}.kpi{font-size:30px;font-weight:bold;color:#006f83}svg{width:100%;height:auto}code{font:13px Consolas,monospace;background:#eef3f6;padding:2px 4px;overflow-wrap:anywhere}.note{padding:16px 20px;border-left:4px solid #078297;background:#eef7f9}.meta{font-size:13px;color:#526b7b}li{margin:7px 0}@media(max-width:750px){main{padding:20px}.plots,.cards{grid-template-columns:1fr}h1{font-size:28px}}@media print{main{padding:0}.card,svg,tr{break-inside:avoid}}'''
    localstamp=datetime.datetime.fromisoformat(passport['generated_at_utc']).astimezone(datetime.timezone(datetime.timedelta(hours=1))).strftime('%d/%m/%Y %H:%M')
    body=[f'<p class="meta">QUEMANDOTOKENS · NASA SPACE APPS BILBAO · {localstamp} CET (hora de Bilbao)</p><h1>{title}</h1>',
        '<p>Entradas reales de LRO-LOLA y NAIF transformadas en horizontes, series temporales y comparaciones para la primera versión de SITE REGRET. Este informe abre sin Internet; las cifras proceden de los JSON adjuntos.</p>',
        '<div class="cards"><div class="card"><div class="kpi">120 escenarios</div>2 sitios × 2 ventanas × 3 alturas × 10 superficies.</div><div class="card"><div class="kpi">10 minutos</div>Paso temporal; 1.440 direcciones de horizonte por superficie y altura, hasta 400 km.</div></div>',
        '<p class="note"><strong>Estado: datos derivados listos para integración, con límites declarados.</strong> No es una aplicación terminada ni una certificación de misión. Los resultados de sensibilidad son escenarios modelados; no probabilidades de éxito.</p>',
        '<h2>Qué puede usar ya el equipo</h2><ul><li><a href="paquete_frontend.json">paquete_frontend.json</a>: contrato único con todos los datos para la interfaz.</li><li><a href="CONTRATO_DATOS.md">CONTRATO_DATOS.md</a>: campos, unidades, estado UNKNOWN y regla de intervalos.</li><li><a href="datos/comparaciones.json">Comparaciones</a> y <a href="datos/pasaporte.json">pasaporte científico</a>.</li><li><a href="README_DESARROLLO.md">Guía de integración y reproducción</a>; los originales permanecen en la carpeta de recopilación.</li></ul>',
        '<h2>Emplazamientos verificados</h2><div class="table"><table><tr><th>Sitio</th><th>Longitud E / latitud</th><th>Elevación</th><th>Error RMS publicado</th><th>Retornos en píxel</th></tr>']
    for s in sites:body.append(f'<tr><td>{esc(s["name"])}</td><td>{s["longitude_east_deg"]:.8f}° / {s["latitude_deg"]:.8f}°</td><td>{s["nominal_height_m"]:.3f} m</td><td>{s["values"]["toterr"]:.3f} m</td><td>{s["values"]["ldec"]:.0f}</td></tr>')
    body.append('</table></div><p>Alturas referidas a la esfera de 1.737.400 m; marco MOON_ME_DE421. Las coordenadas X/Y de las ROI se verificaron contra los polígonos y sus atributos originales. Un conteo cero significa que el valor de ese píxel es interpolado.</p>')
    body.append('<div style="max-width:760px;margin:auto">'+context_map(sites)+'</div>')
    body.append('<h2>Horizontes nominales a 0, 2 y 10 m</h2><p>Gris: 0 m. Verde: 2 m. Morado: 10 m. La elevación puede ser negativa cuando el relieve queda por debajo del plano horizontal del observador.</p><div class="plots">')
    (ROOT/'figuras').mkdir(exist_ok=True)
    for s in sites:
        h=horizons[s['id']];series=[(f'{m} m',h['variants']['nominal'][str(m)]['elevation_deg'],color,False)for m,color in [(0,'#596570'),(2,'#008b87'),(10,'#8e4aa4')]]
        svg=plot(s['name'],h['azimuth_deg'],series,[(v,str(v)+'°')for v in [0,90,180,270,360]],0,360)
        (ROOT/'figuras'/('horizonte_'+s['id']+'.svg')).write_text(svg,encoding='utf8');body.append(svg)
    body.append('</div><h2>Comparación nominal · potencial geométrico</h2><p>W1: 14/11/2026–14/12/2026 UTC. W2: 14/12/2026–13/01/2027 UTC. Cada ventana dura 720 horas. Las rachas están recortadas a esos límites y se calculan con bins de 10 minutos.</p><div class="table"><table><tr><th>Ventana</th><th>Altura</th><th>Sitio</th><th>Sol (h)</th><th>Tierra (h)</th><th>Ambos (h)</th><th>Mayor racha sin Sol (h)</th><th>Desconocido (h)</th></tr>')
    for w in ['W1','W2']:
        for height in [0,2,10]:
            for sid in ['A','B']:
                m=results[(sid,w,height,'nominal')]['metrics']
                body.append(f'<tr><td>{w}</td><td>{height} m</td><td>{sid}</td>'+''.join(f'<td>{m[k]:.2f}</td>'for k in ['sun_hours','dte_center_hours','joint_hours','longest_dark_hours','unknown_hours'])+'</tr>')
    body.append('</table></div><h2>REGRET · criterio fijado: menor racha sin Sol</h2><p>La tolerancia de empate es 10 minutos. Las cuatro perturbaciones propias usan X=1 m, filtro gaussiano σ=100 m y semilla 20261114. Son una hipótesis editable. Los cinco clones publicados se resumen por separado y no representan todo el ensemble de cien.</p><div class="table"><table><tr><th>Ventana / altura</th><th>Nominal</th><th>Conservación · propias</th><th>Conservación · clones</th><th>Peor regret · propias</th></tr>')
    for comp in comparisons:
        c=comp['criteria']['min_longest_dark_hours'];a=c['robustness']['own_sensitivity'];b=c['robustness']['published_subset']
        def frac(x):return 'No aplica (empate)'if x['same_winner_count']is None else f'{x["same_winner_count"]}/{x["evaluated_count"]}; {x["ties"]} '+('empate'if x['ties']==1 else 'empates')
        regret='No aplica'if a['worst_regret_of_nominal_choice_hours']is None else f'{a["worst_regret_of_nominal_choice_hours"]:.2f} h'
        body.append(f'<tr><td>{comp["window_id"]} / {comp["height_m"]} m</td><td>{"Empate"if c["nominal_winner"]=="TIE"else c["nominal_winner"]}</td><td>{frac(a)}</td><td>{frac(b)}</td><td>{regret}</td></tr>')
    body.append('</table></div><p>El regret expresa cuánto se perdería frente a la mejor alternativa bajo esa variante y ese criterio. Las frecuencias no son probabilidades de accidente ni de disponibilidad de una misión real.</p><h2>Cómo cambia el cielo · altura de 2 m</h2><p>Naranja: elevación del Sol; naranja discontinuo: horizonte en su dirección. Azul: Tierra; azul discontinuo: horizonte en su dirección. Se muestran puntos horarios para legibilidad; las métricas usan las muestras de 10 minutos.</p><div class="plots">')
    for w in ['W1','W2']:
        for sid in ['A','B']:
            item=eph[w]['sites'][sid]['2'];step=6;length=len(eph[w]['times_utc']);idx=list(range(0,length,step));x=[i/144 for i in idx]
            series=[('Sol',[item['bodies']['SUN']['elevation_deg'][i]for i in idx],'#d17b00',False),('Horizonte Sol',[item['sun_horizon_deg'][i]for i in idx],'#d17b00',True),('Tierra',[item['bodies']['EARTH']['elevation_deg'][i]for i in idx],'#006fa4',False),('Horizonte Tierra',[item['earth_horizon_deg'][i]for i in idx],'#006fa4',True)]
            svg=plot(f'{w} · Sitio {sid} · días desde inicio UTC',x,series,[(v,str(v))for v in [0,10,20,30]],0,30)
            (ROOT/'figuras'/f'cielo_{w}_{sid}.svg').write_text(svg,encoding='utf8');body.append(svg)
    maxspatial=max(r['angular_and_radial_refinement_max_abs_deg']for r in spatial)
    maxrms=max(r['rms_deg']for r in spatial)
    maxtime=max(abs(v)for r in temporal for v in r['differences_hours'].values())
    body.append('</div><h2>Comprobaciones y sensibilidad numérica</h2><ul>')
    validation=passport['validation']
    body.append(f'<li>{validation["passed"]} comprobaciones del motor superadas; {validation["failed"]} fallos. El contrato del consumidor también se ha comprobado.</li>')
    body.append(f'<li>Ocho referencias reales de Horizons. Diferencia máxima frente al cálculo aparente CN+S: azimut {validation["max_horizons_az_delta_deg"]:.8f}° y elevación {validation["max_horizons_el_delta_deg"]:.8f}°. Es acuerdo entre modelos, no precisión absoluta del terreno.</li>')
    body.append(f'<li>Refinar de 0,25° a 0,125° y reducir los pasos radiales a la mitad produjo una diferencia máxima de {maxspatial:.5f}° en el horizonte; RMS máximo {maxrms:.5f}°. Estos son resultados de convergencia, no una cota certificada de error.</li>')
    body.append(f'<li>Refinar el paso temporal de 10 a 5 minutos cambió las métricas nominales como máximo {maxtime:.3f} h. Este ensayo aísla el paso temporal; no limita el error del terreno o del horizonte. Ver <a href="validacion/convergencia_temporal.json">valores por caso</a>.</li>')
    effect_path=ROOT/'validacion/efecto_refinamiento_espacial.json'
    if effect_path.exists():
        effect=load('validacion/efecto_refinamiento_espacial.json')
        body.append(f'<li>El cambio del muestreo espacial inicial al entregado modificó alguna métrica hasta {effect["max_abs_metric_change_hours"]:.3f} h. Las {effect["primary_winner_unchanged_count"]}/{effect["comparison_count"]} elecciones nominales del criterio principal se mantuvieron. Esto muestra por qué cinco minutos de paso temporal no equivalen a cinco minutos de precisión total.</li>')
    body.append('<li>Se añadió un tercer DEM de 240 m para extender el dominio hasta 400 km. La exclusión de terreno aún más lejano está condicionada al techo modelado de 12 km de elevación global. No hay sectores desconocidos en los escenarios entregados bajo esas hipótesis.</li></ul>')
    body.append('<h2>Límites y trabajo que sigue perteneciendo a la aplicación</h2><p>Faltan la interfaz de usuario final, la selección arbitraria de lugares y fechas, el despliegue y las pruebas del producto en otro portátil. Este paquete cubre dos lugares y dos ventanas concretas. No modela eclipses, fracción del disco, potencia eléctrica, antenas, enlace RF ni supervivencia térmica. El DEM puede omitir obstáculos y los eventos cortos pueden quedar submuestreados.</p>')
    body.append('<h2>Fuentes y reproducibilidad</h2><p><a href="https://pgda.gsfc.nasa.gov/products/78">NASA PGDA 78</a> · <a href="https://pgda.gsfc.nasa.gov/products/90">NASA PGDA 90</a> · <a href="https://naif.jpl.nasa.gov/pub/naif/generic_kernels/">NASA/JPL NAIF</a> · <a href="https://ssd.jpl.nasa.gov/horizons/">NASA/JPL Horizons</a>. Referencias: <a href="https://doi.org/10.1016/j.pss.2020.105119">Barker et al. 2021</a> y <a href="https://doi.org/10.3847/PSJ/acf3e1">Barker et al. 2023</a>. Solicitudes, respuestas, versiones, hashes y parámetros están incluidos.</p>')
    doc='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><style>'+css+'</style></head><body><main>'+''.join(body)+'</main></body></html>'
    (ROOT/'INFORME_RESULTADOS.html').write_text(doc,encoding='utf8')
    summary=dict(scenarios=len(scenarios),nominal_scenarios=12,unknown_hours_total_nominal=sum(r['metrics']['unknown_hours']for r in scenarios if r['variant']=='nominal'),
        validation=validation,spatial_max_deg=maxspatial,spatial_max_rms_deg=maxrms,temporal_max_metric_difference_hours=maxtime,
        frontend_json_bytes=(ROOT/'paquete_frontend.json').stat().st_size)
    (ROOT/'RESUMEN.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
