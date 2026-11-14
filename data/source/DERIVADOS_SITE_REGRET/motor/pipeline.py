"""SITE REGRET: geometría reproducible con originales NASA. No apto para vuelo."""
from pathlib import Path
import argparse,csv,datetime as dt,hashlib,importlib.metadata as md,io,json,math,sys,tarfile,time,urllib.parse,urllib.request
import numpy as np
import rasterio
import pyproj
import shapefile
import spiceypy as sp
from scipy.ndimage import map_coordinates,gaussian_filter

ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT.parent/'RECOPILACION_DATOS_2026-11-14'
R=1737400.0
FRAME='MOON_ME_DE421'
HEIGHTS=[0,2,10]
WINDOWS=[dict(id='W1',start='2026-11-14T00:00:00Z',stop='2026-12-14T00:00:00Z'),dict(id='W2',start='2026-12-14T00:00:00Z',stop='2027-01-13T00:00:00Z')]
CONFIG=dict(version='0.1.0',frame=FRAME,reference_radius_m=R,heights_m=HEIGHTS,windows=WINDOWS,
    time_step_minutes=10,azimuth_step_deg=0.25,max_ray_distance_m=400000,minimum_ray_distance_m=2.5,
    local_radial_steps_m=[1.25,2.5,5],regional_radial_step_m=20,far_radial_step_m=60,base_radial_refinement_factor=2,
    body_visibility='CENTER_STRICTLY_ABOVE_TERRAIN',aberration='NONE',azimuth='north=0 east=90 clockwise',
    hypothesis_X_m=1.0,gaussian_filter_sigma_m=100.0,seed=20261114,
    synthetic_field_normalization='max absolute value = 1 before common site/edge taper',
    anchor_inner_radius_m=5,anchor_outer_radius_m=50,edge_taper_width_m=250,
    observer_on_published_clone='clone surface height + mast; geographic location fixed',
    observer_on_synthetic_variant='nominal surface height + mast, anchored at both sites',
    primary_criterion='min_longest_dark_hours',tie_tolerance_hours=10/60,
    far_terrain_upper_bound_m=12000,
    far_bound_source='https://ntrs.nasa.gov/api/citations/20160008718/downloads/20160008718.pdf',
    far_bound_note='Assumed conservative 12 km ceiling, above published LOLA global maximum 10.792 km; conditional bound, not subpixel certification',
    user_start_authorization='User states organization authorized starting before 09:00, recorded in this chat on 2026-11-14')
SITES_IN=[dict(id='A',name='Connecting Ridge · ROI 4',roi=4,x_m=-11287.5,y_m=-12167.5),dict(id='B',name='Connecting Ridge · ROI 6',roi=6,x_m=-10802.5,y_m=-11737.5)]
VARIANTS=['nominal','bias_plus','bias_minus','correlated_plus','correlated_minus']+[f'published_{i:04d}'for i in range(1,6)]
STATE_NAMES=['NEITHER','SUN_ONLY','EARTH_ONLY','BOTH','UNKNOWN']

def dump(path,obj):
    path=ROOT/path;path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(clean(obj),ensure_ascii=False,allow_nan=False,separators=(',',':')),encoding='utf8')
def clean(value):
    if isinstance(value,np.ndarray):return clean(value.tolist())
    if isinstance(value,dict):return {k:clean(v)for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [clean(v)for v in value]
    if isinstance(value,(np.integer,)):return int(value)
    if isinstance(value,(np.floating,float)):return None if not np.isfinite(value) else float(value)
    if isinstance(value,np.bool_):return bool(value)
    return value
def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb')as f:
        for v in iter(lambda:f.read(1024*1024),b''):h.update(v)
    return h.hexdigest()
def utc(t):return t.isoformat(timespec='seconds').replace('+00:00','Z')
def read(rel):
    path=RAW/'datos_originales'/rel
    with rasterio.open(path)as ds:
        a=ds.read(1)
        info=dict(path=str(path),shape=list(a.shape),transform=list(ds.transform),crs_wkt=ds.crs.to_wkt(),
            finite_count=int(np.isfinite(a).sum()),nodata_count=int((~np.isfinite(a)).sum()),
            minimum=float(np.nanmin(a)),maximum=float(np.nanmax(a)),sha256=sha(path))
        return a,ds.transform,ds.crs,info
def sample(a,transform,x,y):
    # Transform maps pixel edges; scipy samples pixel centers.
    col=(np.asarray(x)-transform.c)/transform.a-0.5
    row=(np.asarray(y)-transform.f)/transform.e-0.5
    return map_coordinates(a,[row,col],order=1,mode='constant',cval=np.nan,prefilter=False)
def xyz_unit(x,y):
    rho=np.hypot(x,y);lat=-np.pi/2+2*np.arctan(rho/(2*R));lon=np.arctan2(x,y)
    return np.stack([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)],axis=-1)
def stereo(unit):
    k=2*R/(1-unit[...,2]);return unit[...,1]*k,unit[...,0]*k
def basis(lon,lat):
    lo,la=np.deg2rad([lon,lat])
    return np.array([-np.sin(lo),np.cos(lo),0]),np.array([-np.sin(la)*np.cos(lo),-np.sin(la)*np.sin(lo),np.cos(la)]),np.array([np.cos(la)*np.cos(lo),np.cos(la)*np.sin(lo),np.sin(la)])
def point_in_polygon(x,y,points):
    inside=False;j=len(points)-1
    for i,(xi,yi)in enumerate(points):
        xj,yj=points[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:inside=not inside
        j=i
    return inside
def prepare():
    nominal,tr,crs,info=read('PGDA78_Site01/Site01_final_adj_5mpp_surf.tif')
    regional,rt,rc,ri=read('PGDA90_contexto/LDEM_80S_80MPP_ADJ.TIF')
    distant,dtf,dc,di=read('PGDA90_contexto/LDEM_60S_240MPP_ADJ.TIF')
    quality={};qinfo={}
    for suffix in ['ldec','toterr','slp','slperr']:
        a,qt,qc,qi=read(f'PGDA78_Site01/Site01_final_adj_5mpp_{suffix}.tif')
        if qt!=tr or a.shape!=nominal.shape:raise ValueError('Quality alignment')
        quality[suffix]=a;qinfo[suffix]=qi
    with tarfile.open(RAW/'datos_originales/PGDA78_Site01/Site01_ROIs.tgz')as tf:
        reader=shapefile.Reader(**{k:io.BytesIO(tf.extractfile('Site01_ROIs.'+k).read())for k in ['shp','shx','dbf']})
        roi_records=list(reader.shapeRecords())
    inv=pyproj.Transformer.from_crs(crs,crs.geodetic_crs,always_xy=True)
    sites=[]
    for original in SITES_IN:
        s=dict(original);x,y=s['x_m'],s['y_m'];lon,lat=inv.transform(x,y)
        z=float(sample(nominal,tr,np.array([x]),np.array([y]))[0])
        if not np.isfinite(z):raise ValueError('Site nodata')
        rec=roi_records[s['roi']-1]
        if not np.allclose(list(rec.record),[x,y],atol=1e-6):raise ValueError('ROI attribute mismatch')
        contained=point_in_polygon(x,y,rec.shape.points)
        if not contained:raise ValueError('Candidate centroid outside ROI')
        s.update(longitude_east_deg=lon%360,longitude_signed_deg=lon,latitude_deg=lat,nominal_height_m=z,
            point_in_roi=contained,reference_frame=FRAME,height_datum='1737400 m sphere',
            values={k:float(sample(a,tr,np.array([x]),np.array([y]))[0])for k,a in quality.items()},
            coordinate_source='PGDA78 Site01_ROIs.dbf and Barker 2021 Table 2; no coordinate generated by AI')
        sites.append(s)
    xx=tr.c+(np.arange(nominal.shape[1])+0.5)*tr.a
    yy=tr.f+(np.arange(nominal.shape[0])+0.5)*tr.e
    dist=np.minimum.reduce([np.hypot(xx[None,:]-s['x_m'],yy[:,None]-s['y_m'])for s in sites])
    u=np.clip((dist-5)/45,0,1);anchor=u*u*(3-2*u)
    edge=np.minimum(np.minimum(np.arange(nominal.shape[0])[:,None]*5,(nominal.shape[0]-1-np.arange(nominal.shape[0]))[:,None]*5),np.minimum(np.arange(nominal.shape[1])[None,:]*5,(nominal.shape[1]-1-np.arange(nominal.shape[1]))[None,:]*5))
    u=np.clip(edge/250,0,1);taper=(anchor*u*u*(3-2*u)).astype('float32')
    rng=np.random.Generator(np.random.PCG64(CONFIG['seed']))
    field=gaussian_filter(rng.standard_normal(nominal.shape,dtype=np.float32),sigma=CONFIG['gaussian_filter_sigma_m']/5,mode='reflect')
    amplitude=taper*CONFIG['hypothesis_X_m']
    field/=np.max(np.abs(field));field*=amplitude
    surfaces={'nominal':nominal,'bias_plus':nominal+amplitude,'bias_minus':nominal-amplitude,'correlated_plus':nominal+field,'correlated_minus':nominal-field}
    clone_info={}
    for n in range(1,6):
        a,ct,cc,ci=read(f'PGDA78_Site01/Clones/Site01_final_adj_5mpp_{n:04d}_err.tif')
        if ct!=tr or a.shape!=nominal.shape:raise ValueError('Clone alignment')
        surfaces[f'published_{n:04d}']=a;clone_info[str(n)]=ci
    # Actual seam comparison on a coarser sample of the local domain. No correction applied.
    xg,yg=np.meshgrid(xx[::16],yy[::16]);reg_here=sample(regional,rt,xg,yg)
    differences=nominal[::16,::16]-reg_here
    qa=dict(local=info,regional=ri,distant=di,quality=qinfo,clones=clone_info,
        local_regional_overlap=dict(samples=int(differences.size),median_local_minus_regional_m=float(np.median(differences)),rms_m=float(np.sqrt(np.mean(differences**2))),max_abs_m=float(np.max(np.abs(differences))),action='No vertical correction; local replaces regional inside fine pixel-center footprint'),
        own_variant_parameters=CONFIG)
    dump('datos/sitios.json',sites);dump('validacion/qa_entradas.json',clean(qa))
    return sites,surfaces,tr,regional,rt,distant,dtf

def radial_grids(factor=1):
    local=np.r_[np.arange(2.5,500,2.5/factor),np.arange(500,5000,5/factor),np.arange(5000,24000+0.1,10/factor)]
    regional=np.r_[np.arange(500,240000,40/factor),np.arange(240000,400000+0.1,120/factor)]
    return local,regional
def rays(site,azimuth,dist):
    e,n,u=basis(site['longitude_east_deg'],site['latitude_deg'])
    az=np.deg2rad(azimuth)[:,None];theta=dist[None,:]/R
    direction=np.sin(az)[...,None]*e+np.cos(az)[...,None]*n
    units=np.cos(theta)[...,None]*u+np.sin(theta)[...,None]*direction
    return stereo(units)
def elevation_terrain(z,observer_z,dist):
    theta=dist/R
    # Stable near-field radial difference, avoiding subtraction of two radii.
    vertical=(z-observer_z)-(R+z)*2*np.sin(theta/2)**2
    horizontal=(R+z)*np.sin(theta)
    return np.rad2deg(np.arctan2(vertical,horizontal))
def horizon(site,surfaces,tr,regional,rt,distant,dtf,step=0.25,factor=1):
    az=np.arange(0,360,step);dl,dr=radial_grids(factor)
    result={v:{str(h):dict(elevation_deg=np.full(len(az),-90.),distance_m=np.zeros(len(az)),source=np.zeros(len(az),dtype=np.int8),unknown=np.zeros(len(az),dtype=bool))for h in HEIGHTS}for v in surfaces}
    observer={v:float(sample(a,tr,np.array([site['x_m']]),np.array([site['y_m']]))[0])for v,a in surfaces.items()}
    xmin,xmax=tr.c+2.5,tr.c+tr.a*(next(iter(surfaces.values())).shape[1]-.5)
    ymax,ymin=tr.f-2.5,tr.f+tr.e*(next(iter(surfaces.values())).shape[0]-.5)
    for j in range(0,len(az),60):
        ix=slice(j,min(j+60,len(az)));aa=az[ix]
        xl,yl=rays(site,aa,dl);xr,yr=rays(site,aa,dr)
        inside=(xl>=xmin)&(xl<=xmax)&(yl>=ymin)&(yl<=ymax)
        fine_region=(xr>=xmin)&(xr<=xmax)&(yr>=ymin)&(yr<=ymax)
        rz80=sample(regional,rt,xr,yr);rz240=sample(distant,dtf,xr,yr)
        rz=np.where(np.isfinite(rz80),rz80,rz240);rvalid=np.isfinite(rz)&~fine_region
        bad_region=np.any(~np.isfinite(rz)&~fine_region,axis=1)
        for v,a in surfaces.items():
            lz=sample(a,tr,xl,yl);lvalid=np.isfinite(lz)&inside
            bad=np.any(~np.isfinite(lz)&inside,axis=1)|bad_region
            for h in HEIGHTS:
                obs=observer[v]+h
                el=elevation_terrain(lz,obs,dl);er=elevation_terrain(rz,obs,dr)
                el=np.where(lvalid,el,-90);er=np.where(rvalid,er,-90)
                al=np.argmax(el,axis=1);ar=np.argmax(er,axis=1);rr=np.arange(len(aa))
                ml=el[rr,al];mr=er[rr,ar];local_wins=ml>=mr
                r=result[v][str(h)]
                r['elevation_deg'][ix]=np.maximum(ml,mr)
                r['distance_m'][ix]=np.where(local_wins,dl[al],dr[ar])
                r['source'][ix]=np.where(local_wins,0,np.where(np.isfinite(rz80[rr,ar]),1,2))
                r['unknown'][ix]=bad
    for v,hs in result.items():
        for h,r in hs.items():
            tail=float(elevation_terrain(CONFIG['far_terrain_upper_bound_m'],observer[v]+int(h),CONFIG['max_ray_distance_m']))
            r['far_bound_deg']=tail
            r['tail_below_sampled_horizon']=bool(np.all(r['elevation_deg']>tail))
            if not r['tail_below_sampled_horizon']:r['unknown']|=r['elevation_deg']<=tail
    return dict(azimuth_deg=az,observer_ground_height_m=observer,variants=result,
        sampling=dict(azimuth_step_deg=step,radial_factor=factor,min_distance_m=2.5,max_distance_m=CONFIG['max_ray_distance_m'],local_points_per_ray=len(dl),regional_points_per_ray=len(dr)))
def periodic(az,values,q):
    return np.interp(np.asarray(q)%360,np.r_[az,360.],np.r_[values,values[0]])
def horizon_at(horizon_data,variant,height,azimuth):
    r=horizon_data['variants'][variant][str(height)];az=horizon_data['azimuth_deg']
    val=periodic(az,r['elevation_deg'],azimuth)
    # Unknown in either interpolation neighbor contaminates that direction.
    ix=np.floor(np.asarray(azimuth)%360/horizon_data['sampling']['azimuth_step_deg']).astype(int)%len(az)
    bad=r['unknown'][ix]|r['unknown'][(ix+1)%len(az)]
    return np.where(bad,np.nan,val)
def load_kernels():
    sp.kclear();folder=RAW/'datos_originales/NAIF_DE421'
    names=['naif0012.tls','de421.bsp','moon_pa_de421_1900-2050.bpc','moon_080317.tf','pck00011.tpc']
    for name in names:sp.furnsh(str(folder/name))
    if sp.namfrm(FRAME)!=31007:raise ValueError('Frame unresolved')
    cover={}
    for body in [10,301,399]:
        c=sp.spkcov(str(folder/'de421.bsp'),body)
        cover[str(body)]=[[sp.et2utc(a,'ISOC',3),sp.et2utc(b,'ISOC',3)]for a,b in [sp.wnfetd(c,i)for i in range(sp.wncard(c))]]
    pc=sp.pckcov(str(folder/'moon_pa_de421_1900-2050.bpc'),31006)
    cover['PCK_31006']=[[sp.et2utc(a,'ISOC',3),sp.et2utc(b,'ISOC',3)]for a,b in [sp.wnfetd(pc,i)for i in range(sp.wncard(pc))]]
    return dict(frame=FRAME,frame_id=31007,kernels=[dict(name=n,sha256=sha(folder/n))for n in names],coverage_utc=cover)
def sky_grid(window,step_minutes=10):
    start=dt.datetime.fromisoformat(window['start'].replace('Z','+00:00'));stop=dt.datetime.fromisoformat(window['stop'].replace('Z','+00:00'))
    n=int((stop-start).total_seconds()/(step_minutes*60))
    times=[utc(start+dt.timedelta(minutes=i*step_minutes))for i in range(n+1)]
    et=np.asarray(sp.str2et(times))
    vectors={target:np.asarray(sp.spkpos(target,et,FRAME,'NONE','MOON')[0])for target in ['SUN','EARTH']}
    return dict(times=times,et=et,vectors=vectors,step_minutes=step_minutes)
def direction(site,ground_height,mast,vectors):
    e,n,u=basis(site['longitude_east_deg'],site['latitude_deg']);obs=(R+ground_height+mast)/1000*u
    result={}
    for target,positions in vectors.items():
        v=positions-obs;x=v@e;y=v@n;z=v@u
        result[target]=dict(azimuth_deg=np.rad2deg(np.arctan2(x,y))%360,elevation_deg=np.rad2deg(np.arctan2(z,np.hypot(x,y))),range_km=np.linalg.norm(v,axis=1))
    return result
def intervals(states,times):
    changes=np.r_[0,np.flatnonzero(states[1:]!=states[:-1])+1,len(states)]
    return [dict(start=times[a],stop=times[b],state=STATE_NAMES[int(states[a])],duration_minutes=(b-a)*CONFIG['time_step_minutes'],left_censored=bool(a==0),right_censored=bool(b==len(states)))for a,b in zip(changes[:-1],changes[1:])]
def longest(mask,step):
    transitions=np.diff(np.r_[False,mask,False].astype(np.int8));starts=np.flatnonzero(transitions==1);stops=np.flatnonzero(transitions==-1)
    return float(np.max(stops-starts)*step/60)if len(starts)else 0.
def classify(site,hd,variant,mast,grid):
    dirs=direction(site,hd['observer_ground_height_m'][variant],mast,grid['vectors'])
    sh=horizon_at(hd,variant,mast,dirs['SUN']['azimuth_deg']);eh=horizon_at(hd,variant,mast,dirs['EARTH']['azimuth_deg'])
    sun=dirs['SUN']['elevation_deg']>sh;earth=dirs['EARTH']['elevation_deg']>eh
    states=(sun.astype(np.int8)+2*earth.astype(np.int8));states[~np.isfinite(sh)|~np.isfinite(eh)]=4
    # The terminal sample is a boundary, never an additional interval.
    s=states[:-1];valid=s!=4;dh=grid['step_minutes']/60
    metrics=dict(duration_hours=len(s)*dh,known_hours=float(valid.sum()*dh),unknown_hours=float((~valid).sum()*dh),
        sun_hours=float(np.sum(((s==1)|(s==3))&valid)*dh),dte_center_hours=float(np.sum(((s==2)|(s==3))&valid)*dh),
        joint_hours=float(np.sum(s==3)*dh),longest_dark_hours=longest(((s==0)|(s==2))&valid,grid['step_minutes']),
        longest_no_earth_hours=longest(((s==0)|(s==1))&valid,grid['step_minutes']))
    return metrics,s,dirs,sh,eh,states
def compare(results,window,mast):
    criteria={'min_longest_dark_hours':('longest_dark_hours',-1),'max_sun_hours':('sun_hours',1),'max_dte_hours':('dte_center_hours',1),'max_joint_hours':('joint_hours',1)}
    all_c={}
    for criterion,(field,sign)in criteria.items():
        cases={}
        for v in VARIANTS:
            ma=results[('A',window,mast,v)]['metrics'];mb=results[('B',window,mast,v)]['metrics']
            if ma['unknown_hours']or mb['unknown_hours']:cases[v]=dict(winner='UNKNOWN');continue
            a,b=sign*ma[field],sign*mb[field];d=a-b
            winner='TIE'if abs(d)<=CONFIG['tie_tolerance_hours']+1e-10 else ('A'if d>0 else 'B')
            cases[v]=dict(winner=winner,utility_A=a,utility_B=b,D_hours=d,regret_A_hours=max(a,b)-a,regret_B_hours=max(a,b)-b)
        nominal=cases['nominal']['winner'];families={}
        for family,vs in [('own_sensitivity',VARIANTS[1:5]),('published_subset',VARIANTS[5:])]:
            valid=[cases[v]for v in vs if cases[v]['winner']!='UNKNOWN'];same=sum(c['winner']==nominal for c in valid)
            families[family]=dict(perturbations_exclude_nominal=True,generated_count=len(vs),evaluated_count=len(valid),
                ties=sum(c['winner']=='TIE'for c in valid),invalid_count=len(vs)-len(valid),
                same_winner_count=same if nominal in ['A','B']else None,
                same_winner_fraction=same/len(valid)if nominal in ['A','B']and valid else None,
                interpretation='Fraction of these modeled variants, not mission success probability',
                worst_regret_of_nominal_choice_hours=max(c['regret_'+nominal+'_hours']for c in valid)if nominal in ['A','B']and valid else None)
        phrase=(f'Con {window}, altura {mast} m, DEM LOLA y criterio {criterion}, la elección nominal es {nominal}. ')
        if nominal in ['A','B']:
            own=families['own_sensitivity'];pub=families['published_subset']
            phrase+=(f'Se conserva en {own["same_winner_count"]}/{own["evaluated_count"]} perturbaciones propias (X=1 m, sigma=100 m, semilla 20261114) '
                     f'y en {pub["same_winner_count"]}/{pub["evaluated_count"]} clones publicados evaluados. Las frecuencias no son probabilidades de misión.')
        else:phrase+='No se atribuye una fracción de conservación a un empate o resultado indeterminado.'
        all_c[criterion]=dict(nominal_winner=nominal,metric=field,maximize_sign=sign,tie_tolerance_hours=CONFIG['tie_tolerance_hours'],cases=cases,robustness=families,summary_es=phrase)
    return dict(window_id=window,height_m=mast,criteria=all_c)

def analytic_checks(sites):
    tests=[]
    def test(name,error,limit):
        tests.append(dict(name=name,error=float(error),limit=float(limit),passed=bool(error<=limit)))
    for s in sites:
        e,n,u=basis(s['longitude_east_deg'],s['latitude_deg']);mat=np.array([e,n,u])
        test(s['id']+'_ENU_orthonormal',np.max(np.abs(mat@mat.T-np.eye(3))),1e-12)
        test(s['id']+'_ENU_handedness',np.max(np.abs(np.cross(e,n)-u)),1e-12)
        xy=stereo(xyz_unit(s['x_m'],s['y_m']));test(s['id']+'_stereographic_roundtrip_m',np.max(np.abs(np.array(xy)-[s['x_m'],s['y_m']])),1e-6)
        eu=xyz_unit(s['x_m'],s['y_m']);test(s['id']+'_projection_vs_pyproj_unit',np.max(np.abs(eu-u)),1e-12)
    d=1000.;z=0.;expected=-np.rad2deg(d/R/2)
    test('sphere_zero_height_analytic_deg',abs(float(elevation_terrain(z,0,d))-expected),1e-10)
    # Independent Cartesian reference for a single obstacle on a spherical surface.
    theta=100/R;v=np.array([(R+10)*np.sin(theta),0,(R+10)*np.cos(theta)-R])
    expected=np.rad2deg(np.arctan2(v[2],np.hypot(v[0],v[1])))
    test('isolated_obstacle_Cartesian_reference_deg',abs(float(elevation_terrain(10,0,100))-expected),1e-9)
    o=np.array([1e6,2e6,-3e6]);p=o+np.array([3.,4.,5.]);shift=np.array([100.,-50.,40.])
    test('Cartesian_common_translation_invariant',np.max(np.abs((p-o)-((p+shift)-(o+shift)))),1e-10)
    s=np.array([3,3,0,0,4,2]);m=longest((s==0)|(s==2),10);test('unknown_breaks_dark_streak_hours',abs(m-1/3),1e-12)
    test('six_intervals_not_seven_hours',abs(len(s)*10/60-1),1e-12)
    test('azimuth_wrap_deg',abs(float(periodic(np.array([0.,90.,180.,270.]),np.array([0.,1.,2.,1.]),359.))-1/90),1e-12)
    return tests

def horizons_reference(sites):
    records=[]
    # Serial requests and on-disk cache per SSD fair-use policy.
    for site in sites:
        e,n,u=basis(site['longitude_east_deg'],site['latitude_deg']);obs=(R+site['nominal_height_m'])/1000*u
        for target in ['SUN','EARTH']:
            name=f'horizons_{site["id"]}_{target}';path=ROOT/'validacion'/(name+'.json')
            et0=sp.str2et('2026-11-14T00:00:00')
            params={'format':'json','COMMAND':"'"+('10'if target=='SUN'else '399')+"'",'OBJ_DATA':"'NO'",'MAKE_EPHEM':"'YES'",'EPHEM_TYPE':"'OBSERVER'",'CENTER':"'coord@301'",'COORD_TYPE':"'GEODETIC'",'SITE_COORD':f"'{site['longitude_east_deg']},{site['latitude_deg']},{site['nominal_height_m']/1000}'",'START_TIME':"'"+sp.timout(et0,'YYYY-MM-DD HR:MN:SC.### ::TDT')+"'",'STOP_TIME':"'"+sp.timout(et0+86400,'YYYY-MM-DD HR:MN:SC.### ::TDT')+"'",'STEP_SIZE':"'12h'",'QUANTITIES':"'4'",'APPARENT':"'AIRLESS'",'TIME_TYPE':"'TT'",'TIME_DIGITS':"'FRACSEC'",'CSV_FORMAT':"'YES'",'ELEV_CUT':"'-90'"}
            url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(params)
            if path.exists():raw=path.read_bytes()
            else:
                request=urllib.request.Request(url,headers={'User-Agent':'SiteRegret/0.1 (NASA Space Apps QuemandoTokens; https://www.spaceappschallenge.org/2026/find-a-team/quemandotokens/)'})
                with urllib.request.urlopen(request,timeout=60)as response:raw=response.read()
                path.write_bytes(raw)
                dump('validacion/'+name+'_peticion.json',dict(url=url,parameters=params))
            j=json.loads(raw);txt=j.get('result','')
            if j.get('error')or '$$SOE'not in txt:raise ValueError('Horizons error '+str(j.get('error')))
            for row in csv.reader(txt.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()):
                tt=row[0].strip();et=sp.str2et(tt+' TDT');ha,he=float(row[3]),float(row[4])
                apparent=sp.spkcpo(target,et,FRAME,'OBSERVER','CN+S',obs,'MOON',FRAME)[0][:3]
                geometric=sp.spkcpo(target,et,FRAME,'OBSERVER','NONE',obs,'MOON',FRAME)[0][:3]
                def angles(v):return np.rad2deg(np.arctan2(v@e,v@n))%360,np.rad2deg(np.arctan2(v@u,np.hypot(v@e,v@n)))
                aa,ae=angles(apparent);ga,ge=angles(geometric)
                da=float((aa-ha+180)%360-180);de=float(ae-he)
                records.append(dict(site=site['id'],target=target,tt=tt,utc=sp.et2utc(et,'ISOC',3)+'Z',horizons_az_deg=ha,horizons_el_deg=he,
                    spice_CN_S_az_deg=float(aa),spice_CN_S_el_deg=float(ae),delta_az_deg=da,delta_el_deg=de,
                    geometric_az_deg=float(ga),geometric_el_deg=float(ge),
                    assessment='CROSS_MODEL_AGREEMENT'if max(abs(da),abs(de))<0.01 else 'REVIEW',
                    comparison_limitations='Horizons DE441 apparent includes relativity; local DE421 CN+S lacks relativistic deflection. Geometric NONE numbers are not exact like-for-like reference.',
                    reference_sha256=sha(path),signature=j.get('signature')))
    dump('validacion/contraste_horizons.json',records)
    return records

def main():
    from descargar_apoyo import main as ensure_support
    ensure_support()
    start=time.time();dump('configuracion.json',CONFIG)
    sites,surfaces,tr,regional,rt,distant,dtf=prepare();print('INPUTS_VERIFIED',flush=True)
    kernel=load_kernels();tests=analytic_checks(sites)
    hd={};conv=[]
    for site in sites:
        sid=site['id'];cache=ROOT/'datos'/('horizonte_'+sid+'.npz')
        # Re-run intentionally recomputes rather than trusting a stale configuration cache.
        t=time.time();hd[sid]=horizon(site,surfaces,tr,regional,rt,distant,dtf,factor=CONFIG['base_radial_refinement_factor'])
        print('HORIZON',sid,round(time.time()-t,1),'seconds',flush=True)
        fine=horizon(site,{'nominal':surfaces['nominal']},tr,regional,rt,distant,dtf,step=.125,factor=2*CONFIG['base_radial_refinement_factor'])
        for h in HEIGHTS:
            nominal=hd[sid]['variants']['nominal'][str(h)]['elevation_deg'];ref=fine['variants']['nominal'][str(h)]['elevation_deg']
            at_base=ref[::2];delta=at_base-nominal
            # Angular refinement separately, interpolating base at interstitial azimuths.
            angular=ref-periodic(hd[sid]['azimuth_deg'],nominal,fine['azimuth_deg'])
            conv.append(dict(site=sid,height_m=h,radial_refinement_max_abs_deg=float(np.max(np.abs(delta))),
                angular_and_radial_refinement_max_abs_deg=float(np.max(np.abs(angular))),rms_deg=float(np.sqrt(np.mean(angular**2))),
                outer_50km_contributing_sectors=int(np.sum(hd[sid]['variants']['nominal'][str(h)]['distance_m']>200000)),
                tail_below_horizon=hd[sid]['variants']['nominal'][str(h)]['tail_below_sampled_horizon']))
        for v,hs in hd[sid]['variants'].items():
            for h1,h2 in [(0,2),(2,10)]:
                error=float(np.max(hs[str(h2)]['elevation_deg']-hs[str(h1)]['elevation_deg']))
                tests.append(dict(name=f'{sid}_{v}_height_monotonic_{h1}_{h2}',error=error,limit=1e-10,passed=error<=1e-10))
        dump('datos/horizonte_'+sid+'.json',clean(hd[sid]))
    dump('validacion/convergencia_espacial.json',conv)
    reference=horizons_reference(sites);print('HORIZONS_REFERENCE',len(reference),flush=True)
    all_results={};sky_export={};timeconv=[];crossings=[]
    for window in WINDOWS:
        grid=sky_grid(window);finegrid=sky_grid(window,5)
        sky_export[window['id']]=dict(window=window,times_utc=grid['times'],et_tdb_seconds_j2000=grid['et'].tolist(),sites={})
        for site in sites:
            sid=site['id'];sky_export[window['id']]['sites'][sid]={}
            for mast in HEIGHTS:
                for v in VARIANTS:
                    metrics,states,dirs,sh,eh,terminal=classify(site,hd[sid],v,mast,grid)
                    result=dict(site_id=sid,window_id=window['id'],height_m=mast,variant=v,
                        status='READY_WITH_LIMITS'if metrics['unknown_hours']==0 else 'PARTIAL',metrics=metrics,state_codes=states.tolist(),
                        intervals=intervals(states,grid['times']),observer_ground_height_m=hd[sid]['observer_ground_height_m'][v])
                    all_results[(sid,window['id'],mast,v)]=result
                    if v=='nominal':
                        sky_export[window['id']]['sites'][sid][str(mast)]=dict(bodies={k:{f:arr.tolist()for f,arr in value.items()}for k,value in dirs.items()},sun_horizon_deg=sh.tolist(),earth_horizon_deg=eh.tolist())
                        fm=classify(site,hd[sid],v,mast,finegrid)[0]
                        timeconv.append(dict(site=sid,window=window['id'],height_m=mast,coarse_minutes=10,fine_minutes=5,
                            differences_hours={k:fm[k]-metrics[k]for k in ['sun_hours','dte_center_hours','joint_hours','longest_dark_hours','longest_no_earth_hours']}))
                        for target,key in [('SUN',1),('EARTH',2)]:
                            flags=((terminal&key)!=0)&(terminal!=4)
                            for i in np.flatnonzero(flags[1:]!=flags[:-1]):
                                if terminal[i]==4 or terminal[i+1]==4:continue
                                crossings.append(dict(site=sid,window=window['id'],height_m=mast,target=target,event='RISE'if flags[i+1]else 'SET',earliest_utc=grid['times'][i],latest_utc=grid['times'][i+1],precision='10 minute bracket; no exact event claim'))
        print('WINDOW',window['id'],'READY',flush=True)
    comparisons=[compare(all_results,w['id'],h)for w in WINDOWS for h in HEIGHTS]
    dump('datos/efemerides_nominales.json',sky_export);dump('datos/escenarios.json',list(all_results.values()))
    dump('datos/comparaciones.json',clean(comparisons));dump('datos/eventos_acotados.json',crossings)
    dump('validacion/convergencia_espacial.json',conv);dump('validacion/convergencia_temporal.json',timeconv)
    # Additional consistency tests on outputs, independent of specific expected winners.
    for key,r in all_results.items():
        m=r['metrics'];good=abs(m['known_hours']+m['unknown_hours']-720)<1e-8 and m['joint_hours']<=min(m['sun_hours'],m['dte_center_hours'])+1e-8
        tests.append(dict(name='_'.join(map(str,key))+'_metric_bounds',passed=bool(good)))
    for cmp in comparisons:
        for criterion,c in cmp['criteria'].items():
            for v,case in c['cases'].items():
                if case['winner']=='UNKNOWN':continue
                tests.append(dict(name=f'{cmp["window_id"]}_{cmp["height_m"]}_{criterion}_{v}_regret_nonnegative',passed=min(case['regret_A_hours'],case['regret_B_hours'])>=0))
    dump('validacion/pruebas.json',tests)
    packages={p:md.version(p)for p in ['numpy','scipy','rasterio','pyproj','spiceypy','pyshp']}
    (ROOT/'motor/requirements.lock.txt').write_text('\n'.join(k+'=='+v for k,v in packages.items())+'\n',encoding='utf8')
    source_manifest=json.loads((RAW/'manifest_integrado.json').read_text(encoding='utf8'))
    source_manifest['assets'].append(json.loads((ROOT/'documentacion/descarga_regional_ampliado.json').read_text(encoding='utf8')))
    used_ids=['SITE01_surf','SITE01_ldec','SITE01_toterr','SITE01_slp','SITE01_slperr','SITE01_ROIS','DEM_REGIONAL_80M','LSK','SPK_DE421','PCK_MOON_DE421','FK_MOON_DE421','PCK_CONSTANTS']+[f'SITE01_CLONE_{i:04d}'for i in range(1,6)]
    used_ids.append('DEM_LEJANO_240M')
    used=[a for a in source_manifest['assets']if a['id']in used_ids]
    for a in used:
        if sha(RAW/a['path'])!=a['sha256']:raise ValueError('Source checksum mismatch')
    passport=dict(configuration=CONFIG,generated_at_utc=dt.datetime.now(dt.timezone.utc).isoformat(),
        nature=dict(terrain='DERIVED_PUBLISHED',ephemerides='DERIVED_SPICE',heights='SIMULATED',synthetic_variants='MODELED',published_clones='PUBLISHED_MODELED_ENSEMBLE'),
        kernel_validation=kernel,source_assets=used,software=packages,python=sys.version,engine_sha256=sha(__file__),
        listed_NASA_resource_effectively_used=dict(name='Horizons System',role='Stored reference observations and angular cross-model comparison',evidence='validacion/contraste_horizons.json'),
        limitations=['Bounded and discretized terrain, no obstacles below effective DEM resolution','Point-center criterion, no full disc fraction or atmospheric refraction, eclipses not modeled','Geometric NONE is not identical to apparent light-time-corrected visibility','No radio link budget, power production, thermal survival or landing certification','Only five published clones, not the complete 100-member ensemble','Synthetic X=1 m is an editable hypothesis, not a calibrated LOLA uncertainty','Horizon beyond 400 km excluded conditionally under 12 km global-height ceiling','Time intervals use left-sample 10 minute bins; event times are brackets'],
        scenario_count=len(all_results),comparison_count=len(comparisons),validation=dict(passed=sum(t['passed']for t in tests),failed=sum(not t['passed']for t in tests),
            horizons_reference_rows=len(reference),max_horizons_az_delta_deg=max(abs(r['delta_az_deg'])for r in reference),max_horizons_el_delta_deg=max(abs(r['delta_el_deg'])for r in reference)),
        elapsed_seconds=time.time()-start)
    dump('datos/pasaporte.json',clean(passport))
    if passport['validation']['failed']:raise RuntimeError('Scientific checks failed')
    print('COMPLETE',json.dumps(passport['validation']),round(time.time()-start,1),'seconds',flush=True)

if __name__=='__main__':main()
