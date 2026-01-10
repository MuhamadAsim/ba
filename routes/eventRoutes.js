
import express from "express";
import {getEvents, getShopEvents} from '../controllers/eventController.js'
import { authenticateCustomer } from "../middlewares/authCustomerMiddleware.js";
import { authenticateShop } from "../middlewares/authShopMiddleware.js";


const router = express.Router();



router.get("/",authenticateCustomer, getEvents);
router.get("/shops",authenticateShop, getShopEvents);



export default router;