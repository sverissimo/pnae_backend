import { Injectable } from '@nestjs/common';
import { CreateVisitaDto } from './dto/create-visita.dto';
import { UpdateVisitaDto } from './dto/update-visita.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class VisitasService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createVisitaDto: CreateVisitaDto): Promise<number> {
    const visita = await this.prismaService.visita.create({
      data: createVisitaDto,
    });

    return visita.id;
  }

  async findAll() {
    const visitas = await this.prismaService.visita.findMany({
      include: {
        files: true,
      },
    });
    return visitas;
  }

  async findOne(id: number) {
    const visitas = await this.prismaService.visita.findMany({
      where: { id: id },
      include: { files: true },
    });
    return visitas;
  }

  async update(id: number, updateVisitaDto: Omit<UpdateVisitaDto, 'fotos'>) {
    const updated = await this.prismaService.visita.update({
      where: { id },
      data: { ...updateVisitaDto },
    });
    return updated;
  }

  async remove(id: number) {
    await this.prismaService.visita.delete({ where: { id } });
    return 'Visita removed.';
  }
}
