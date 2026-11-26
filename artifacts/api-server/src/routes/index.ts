import { Router, type IRouter } from "express";
import healthRouter from "./health";
import inquiryRouter from "./inquiry";
import checkoutRouter from "./checkout";

const router: IRouter = Router();

router.use(healthRouter);
router.use(inquiryRouter);
router.use(checkoutRouter);

export default router;
