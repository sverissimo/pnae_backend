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

@Controller('produtor')
export class ProdutorController {
  constructor(private readonly produtorService: ProdutorService) {}

  @Post()
  create(@Body() createProdutorDto: CreateProdutorDto) {
    return this.produtorService.create(createProdutorDto);
  }

  @Get('/all')
  findAll() {
    return this.produtorService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') produtorId: string) {
    try {
      const produtor = await this.produtorService.findOne(produtorId);
      return produtor;
    } catch (graphQLAPIError) {
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
    try {
      const produtor = await this.produtorService.findByCpf(cpfProdutor);
      return produtor;
    } catch (graphQLAPIError) {
      console.log(
        '🚀 - file: produtor.controller.ts:52 - ProdutorController - findByCpf - graphQLAPIError:',
        graphQLAPIError,
      );

      const { errors } = graphQLAPIError?.response;
      const error = errors && errors[0];
      if (error.extensions.code === 'NOT_FOUND') {
        throw new NotFoundException('Produtor não encontrado. Verifique o CPF informado.');
      }
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
