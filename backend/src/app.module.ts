import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './infraestructure/config/env.schema';
import { typeOrmAsyncConfig } from './infraestructure/database/typeorm.config';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { OutingsModule } from './modules/outings/outings.module';
import { McpModule } from './modules/mcp/mcp.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    ExpensesModule,
    OutingsModule,
    McpModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
