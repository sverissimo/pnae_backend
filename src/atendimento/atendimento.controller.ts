import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';

@Controller('atendimento')
export class AtendimentoController {
  constructor(private readonly atendimentoService: AtendimentoService) {}

  @Post()
  async create(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    const id = await this.atendimentoService.create(createAtendimentoDto);
    return id;
  }

  @Get()
  async findAll() {
    console.log('*** fetching... !');
    return await this.atendimentoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.atendimentoService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAtendimentoDto: UpdateAtendimentoDto) {
    return this.atendimentoService.update(+id, updateAtendimentoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.atendimentoService.remove(+id);
  }
}
