"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalFrame } from "@/lib/geospatial/mesh";
import {
  blockBounds,
  blocksAlongRay,
  blocksWithinRadius,
  buildRegionalMesh,
  loadRegionalBlocks,
  regionalBlocks,
  type Bounds,
  type RegionalBlockEntry,
  type RegionalGrid,
  type RegionalLevelId,
  type RegionalMesh,
} from "@/lib/geospatial/regional";
import { TERRAIN_BOUNDS } from "@/lib/geospatial/terrain";

/** Radio (m) alrededor del sitio que se dibuja siempre con cada nivel. */
const NEAR_L0_M = 12_000;
const NEAR_L1_M = 50_000;
/** Pausa (ms) antes de pedir los bloques de una visual nueva. */
const RAY_SETTLE_MS = 450;
/** De más fino a más grueso. */
const FINENESS: RegionalLevelId[] = ["L0", "L1", "L2", "F"];
const SKIRT_M: Record<string, number> = { L0: 60, L1: 220, L2: 700, F: 1500 };
const STEP: Record<string, number> = { L0: 1, L1: 1, L2: 2, F: 1 };

/** Malla ya construida de cada bloque (por objeto de rejilla): solo se rehace si cambian el marco o las exclusiones. */
const MESH_CACHE = new WeakMap<RegionalGrid, { key: string; frame: LocalFrame; mesh: RegionalMesh }>();

export interface RegionalPiece {
  id: string;
  level: RegionalLevelId;
  mesh: RegionalMesh;
}

const intersects = (a: Bounds, b: Bounds) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/**
 * Relieve regional (LOLA PGDA90) alrededor del recorte local de 5 m, por bloques y niveles de
 * detalle. Siempre: visión general L2 (1,28 km), anillo L1 (320 m) y anillo L0 (80 m nativo).
 * Bajo demanda: los bloques nativos que atraviesa la visual hasta el relieve que fija el
 * horizonte según el motor. Cada malla excluye lo que ya dibuja un bloque más fino cargado.
 */
export function useRegionalTerrain(
  frame: LocalFrame,
  site: { x: number; y: number; lonEastDeg: number; latDeg: number },
  liveRay: { azimuthDeg: number; distanceM: number } | null,
): { pieces: RegionalPiece[]; grids: RegionalGrid[]; pending: number; failed: number } {
  const [grids, setGrids] = useState<Map<string, RegionalGrid>>(() => new Map());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const requested = useRef(new Set<string>());

  // La visual solo pide bloques cuando lleva un momento quieta: mientras se arrastra la altura o el
  // azimut cambia a cada paso, y pedir y mallar bloques en cada uno retrasaba el dato de la altura final.
  const rayAz = liveRay?.azimuthDeg ?? null;
  const rayDist = liveRay?.distanceM ?? null;
  const [ray, setRay] = useState<{ azimuthDeg: number; distanceM: number } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setRay(rayAz === null || rayDist === null ? null : { azimuthDeg: rayAz, distanceM: rayDist }), RAY_SETTLE_MS);
    return () => clearTimeout(t);
  }, [rayAz, rayDist]);

  const wanted = useMemo(() => {
    const list: RegionalBlockEntry[] = [
      ...blocksWithinRadius({ x: site.x, y: site.y }, NEAR_L0_M, "L0"),
      ...blocksWithinRadius({ x: site.x, y: site.y }, NEAR_L1_M, "L1"),
      ...regionalBlocks("L2"),
    ];
    if (ray && ray.distanceM > 1500) {
      const ll = { lonEastDeg: site.lonEastDeg, latDeg: site.latDeg };
      // Margen de un bloque más allá del obstáculo: la cresta se ve con lo que tiene detrás.
      list.push(...blocksAlongRay(ll, ray.azimuthDeg, ray.distanceM + 6000, { levels: ["L0"] }), ...blocksAlongRay(ll, ray.azimuthDeg, ray.distanceM + 20000, { levels: ["L1"] }));
    }
    return list;
  }, [site.x, site.y, site.lonEastDeg, site.latDeg, ray?.azimuthDeg, ray?.distanceM]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const asked = requested.current;
    const todo = wanted.filter((b) => !asked.has(b.id));
    if (!todo.length) return;
    for (const b of todo) asked.add(b.id);
    let alive = true;
    const t = setTimeout(() => alive && setPending((n) => n + todo.length), 0);
    loadRegionalBlocks(todo).then(({ grids: got, errors }) => {
      if (!alive) return;
      setPending((n) => Math.max(0, n - todo.length));
      if (errors.length) setFailed((n) => n + errors.length);
      if (got.length)
        setGrids((prev) => {
          const next = new Map(prev);
          for (const g of got) next.set(g.entry.id, g);
          return next;
        });
    });
    return () => {
      alive = false;
      clearTimeout(t);
      // Efecto cancelado (StrictMode, cambio de lista): se volverá a pedir; la caché del cargador evita otra descarga.
      for (const b of todo) asked.delete(b.id);
    };
  }, [wanted]);

  const pieces = useMemo(() => {
    const all = [...grids.values()];
    const bounds = new Map(all.map((g) => [g.entry.id, blockBounds(g.entry)]));
    const out: RegionalPiece[] = [];
    for (const g of all) {
      const mine = bounds.get(g.entry.id)!;
      const rank = FINENESS.indexOf(g.entry.level);
      const exclude: Bounds[] = [TERRAIN_BOUNDS as Bounds];
      for (const o of all) if (FINENESS.indexOf(o.entry.level) < rank && intersects(mine, bounds.get(o.entry.id)!)) exclude.push(bounds.get(o.entry.id)!);
      const key = exclude.map((b) => b.join(",")).join("|");
      const hit = MESH_CACHE.get(g);
      let mesh: RegionalMesh;
      if (hit && hit.key === key && hit.frame === frame) mesh = hit.mesh;
      else {
        mesh = buildRegionalMesh(g, frame, { exclude, skirtM: SKIRT_M[g.entry.level] ?? 200, step: STEP[g.entry.level] ?? 1 });
        MESH_CACHE.set(g, { key, frame, mesh });
      }
      if (mesh.indices.length) out.push({ id: g.entry.id, level: g.entry.level, mesh });
    }
    return out;
  }, [grids, frame]);

  const list = useMemo(() => [...grids.values()], [grids]);
  return { pieces, grids: list, pending, failed };
}
