export type TempZipPart = {
  filePath: string; // tmp path on disk
  region: string; // logical placement in final zip
  municipio: string; // logical placement in final zip
  partIndex: number; // 1-based
};

export type ZipCreatorOptions = {
  maxSizeBytes?: number; // default 40MB
  tmpRootDir?: string; // default os.tmpdir()/pnae-zips
};
