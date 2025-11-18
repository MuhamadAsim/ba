
import express from "express";
import {getEvents} from '../controllers/eventController.js'
import { authenticateCustomer } from "../middlewares/authCustomerMiddleware.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";


const router = express.Router();



router.get("/for-customer",authenticateCustomer, getEvents);
router.get("/for-shop",authenticateShop, getEvents);



export default router;

