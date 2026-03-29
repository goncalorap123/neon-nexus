import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TradingService } from './trading.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Controller('api/trading')
@UseGuards(ApiKeyGuard)
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Get('offers')
  async getOffers() {
    const offers = await this.tradingService.getActiveOffers();
    return { success: true, data: offers };
  }

  @Post('create-offer')
  async createOffer(
    @Body() body: { playerId: string; resourceType: number; quantity: string; pricePerUnit: string },
  ) {
    const result = await this.tradingService.createOffer(
      body.playerId,
      body.resourceType,
      body.quantity,
      body.pricePerUnit,
    );
    return { success: true, data: result };
  }

  @Post('execute')
  async executeTrade(
    @Body() body: { playerId: string; offerId: number; quantity: string },
  ) {
    const result = await this.tradingService.executeTrade(
      body.playerId,
      body.offerId,
      body.quantity,
    );
    return { success: true, data: result };
  }
}
