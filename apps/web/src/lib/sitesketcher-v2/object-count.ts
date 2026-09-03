import type { AutoParkingLayout, CadImage, CadInstance, ParkingBlock, Polygon } from '@/types/sitesketcher-v2';

export interface SketchObjectCount {
  polygons: number;
  parkingBlocks: number;
  cadImages: number;
  autoLayouts: number;
}

interface SketchObjectCountInput {
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  cadInstances: CadInstance[];
  autoLayouts?: AutoParkingLayout[];
}

export function getSketchObjectCount({
  polygons,
  parkingBlocks,
  cadImages,
  cadInstances,
  autoLayouts = [],
}: SketchObjectCountInput): SketchObjectCount {
  return {
    polygons: polygons.length,
    parkingBlocks: parkingBlocks.length,
    cadImages: cadImages.filter((cad) => cad.anchor !== null).length + cadInstances.length,
    autoLayouts: autoLayouts.length,
  };
}
