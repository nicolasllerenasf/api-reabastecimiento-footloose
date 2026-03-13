import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tb_pedidos_logistica_inversa_det')
export class PedidoDetalle {
  @PrimaryGeneratedColumn({ name: 'NroPedidoDetalle' })
  nroPedidoDetalle: number;

  @Column({ name: 'NroPedido' })
  nroPedido: number;

  @Column({ name: 'TdaOrigen', type: 'varchar', length: 50, nullable: true })
  tdaOrigen: string;

  @Column({ name: 'TdaDestino', type: 'varchar', length: 50, nullable: true })
  tdaDestino: string;

  @Column({ name: 'SKU', type: 'varchar', length: 50, nullable: true })
  sku: string;

  @Column({ name: 'Qrequerida', type: 'int', nullable: true })
  qrequerida: number;

  @Column({ name: 'QStockTdaOrigen', type: 'int', nullable: true })
  qStockTdaOrigen: number;

  @Column({ name: 'Motivo', type: 'varchar', length: 200, nullable: true })
  motivo: string;

  @Column({
    name: 'TipoLogistica',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tipoLogistica: string;
}
