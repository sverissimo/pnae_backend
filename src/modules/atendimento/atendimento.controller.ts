import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Controller('atendimento')
export class AtendimentoController {
  constructor(
    private readonly atendimentoService: AtendimentoService,
    private readonly logger: WinstonLoggerService,
  ) {}

  @Post()
  async create(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    try {
      const id = await this.atendimentoService.create(createAtendimentoDto);
      return id;
    } catch (error) {
      this.logger.error(
        'AtendimentoController:20 ~ create:' + error.message,
        error.trace,
      );
      throw error;
    }
  }

  @Get()
  async findAll() {
    return await this.atendimentoService.findAll();
  }

  @Get('getAtendimentosWithoutDataSEI')
  async getAtendimentosWithoutDataSEI() {
    try {
      return await this.atendimentoService.getAtendimentosWithoutDataSEI();
    } catch (error) {
      this.logger.error(
        'AtendimentoController:47 ~ getAtendimentosWithoutSEI:' + error.message,
        error.trace,
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.atendimentoService.findOne(id);
    } catch (error) {
      console.log('🚀 - AtendimentoController - findOne - (error:', error);
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAtendimentoDto: UpdateAtendimentoDto,
  ) {
    return this.atendimentoService.update(id, updateAtendimentoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.atendimentoService.logicRemove(id);
  }
}
