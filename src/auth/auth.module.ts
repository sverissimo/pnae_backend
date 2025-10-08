import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsuarioController } from 'src/modules/usuario/usuario.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key', // put in env in prod
      signOptions: { expiresIn: '2h' }, // token TTL
    }),
  ],
  providers: [UsuarioController],
})
export class AuthModule {}
