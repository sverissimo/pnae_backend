import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  ForbiddenException,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { AtendimentoService } from './atendimento.service';
import { CreateAtendimentoInputDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoInputDto } from './dto/update-atendimento.dto';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';

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

  // Web-only validation routes (mobile never calls these). Keyed on atendimentoId
  // alone — the atendimento is the external-DB PK, so it resolves its own auth
  // scope without a relatório. Two-segment paths, declared above `@Patch(':id')`
  // so they aren't shadowed.
  @Patch(':atendimentoId/aprovar')
  async aprovarAtendimento(
    @Param('atendimentoId') atendimentoId: string,
    @Req() req: Request,
  ) {
    try {
      await this.assertCanValidarAtendimento(atendimentoId, req);
      await this.atendimentoService.aprovarAtendimento(atendimentoId);
    } catch (error) {
      this.errorHandler(error, 'AtendimentoController.aprovarAtendimento');
    }
  }

  @Patch(':atendimentoId/pendencia')
  async criarPendenciaAtendimento(
    @Param('atendimentoId') atendimentoId: string,
    @Req() req: Request,
  ) {
    try {
      await this.assertCanValidarAtendimento(atendimentoId, req);
      await this.atendimentoService.criarPendenciaAtendimento(atendimentoId);
    } catch (error) {
      this.errorHandler(
        error,
        'AtendimentoController.criarPendenciaAtendimento',
      );
    }
  }

  // Admin-only SEI approval. The coordenador-validation precondition is enforced
  // upstream in the gateway and surfaces here as a 400 with its message preserved.
  @Patch(':atendimentoId/aprovar-sei')
  async aprovarSei(
    @Param('atendimentoId') atendimentoId: string,
    @Req() req: Request,
  ) {
    try {
      await this.assertCanAprovarSei(atendimentoId, req);
      await this.atendimentoService.aprovarSei(atendimentoId);
    } catch (error) {
      this.errorHandler(error, 'AtendimentoController.aprovarSei');
    }
  }

  @Patch(':atendimentoId/remover-aprovacao-sei')
  async removerAprovacaoSei(
    @Param('atendimentoId') atendimentoId: string,
    @Req() req: Request,
  ) {
    try {
      await this.assertCanAprovarSei(atendimentoId, req);
      await this.atendimentoService.removerAprovacaoSei(atendimentoId);
    } catch (error) {
      this.errorHandler(error, 'AtendimentoController.removerAprovacaoSei');
    }
  }

  // Capability (role) then visibility (Usuario.hasAccessTo on the normalized
  // scope). Capability fail → 403 (wrong role); visibility fail → 404 (don't
  // confirm existence of an out-of-scope atendimento).
  private async assertCanValidarAtendimento(
    atendimentoId: string,
    req: Request,
  ) {
    const user = req.user;
    if (!user || (!user.isCoordenadorRegional() && !user.isAdmin())) {
      throw new ForbiddenException(
        'Apenas coordenadores regionais podem validar atendimentos.',
      );
    }

    const scope =
      await this.atendimentoService.getAtendimentoAuthScope(atendimentoId);
    if (!user.hasAccessTo(scope)) {
      throw new NotFoundException('Atendimento não encontrado.');
    }
  }

  // SEI approval is admin-only — same capability → visibility shape as
  // assertCanValidarAtendimento, stricter gate. Visibility is a no-op for admins
  // today; kept for model symmetry and a future scoped DETEC perfil.
  private async assertCanAprovarSei(atendimentoId: string, req: Request) {
    const user = req.user;
    if (!user?.isAdmin()) {
      throw new ForbiddenException(
        'Apenas administradores podem aprovar relatórios no SEI.',
      );
    }

    const scope =
      await this.atendimentoService.getAtendimentoAuthScope(atendimentoId);
    if (!user.hasAccessTo(scope)) {
      throw new NotFoundException('Atendimento não encontrado.');
    }
  }

  private errorHandler(error: any, caller: string) {
    this.logger.error(`Erro em ${caller}: ${error?.message}`, {
      stack: error?.stack,
      error,
    });

    if (error instanceof HttpException) throw error;
    const status = Number(error?.status ?? error?.statusCode);
    if (!Number.isNaN(status)) {
      throw new HttpException(error?.message ?? String(error), status);
    }
    throw new InternalServerErrorException(
      error?.message ||
        String(error) ||
        'Erro interno ao processar a requisição.',
    );
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
