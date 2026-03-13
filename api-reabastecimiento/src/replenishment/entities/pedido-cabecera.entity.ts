import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tb_pedidos_logistica_inversa_cab')
export class PedidoCabecera {
  @PrimaryGeneratedColumn({ name: 'NroPedido' })
  nroPedido: number;

  @Column({ name: 'FechaPedido', type: 'date', nullable: true })
  fechaPedido: Date;

  @Column({ name: 'HoraPedido', type: 'varchar', length: 10, nullable: true })
  horaPedido: string;

  @Column({ name: 'FechaDesde', type: 'date', nullable: true })
  fechaDesde: Date;

  @Column({ name: 'FechaHasta', type: 'date', nullable: true })
  fechaHasta: Date;

  @Column({ name: 'Usuario', type: 'varchar', length: 50, nullable: true })
  usuario: string;

  @Column({ name: 'Estado', type: 'varchar', length: 20, nullable: true })
  estado: string;
}
