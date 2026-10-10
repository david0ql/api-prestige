import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TechnicalSheet } from '../catalog/entities/technical-sheet.entity';
import { ConsumptionStandard } from '../masters/entities/consumption-standard.entity';
import { ConsumptionReport } from './entities/consumption-report.entity';
import { DigitalAcceptance } from './entities/digital-acceptance.entity';
import { Discrepancy } from './entities/discrepancy.entity';
import { DispatchLine } from './entities/dispatch-line.entity';
import { FinishedDeclaration } from './entities/finished-declaration.entity';
import { FinishedGood } from './entities/finished-good.entity';
import { LaborCost } from './entities/labor-cost.entity';
import { MaterialDispatch } from './entities/material-dispatch.entity';
import { MaterialRequest } from './entities/material-request.entity';
import { OrderDecision } from './entities/order-decision.entity';
import { OrderMaterialRequirement } from './entities/order-material-requirement.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ProductionOrder } from './entities/production-order.entity';
import { ProductionReceipt } from './entities/production-receipt.entity';
import { ProgressReport } from './entities/progress-report.entity';
import { PurityVerification } from './entities/purity-verification.entity';
import { QualityCheck } from './entities/quality-check.entity';
import { ReceiptLine } from './entities/receipt-line.entity';
import { StageCompletion } from './entities/stage-completion.entity';
import {
  DiscrepanciesController,
  DispatchController,
  FinishedGoodsController,
  LaborController,
  MaterialRequestsController,
  OrdersController,
  WorkshopPortalController,
} from './production.controller';
import { DispatchService } from './services/dispatch.service';
import { FinishedGoodsService } from './services/finished-goods.service';
import { OrderStateService } from './services/order-state.service';
import { OrdersService } from './services/orders.service';
import { ReceptionService } from './services/reception.service';
import { ReconciliationService } from './services/reconciliation.service';
import { WorkshopOpsService } from './services/workshop-ops.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionOrder,
      OrderMaterialRequirement,
      OrderStatusHistory,
      OrderDecision,
      MaterialDispatch,
      DispatchLine,
      DigitalAcceptance,
      ConsumptionReport,
      ProgressReport,
      StageCompletion,
      MaterialRequest,
      FinishedDeclaration,
      LaborCost,
      ProductionReceipt,
      ReceiptLine,
      QualityCheck,
      PurityVerification,
      Discrepancy,
      FinishedGood,
      ConsumptionStandard,
      TechnicalSheet,
    ]),
  ],
  controllers: [
    OrdersController,
    DispatchController,
    WorkshopPortalController,
    MaterialRequestsController,
    DiscrepanciesController,
    LaborController,
    FinishedGoodsController,
  ],
  providers: [
    OrderStateService,
    OrdersService,
    DispatchService,
    WorkshopOpsService,
    ReceptionService,
    ReconciliationService,
    FinishedGoodsService,
  ],
  exports: [OrdersService, FinishedGoodsService, TypeOrmModule],
})
export class ProductionModule {}
