import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuarioModel } from 'src/@domain/usuario/usuario-model';
import { UsuarioService } from './usuario.service';
import { Response } from 'express';

@Controller('usuario')
export class UsuarioController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usuarioService: UsuarioService,
  ) {}

  @Post('/login')
  async login(
    @Body() user: Partial<UsuarioModel & { password: string }>,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const usuario = await this.usuarioService.login(user);
      const token = this.jwtService.sign(usuario);

      res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      });
      return usuario;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('🚀 LoginError: ', error?.message || JSON.stringify(error));
      throw new InternalServerErrorException('Erro ao processar login.');
    }
  }

  @Get('/logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    try {
      res.clearCookie('auth_token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 4 * 60 * 60 * 1000, // 4 hours
      });

      return { message: 'Logout realizado com sucesso.' };
    } catch (error) {
      console.error(
        '🚀 LogoutError: ',
        error?.message || JSON.stringify(error),
      );
      throw new InternalServerErrorException('Erro ao processar logout.');
    }
  }

  // New: handles GET /usuario?matricula=...
  @Get()
  findByQuery(@Query('matricula') matricula?: string) {
    return this.usuarioService.find(undefined, matricula);
  }

  // Adjusted: handles GET /usuario/:id
  @Get(':id')
  findById(@Param('id') id?: string) {
    return this.usuarioService.find(id);
  }
}
