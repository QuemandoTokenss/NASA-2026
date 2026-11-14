"""Descarga reanudable del raster regional adicional, con rangos HTTP verificados."""
from pathlib import Path
import concurrent.futures,datetime,hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT.parent/'RECOPILACION_DATOS_2026-11-14'
URL='https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF'
REL='datos_originales/PGDA90_contexto/LDEM_60S_240MPP_ADJ.TIF'
def digest(p):
    h=hashlib.sha256()
    with p.open('rb')as f:
        for v in iter(lambda:f.read(1024*1024),b''):h.update(v)
    return h.hexdigest()
def main():
    dest=RAW/REL;manifest=ROOT/'documentacion/descarga_regional_ampliado.json'
    if dest.exists()and manifest.exists():
        previous=json.loads(manifest.read_text(encoding='utf8'))
        if previous.get('sha256')==digest(dest):return
    with urllib.request.urlopen(urllib.request.Request(URL,method='HEAD'),timeout=30)as response:
        size=int(response.headers['Content-Length']);etag=response.headers.get('ETag');modified=response.headers.get('Last-Modified')
    cache=ROOT/'.cache/descarga_regional';cache.mkdir(parents=True,exist_ok=True)
    block=8*1024*1024
    chunks=[(i,offset,min(offset+block,size)-1)for i,offset in enumerate(range(0,size,block))]
    def get(item):
        i,a,b=item;p=cache/f'{i:04d}.bin'
        if p.exists()and p.stat().st_size==b-a+1:return p
        request=urllib.request.Request(URL,headers={'Range':f'bytes={a}-{b}','User-Agent':'SiteRegret/0.1 scientific data download'})
        with urllib.request.urlopen(request,timeout=45)as r:
            if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {a}-{b}/{size}':raise ValueError('Unexpected byte range')
            if r.headers.get('ETag')!=etag:raise ValueError('Source changed during download')
            data=r.read()
        if len(data)!=b-a+1:raise ValueError('Incomplete byte range')
        p.write_bytes(data);return p
    with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
        paths=list(pool.map(get,chunks))
    tmp=dest.with_name(dest.name+'.ranged.part')
    with tmp.open('wb')as out:
        for p in paths:
            with p.open('rb')as f:
                for v in iter(lambda:f.read(1024*1024),b''):out.write(v)
    if tmp.stat().st_size!=size:raise ValueError('Wrong total size')
    with tmp.open('rb')as f:
        if f.read(4)not in [b'II*\x00',b'II+\x00',b'MM\x00*',b'MM\x00+']:raise ValueError('Not TIFF')
    tmp.replace(dest)
    result=dict(id='DEM_LEJANO_240M',url=URL,path=REL,purpose='Tercer nivel de relieve para horizonte lejano hasta 400 km',kind='tiff',bytes=size,sha256=digest(dest),
        verification_status='BYTES_VERIFIED',downloaded_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),last_modified=modified,etag=etag,
        download_method='Verified HTTP byte ranges; original bytes concatenated without data transformation',provider='NASA GSFC / LRO-LOLA',source_page='https://pgda.gsfc.nasa.gov/products/90',
        license_note='Citar Barker et al. 2023 y DOI 10.60903/gsfcpgda-lola-spole',processing_steps=[])
    manifest.parent.mkdir(parents=True,exist_ok=True);manifest.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    dest.with_name(dest.name+'.http.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print('REGIONAL_SUPPORT_READY',size,result['sha256'],flush=True)
if __name__=='__main__':main()
