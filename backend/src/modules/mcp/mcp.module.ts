import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { OutingsModule } from '../outings/outings.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [ExpensesModule, OutingsModule],
  controllers: [McpController],
})
export class McpModule {}
