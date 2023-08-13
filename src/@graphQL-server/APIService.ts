export interface APIService<T> {
  findOne?: (id: number) => Promise<T>;
  findFirst?: () => Promise<T>;
  findAll?: () => Promise<T[]>;
  create?: (input: T) => Promise<T> | number;
  createMany?: () => void;
  delete?: (id: number) => void;
  update?: (update: Partial<T> & { id: number }) => void;
  deleteMany?: () => void;
  updateMany?: () => void;
  upsert?: () => void;
  count?: () => void;
  serialize?: () => void;
  deserialize?: () => void;
}
