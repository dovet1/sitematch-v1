import type { CadImage, CadInstance, ParkingBlock, Polygon } from '@/types/sitesketcher-v2';

export interface SketchObjectCount {
  polygons: number;
  parkingBlocks: number;
  cadImages: number;
}

interface SketchObjectCountInput {
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  cadInstances: CadInstance[];
}

export function getSketchObjectCount({
  polygons,
  parkingBlocks,
  cadImages,
  cadInstances,
}: SketchObjectCountInput): SketchObjectCount {
  return {
    polygons: polygons.length,
    parkingBlocks: parkingBlocks.length,
    cadImages: cadImages.filter((cad) => cad.anchor !== null).length + cadInstances.length,
  };
}
