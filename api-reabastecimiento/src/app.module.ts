import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ReplenishmentModule } from './replenishment/replenishment.module';

@Module({
  imports: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mssql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '1433', 10) || 1433,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      options: {
        encrypt: false, // Cambiar a true si el server de BD lo requiere
        trustServerCertificate: true,
      },
      autoLoadEntities: true,
      synchronize: false, // IMPORTANTE: Siempre false para evitar que TypeORM altere las tablas de BD
    }),
    ReplenishmentModule,
  ],
})
export class AppModule {}
