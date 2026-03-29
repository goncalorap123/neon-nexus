import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentActionService } from '../src/database/agent-action.service';
import { AgentActionEntity } from '../src/database/entities/agent-action.entity';

describe('AgentActionService', () => {
  let service: AgentActionService;
  let mockRepo: any;

  beforeEach(async () => {
    mockRepo = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => ({ ...data, updatedAt: new Date() })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentActionService,
        { provide: getRepositoryToken(AgentActionEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AgentActionService>(AgentActionService);
  });

  describe('updateAction', () => {
    it('should create new action entry if none exists', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.updateAction('p1', 'gathering_wood', 'Need more wood');

      expect(mockRepo.create).toHaveBeenCalledWith({ playerId: 'p1' });
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'p1',
          currentAction: 'gathering_wood',
          reasoning: 'Need more wood',
        }),
      );
    });

    it('should update existing action entry', async () => {
      const existing = {
        playerId: 'p1',
        currentAction: 'idle',
        reasoning: null,
        targetAgentId: null,
        targetResourceType: null,
      };
      mockRepo.findOneBy.mockResolvedValue(existing);

      await service.updateAction('p1', 'trading_with_p2', 'Buying steel', 'p2', 1);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAction: 'trading_with_p2',
          reasoning: 'Buying steel',
          targetAgentId: 'p2',
          targetResourceType: 1,
        }),
      );
    });

    it('should handle missing optional params', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      await service.updateAction('p1', 'idle');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currentAction: 'idle',
          reasoning: null,
          targetAgentId: null,
          targetResourceType: null,
        }),
      );
    });
  });

  describe('getAction', () => {
    it('should return action for existing player', async () => {
      const action = { playerId: 'p1', currentAction: 'gathering_wood' };
      mockRepo.findOneBy.mockResolvedValue(action);

      const result = await service.getAction('p1');
      expect(result).toEqual(action);
    });

    it('should return null for unknown player', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.getAction('unknown');
      expect(result).toBeNull();
    });
  });

  describe('getAllActions', () => {
    it('should return all actions', async () => {
      const actions = [
        { playerId: 'p1', currentAction: 'idle' },
        { playerId: 'p2', currentAction: 'gathering_wood' },
      ];
      mockRepo.find.mockResolvedValue(actions);

      const result = await service.getAllActions();
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no actions', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getAllActions();
      expect(result).toHaveLength(0);
    });
  });
});
