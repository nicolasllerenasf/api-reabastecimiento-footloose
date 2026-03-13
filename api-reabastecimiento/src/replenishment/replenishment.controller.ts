/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReplenishmentService } from './replenishment.service';

@Controller('api/replenishment')
export class ReplenishmentController {
  constructor(private readonly replenishmentService: ReplenishmentService) {}

  @Post('upload/:idPedido')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Param('idPedido', ParseIntPipe) idPedido: number,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo Excel no adjuntado.');
    }

    const result = await this.replenishmentService.procesarCargaExcel(
      file.buffer,
      idPedido,
    );

    return {
      success: true,
      message: 'Detalle de pedido cargado correctamente',
      ...result,
    };
  }
}
