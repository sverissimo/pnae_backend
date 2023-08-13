import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
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

  @Get()
  findAll() {
    return this.produtorService.findAll();
  }

  @Get(':cpf')
  async findOne(@Param('cpf') cpfProdutor: string) {
    try {
      const produtor = await this.produtorService.findOne(cpfProdutor);
      return produtor;
    } catch (error) {
      console.log('🚀file: produtor.controller.ts:26 ~ ProdutorController error:', error);
      return error;
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
