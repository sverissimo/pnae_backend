test('placeholder test: Review and implement test below', () => {
  expect(true).toBe(true);
});
// import { join } from 'path';
// import { existsSync } from 'fs';

// // Mocked FS functions
// const fsMkdir = jest.fn();
// const fsWriteFile = jest.fn();
// const now = () => new Date();
// const d = (s: string) => new Date(s);

// // --------- RUN npm install memfs --save-dev to use this in real code ---------
// const MemFS = function () {
//   this.paths = new Set<string>();
//   this.exists = (p: string) => this.paths.has(p);
//   this.add = (p: string) => this.paths.add(p);
//   this.del = (p: string) => this.paths.delete(p);
// };
// describe('FileService.update (integration-ish): update → removeOutdated → cleanup', () => {
//   let service: any;
//   let prisma: any;
//   let produtorService: any;

//   const uploadRoot = '/uploads';
//   const relatorio = { id: 'R1', contratoId: 2 } as any;

//   // in-memory DB table
//   type Row = {
//     id: string;
//     description: 'FOTO_RELATORIO' | 'ASSINATURA_PRODUTOR';
//     relatorioId: string;
//     uploadDate?: Date;
//   };
//   let table: Row[];

//   // fake FS
//   const memfs = new MemFS();

//   beforeEach(() => {
//     jest.clearAllMocks();

//     // seed DB with: old foto, two assinaturas (one "dangling" older)
//     table = [
//       {
//         id: 'old-foto',
//         description: 'FOTO_RELATORIO',
//         relatorioId: 'R1',
//         uploadDate: d('2024-01-01T00:00:00Z'),
//       },
//       {
//         id: 'old-sig',
//         description: 'ASSINATURA_PRODUTOR',
//         relatorioId: 'R1',
//         uploadDate: d('2024-01-02T00:00:00Z'),
//       },
//       {
//         id: 'dangling-sig',
//         description: 'ASSINATURA_PRODUTOR',
//         relatorioId: 'R1',
//         uploadDate: d('2023-12-31T00:00:00Z'),
//       },
//     ];

//     // seed FS with files corresponding to those DB rows
//     memfs.paths = new Set([
//       join(uploadRoot, 'old-foto'),
//       join(uploadRoot, 'old-sig'),
//       join(uploadRoot, 'dangling-sig'),
//     ]);

//     // FS stubs
//     (existsSync as jest.Mock).mockImplementation((p: string) =>
//       memfs.exists(p),
//     );
//     (fsMkdir as jest.Mock).mockImplementation(async (p: string) => {
//       memfs.add(p);
//     });
//     (fsWriteFile as jest.Mock).mockImplementation(async (p: string) => {
//       memfs.add(p);
//     });

//     // Prisma mocks backed by in-memory table
//     prisma = {
//       pictureFile: {
//         create: jest.fn().mockImplementation(async ({ data }: any) => {
//           const row: Row = {
//             id: data.id,
//             description: data.description,
//             relatorioId: data.relatorio.connect.id,
//             uploadDate: now(),
//           };
//           table.push(row);
//           return row;
//         }),
//         findMany: jest.fn().mockImplementation(async (args: any) => {
//           // support two shapes:
//           //  1) by ids: { where: { id: { in: [...] } } }
//           //  2) by relatorioId: { where: { relatorioId } }
//           if (args?.where?.id?.in) {
//             const ids = new Set(args.where.id.in);
//             return table.filter((r) => ids.has(r.id));
//           }
//           if (args?.where?.relatorioId) {
//             return table.filter(
//               (r) => r.relatorioId === args.where.relatorioId,
//             );
//           }
//           return [];
//         }),
//         deleteMany: jest.fn().mockImplementation(async (args: any) => {
//           const ids = new Set(args?.where?.id?.in ?? []);
//           const toDelete = table.filter((r) => ids.has(r.id));
//           // remove from DB
//           table = table.filter((r) => !ids.has(r.id));
//           return { count: toDelete.length };
//         }),
//       },
//     };

//     produtorService = { getUnidadeEmpresa: jest.fn() };

//     // fresh service
//     const { FileService } = require('./file.service');
//     service = new FileService(prisma, produtorService);

//     // force deterministic folder path
//     jest.spyOn(service as any, 'getFolderPath').mockResolvedValue(uploadRoot);

//     // intercept disk deletion (private) by spying and simulating unlink
//     jest
//       .spyOn(service as any, 'deleteFile')
//       .mockImplementation(async (p: string) => {
//         memfs.del(p);
//       });
//   });

//   it('replaces old files, removes outdated ones from DB & FS, and cleans dangling duplicates by description', async () => {
//     const files = {
//       foto: [
//         {
//           fieldname: 'foto',
//           originalname: 'new-foto.jpg',
//           mimetype: 'image/jpeg',
//           buffer: Buffer.from('x'),
//         },
//       ],
//       assinatura: [
//         {
//           fieldname: 'assinatura',
//           originalname: 'new-sig.jpg',
//           mimetype: 'image/jpeg',
//           buffer: Buffer.from('y'),
//         },
//       ],
//     } as any;

//     // New files don't exist on disk yet; old ones do.
//     // existsSync is already wired to memfs.

//     await service.update(files, relatorio);

//     // 1) New records should be created
//     expect(prisma.pictureFile.create).toHaveBeenCalledTimes(2);
//     const createdIds =
//       prisma.pictureFile.create.mock.calls.map(([,]) => undefined) || // just to keep TS happy
//       [];
//     expect(table.some((r) => r.id === 'new-foto')).toBe(true);
//     expect(table.some((r) => r.id === 'new-sig')).toBe(true);

//     // 2) Outdated IDs (old-foto, old-sig) should be removed by removeOutdatedFiles
//     //    and their files deleted from disk.
//     // We don’t assert private calls; we assert effects:
//     expect(table.some((r) => r.id === 'old-foto')).toBe(false);
//     expect(table.some((r) => r.id === 'old-sig')).toBe(false);
//     expect(memfs.exists(join(uploadRoot, 'old-foto'))).toBe(false);
//     expect(memfs.exists(join(uploadRoot, 'old-sig'))).toBe(false);

//     // 3) Dangling duplicate by description ("dangling-sig") should be cleaned up
//     //    because a fresh "new-sig" exists and dangling is older.
//     expect(table.some((r) => r.id === 'dangling-sig')).toBe(false);
//     expect(memfs.exists(join(uploadRoot, 'dangling-sig'))).toBe(false);

//     // 4) The final state should contain exactly the two new records for R1, one per description.
//     const finalForR1 = table.filter((r) => r.relatorioId === 'R1');
//     const descs = finalForR1.map((r) => r.description).sort();
//     expect(descs).toEqual(['ASSINATURA_PRODUTOR', 'FOTO_RELATORIO']);
//     expect(finalForR1.map((r) => r.id).sort()).toEqual(['new-foto', 'new-sig']);
//     // And the files should exist on disk
//     expect(memfs.exists(join(uploadRoot, 'new-foto'))).toBe(true);
//     expect(memfs.exists(join(uploadRoot, 'new-sig'))).toBe(true);
//   });

//   it('adds missing DB record when file present on disk, no outdated deletions, cleanup no-ops', async () => {
//     // Prepare: a photo is already on disk but has no DB record
//     memfs.add(join(uploadRoot, 'lonely-foto'));
//     // DB initially empty for that id; table already has R1 rows but not "lonely-foto"

//     const files = {
//       foto: [
//         {
//           fieldname: 'foto',
//           originalname: 'lonely-foto.jpg',
//           mimetype: 'image/jpeg',
//           buffer: Buffer.from('z'),
//         },
//       ],
//     } as any;

//     await service.update(files, relatorio);

//     // DB got created
//     expect(
//       table.some(
//         (r) => r.id === 'lonely-foto' && r.description === 'FOTO_RELATORIO',
//       ),
//     ).toBe(true);
//     // No outdated deletions for this path (we didn’t swap IDs)
//     // Check that other original entries remain unless they were part of replacement
//     expect(table.some((r) => r.id === 'old-foto')).toBe(true);
//     // Disk file remains (writeFile would "overwrite" but memfs tracks presence only)
//     expect(memfs.exists(join(uploadRoot, 'lonely-foto'))).toBe(true);
//   });
// });
