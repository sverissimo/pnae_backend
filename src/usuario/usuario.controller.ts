import { Controller, Get, Param } from '@nestjs/common';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('usuario')
export class UsuarioController {
  constructor(private readonly api: UsuarioGraphQLAPI) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const usuario = await this.api.getUsuario(id);
      return usuario;
    } catch (error) {}
  }
}
