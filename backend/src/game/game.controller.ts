import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Controller('api/game')
@UseGuards(ApiKeyGuard)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('state/:playerId')
  async getGameState(@Param('playerId') playerId: string) {
    const state = await this.gameService.getGameState(playerId);
    if (!state) {
      return { success: false, error: 'Player not found' };
    }
    return { success: true, data: state };
  }

  @Post('random-event')
  async triggerRandomEvent(@Body() body: { playerId: string; eventType: number }) {
    const result = await this.gameService.triggerRandomEvent(body.playerId, body.eventType);
    return { success: true, data: result };
  }

  @Post('reveal-event')
  async revealEvent(@Body() body: { playerId: string; eventType: number }) {
    const result = await this.gameService.revealRandomEvent(body.playerId, body.eventType ?? 0);
    return { success: true, data: result };
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const leaderboard = await this.gameService.getLeaderboard();
    return { success: true, data: leaderboard };
  }
}
