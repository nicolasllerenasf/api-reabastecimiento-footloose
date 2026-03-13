/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as xlsx from 'xlsx';

interface FilaExcel {
  tdaOrigen: string;
  tdaDestino: string;
  sku: string;
  cantidad: number;
  tipoLogistica: string;
  motivo: string;
}

function limpiarSku(raw: unknown): string {
  if (raw == null) return '';
  let sku =
    typeof raw === 'string' || typeof raw === 'number'
      ? String(raw).trim()
      : '';
  sku = sku.replace(/[\r\n\s]/g, '');
  // Clean numeric inputs
  if (sku.includes('.')) sku = sku.replace(/\.0+$/, '');
  return sku;
}

function escapeSql(val: string): string {
  return val.replace(/'/g, "''");
}

function buildInList(values: string[]): string {
  return values.map((v) => `'${escapeSql(v)}'`).join(',');
}

@Injectable()
export class ReplenishmentService {
  private readonly logger = new Logger(ReplenishmentService.name);

  constructor(private readonly dataSource: DataSource) {}

  async procesarCargaExcel(fileBuffer: Buffer, idPedido: number) {
    const workbook = xlsx.read(fileBuffer, {
      type: 'buffer',
      cellText: true,
      cellDates: true,
    });
    const sheet = workbook.Sheets['RQ'];

    if (!sheet) {
      throw new BadRequestException('El archivo no tiene la hoja "RQ".');
    }

    const rawData = xlsx.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
    });
    const dataRows = rawData.slice(8);

    const filasValidas: FilaExcel[] = [];
    const tiendasOrigenSet = new Set<string>();
    const skusSet = new Set<string>();

    for (const row of dataRows) {
      if (!row || row.length === 0) continue;

      const tdaOrigen = row[2]?.toString().trim() ?? '';
      const sku = limpiarSku(row[8]);
      const tdaDestino = row[9]?.toString().trim() ?? '';
      const cantidad = Math.round(parseFloat(row[10]) || 0);
      const tipoLogistica = row[16]?.toString().trim() ?? '';
      const motivo = row[17]?.toString().trim() ?? '';

      if (!tdaOrigen || !sku || cantidad <= 0) continue;

      tiendasOrigenSet.add(tdaOrigen);
      skusSet.add(sku);

      filasValidas.push({
        tdaOrigen,
        tdaDestino,
        sku,
        cantidad,
        tipoLogistica,
        motivo,
      });
    }

    if (filasValidas.length === 0) {
      throw new BadRequestException(
        'No se encontraron filas válidas para procesar (desde la fila 9).',
      );
    }

    const tiendasOrigen = Array.from(tiendasOrigenSet);
    const skus = Array.from(skusSet);

    const storesInList = buildInList(tiendasOrigen);

    const zonasResult: { tienda: string; zona: string }[] = await this
      .dataSource.query(`
      SELECT LTRIM(RTRIM(fox_nombre)) AS tienda,
             UPPER(LTRIM(RTRIM(zona))) AS zona
      FROM ALMACEN
      WHERE fox_nombre IN (${storesInList})
    `);

    const storeZonaMap = new Map<string, string>();
    for (const r of zonasResult) {
      storeZonaMap.set(r.tienda.trim(), r.zona.trim());
    }

    const configDiasResult: { zona: string; dias: number }[] = await this
      .dataSource.query(`
      SELECT UPPER(LTRIM(RTRIM(zona))) AS zona, MAX(config_fecha) AS dias
      FROM config_pedidos_logistica_inversa
      GROUP BY UPPER(LTRIM(RTRIM(zona)))
    `);

    const zonaDiasMap = new Map<string, number>();
    for (const r of configDiasResult) {
      zonaDiasMap.set(r.zona.trim(), Number(r.dias));
    }

    const stockMap = new Map<string, number>();
    const chunkSize = 500;

    for (let i = 0; i < skus.length; i += chunkSize) {
      const chunk = skus.slice(i, i + chunkSize);
      const skusInList = buildInList(chunk);

      const stockResult: { tienda: string; sku: string; stock: number }[] =
        await this.dataSource.query(`
        SELECT LTRIM(RTRIM(al.fox_nombre)) AS tienda,
               sk.sku AS sku,
               SUM(als.stock) AS stock
        FROM ALMACENPRODUCTOSTOCK als
        INNER JOIN ALMACEN al       ON al.n_almacenid = als.almacen
        INNER JOIN tb_prod_sku sk   ON sk.id_prod_sku = als.id_prod_sku
        WHERE al.fox_nombre IN (${storesInList})
          AND sk.sku IN (${skusInList})
        GROUP BY al.fox_nombre, sk.sku
      `);

      for (const r of stockResult) {
        const key = `${r.tienda.toUpperCase().trim()}|${r.sku.trim()}`;
        stockMap.set(key, Number(r.stock));
      }
    }

    let diasMax = 1;

    const registros = filasValidas.map((fila) => {
      const stockKey = `${fila.tdaOrigen.toUpperCase()}|${fila.sku}`;
      const stockActual = stockMap.get(stockKey) ?? 0;

      const zona = storeZonaMap.get(fila.tdaOrigen.trim()) ?? '';
      const diasZona =
        zona && zonaDiasMap.has(zona) ? zonaDiasMap.get(zona)! : 14;

      if (diasZona > diasMax) diasMax = diasZona;

      return {
        NroPedido: idPedido,
        TdaOrigen: fila.tdaOrigen,
        TdaDestino: fila.tdaDestino,
        SKU: fila.sku,
        Qrequerida: fila.cantidad,
        QStockTdaOrigen: stockActual,
        Motivo: fila.motivo,
        TipoLogistica: fila.tipoLogistica,
      };
    });

    await this.dataSource.transaction(async (txManager) => {
      const batchSize = 200;
      for (let i = 0; i < registros.length; i += batchSize) {
        const batch = registros.slice(i, i + batchSize);
        await txManager
          .createQueryBuilder()
          .insert()
          .into('tb_pedidos_logistica_inversa_det')
          .values(batch)
          .execute();
      }

      await txManager.query(`
        UPDATE tb_pedidos_logistica_inversa_cab
        SET FechaHasta = DATEADD(day, ${diasMax}, FechaDesde)
        WHERE NroPedido = ${idPedido}
      `);
    });

    this.logger.log(
      `Pedido ${idPedido} procesado. Registros: ${registros.length}. DiasMax cabecera: ${diasMax}`,
    );

    return {
      registrosProcesados: registros.length,
      diasCalculados: diasMax,
    };
  }
}
