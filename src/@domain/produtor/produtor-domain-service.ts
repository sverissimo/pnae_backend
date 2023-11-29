// import { ProdutorSyncInput } from 'src/modules/@sync/dto/produtor-sync-input.dto';
// import { Produtor } from './produtor';
// import { compareClientAndServerDates } from 'src/modules/@sync/utils/compareClientAndServerDates';

// export class ProdutorDomainService {
//   static comparePerfis(produtorSyncInput: ProdutorSyncInput, produtor: Produtor) {
//     const { produtorId, updatedAt } = produtorSyncInput;

//     const clientUpdatedAt = updatedAt && new Date(updatedAt);
//     const serverUpdatedAt = produtor.dt_update_record && new Date(produtor.dt_update_record);

//     const updateStatus = compareClientAndServerDates(clientUpdatedAt, serverUpdatedAt);
//     return updateStatus;
//   }
// }
