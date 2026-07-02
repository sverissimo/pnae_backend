import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Res,
  Delete,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
      const normalizedError = this.normalizeError(error);
      this.logger.error(
        'AtendimentoController:20 ~ create:' + normalizedError.message,
        normalizedError.stack,
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
      const normalizedError = this.normalizeError(error);
      this.logger.error(
        'AtendimentoController:97 ~ getReplacedAtendimentos :' +
          normalizedError.message,
        normalizedError.stack,
      );
    }
  }

  @Get('/com-relatorio-manual')
  async listAtendimentosComRelatorioManual(
    @Query('pageSize') pageSize?: string,
    @Query('cursor') cursor?: string,
    @Req() req?: Request,
  ) {
    try {
      const parsedPageSize = this.parsePageSize(pageSize);
      return await this.atendimentoService.listAtendimentosComRelatorioManual({
        pageSize: parsedPageSize,
        cursor: cursor || undefined,
        ...this.getRelatorioManualScope(req),
      });
    } catch (error) {
      this.errorHandler(
        error,
        'AtendimentoController.listAtendimentosComRelatorioManual',
      );
    }
  }

  // Web-only. Static path declared above `@Get(':id')` so it isn't shadowed.
  // Streams the decoded file with a sniffed Content-Type. See
  // docs/mobile-endpoint-contract.md.
  @Get('/getArquivos')
  async getArquivo(
    @Query('atendimentoId') atendimentoId: string,
    @Query('fileType') fileType: string,
    @Res() res: Response,
  ) {
    try {
      if (!atendimentoId) {
        throw new BadRequestException('atendimentoId é obrigatório.');
      }
      if (fileType !== 'foto' && fileType !== 'relatorio') {
        throw new BadRequestException(
          "fileType deve ser 'foto' ou 'relatorio'.",
        );
      }

      const { buffer, contentType } = await this.atendimentoService.getArquivos(
        {
          atendimentoId,

          fileType,
        },
      );

      res.setHeader('Content-Type', contentType);
      res.send(buffer);
    } catch (error) {
      this.errorHandler(error, 'AtendimentoController.getArquivo');
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

  private parsePageSize(value?: string) {
    if (value === undefined || value === '') return 200;

    const pageSize = Number(value);
    if (!Number.isFinite(pageSize)) {
      throw new BadRequestException('pageSize deve ser um número.');
    }

    return Math.min(1000, Math.max(1, Math.trunc(pageSize)));
  }

  private getRelatorioManualScope(req?: Request) {
    const user = req?.user;
    if (!user) {
      throw new ForbiddenException('É necessária autenticação de usuário.');
    }

    if (user.isAdmin() || user.isDeveloper()) return {};
    if (user.isCoordenadorRegional()) {
      return {
        id_usuario: user.id_usuario,
        id_reg_empresa: user.id_reg_empresa ?? null,
      };
    }
    if (user.isStaff()) return { id_usuario: user.id_usuario };

    throw new ForbiddenException(
      'Usuário sem permissão para listar relatórios.',
    );
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

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
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
