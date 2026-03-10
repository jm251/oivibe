// @ts-nocheck
"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { buildVolSurfaceMesh, buildVolSurfacePoints } from "@/lib/market/vol-surface";
import { OptionChainRow } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

export function VolSurfacePanel({ rows }: { rows: OptionChainRow[] }) {
  const {
    volSurfaceEnabled,
    volSurfaceHighQuality,
    setVolSurfaceEnabled,
    setVolSurfaceQuality
  } = useUiStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>3D Volatility Surface</span>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <Switch checked={volSurfaceEnabled} onCheckedChange={setVolSurfaceEnabled} />
              Enabled
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={volSurfaceHighQuality}
                onCheckedChange={setVolSurfaceQuality}
              />
              High quality
            </label>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {volSurfaceEnabled ? (
          <div className="h-[340px] rounded-md border border-border/80 bg-[#03050a]">
            <Canvas
              camera={{ position: [0, 70, 190], fov: 50 }}
              dpr={volSurfaceHighQuality ? [1, 2] : [1, 1.2]}
            >
              <ambientLight intensity={0.8} />
              <pointLight position={[120, 200, 80]} intensity={1.4} />
              <SurfaceMesh rows={rows} />
              <OrbitControls enablePan={false} maxDistance={320} minDistance={80} />
            </Canvas>
          </div>
        ) : (
          <div className="flex h-[340px] items-center justify-center rounded-md border border-dashed border-border/70 text-sm text-muted-foreground">
            Volatility surface disabled
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SurfaceMesh({ rows }: { rows: OptionChainRow[] }) {
  const geometry = useMemo(() => {
    const points = buildVolSurfacePoints(rows);
    const mesh = buildVolSurfaceMesh(points);

    const geo = new THREE.BufferGeometry();
    if (!mesh.vertices.length || !mesh.indices.length) {
      return geo;
    }

    const vertices = new Float32Array(mesh.vertices.length);
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const strike = mesh.vertices[i] ?? 0;
      const dte = mesh.vertices[i + 1] ?? 0;
      const iv = mesh.vertices[i + 2] ?? 0;

      vertices[i] = strike / 120;
      vertices[i + 1] = iv;
      vertices[i + 2] = dte * 4;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setIndex(mesh.indices);
    geo.computeVertexNormals();

    return geo;
  }, [rows]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2.8, 0, 0]} position={[0, -30, -32]}>
      <meshStandardMaterial
        color="#00ff7e"
        emissive="#0b4026"
        roughness={0.22}
        metalness={0.1}
        wireframe={false}
      />
    </mesh>
  );
}
