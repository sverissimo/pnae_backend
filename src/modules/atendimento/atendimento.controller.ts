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
import { CreateAtendimentoInputDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoInputDto } from './dto/update-atendimento.dto';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Controller('atendimento')
export class AtendimentoController {
  constructor(
    private readonly atendimentoService: AtendimentoService,
    private readonly logger: WinstonLoggerService,
  ) {}

  @Post()
  async create(@Body() CreateAtendimentoInputDto: CreateAtendimentoInputDto) {
    try {
      const id = await this.atendimentoService.create(
        CreateAtendimentoInputDto,
      );
      return id;
    } catch (error) {
      this.logger.error(
        'AtendimentoController:20 ~ create:' + error.message,
        error.trace,
      );
      throw error;
    }
  }

  @Post('/findMany')
  async findMany(@Body() ids: string[]) {
    return await this.atendimentoService.findMany(ids);
  }

  @Get('getTemasAtendimento')
  getTemasAtendimento() {
    try {
      return this.atendimentoService.getTemasAtendimento();
    } catch (error) {
      this.logger.error(
        'AtendimentoController:69 ~ getTemasAtendimento :' + error.message,
        error.trace,
      );
    }
  }

  @Get('/getReplacedAtendimentos')
  async getReplacedAtendimentos() {
    try {
      return await this.atendimentoService.getReplacedAtendimentos();
    } catch (error) {
      this.logger.error(
        'AtendimentoController:97 ~ getReplacedAtendimentos :' + error.message,
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
    @Body() UpdateAtendimentoInputDto: UpdateAtendimentoInputDto,
  ) {
    return this.atendimentoService.update(id, UpdateAtendimentoInputDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.atendimentoService.logicRemove(id);
  }
}
