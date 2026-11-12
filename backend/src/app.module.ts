import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './infraestructure/config/env.schema';
import { typeOrmAsyncConfig } from './infraestructure/database/typeorm.config';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    ExpensesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
