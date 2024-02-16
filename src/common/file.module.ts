import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProdutorService } from 'src/modules/produtor/produtor.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';

@Module({
  controllers: [FileController],
  providers: [FileService, PrismaService, ProdutorService, ProdutorGraphQLAPI],
  exports: [FileService],
})
export class FileModule {}
