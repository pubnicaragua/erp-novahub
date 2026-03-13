import { Test, TestingModule } from '@nestjs/testing';
import { FinancialsController } from './financials.controller';

describe('FinancialsController', () => {
  let controller: FinancialsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialsController],
    }).compile();

    controller = module.get<FinancialsController>(FinancialsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
