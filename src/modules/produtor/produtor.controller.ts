import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  NotFoundException,
  InternalServerErrorException,
  Query,
} from '@nestjs/common';
import { ProdutorService } from './produtor.service';
import { CreateProdutorDto } from './dto/create-produtor.dto';
import { UpdateProdutorDto } from './dto/update-produtor.dto';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Controller('produtor')
export class ProdutorController {
  constructor(
    private readonly produtorService: ProdutorService,
    private readonly logger: WinstonLoggerService,
  ) {}

  @Post()
  create(@Body() createProdutorDto: CreateProdutorDto) {
    return this.produtorService.create(createProdutorDto);
  }

  @Get('/all')
  findAll() {
    return this.produtorService.findAll();
  }

  @Get('/unidade-empresa/:id')
  async getUnidadeEmpresa(@Param('id') produtorId: string) {
    try {
      return await this.produtorService.getUnidadeEmpresa(produtorId);
    } catch (error) {
      this.logger.error(
        '🚀 ~ file:  ProdutorController 41 - findOne - graphQLAPIError:' + error.message,
        error.trace,
      );
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') produtorId: string) {
    try {
      const produtor = await this.produtorService.findOne(produtorId);
      return produtor;
    } catch (graphQLAPIError) {
      this.logger.error(
        '🚀 ~ file:  ProdutorController 57 - findOne - graphQLAPIError:' + graphQLAPIError.message,
        graphQLAPIError.trace,
      );
      const { errors } = graphQLAPIError.response;
      const error = errors[0];
      if (error.extensions.code === 'NOT_FOUND') {
        throw new NotFoundException('Produtor não encontrado. Verifique o CPF informado.');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get()
  async findByCpf(@Query('cpfProdutor') cpfProdutor: string) {
    console.log('🚀 - ProdutorController - findByCpf - cpfProdutor:', cpfProdutor);

    try {
      const produtor = await this.produtorService.findByCpf(cpfProdutor);
      return produtor;
    } catch (graphQLAPIError) {
      const { errors } = graphQLAPIError?.response;
      const error = errors && errors[0];
      this.logger.error('ProdutorController 77 - ' + error.message, error.trace);
      if (error.extensions.code === 'NOT_FOUND') {
        throw new NotFoundException('Produtor não encontrado. Verifique o CPF informado.');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post('/findMany')
  async findMany(@Body() ids: string[]) {
    try {
      return await this.produtorService.findManyById(ids);
    } catch (error) {
      this.logger.error('ProdutorController 92 - ' + error.message, error.trace);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProdutorDto: UpdateProdutorDto) {
    return this.produtorService.update(+id, updateProdutorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.produtorService.remove(+id);
  }
}
