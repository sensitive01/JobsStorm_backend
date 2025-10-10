const express = require("express");
const router = express.Router();
const planController = require('../../controller/employerController/employerplanController');
const adminfunction = require('../../controller/adminController/adminfunction');
const banercontroller = require('../../controller/adminController/eventbannerController');
const employeebanner = require('../../controller/adminController/employeebanner');
const { bannerImageStorage } = require("../../config/cloudinary"); 
const multer = require("multer");

// Use the Cloudinary storage instead of memoryStorage
const upload = multer({ storage: bannerImageStorage });
const adminlogincontroller = require('../../controller/adminController/adminlogin');
const mainadminRoute = express.Router();

mainadminRoute.get('/fetchplanbyemp/:employerId', planController.getPlansByEmployer);
mainadminRoute.post('/activateplans', planController.activateSubscription);
mainadminRoute.get('/getallplans', planController.getAllPlans);
mainadminRoute.get('/getplans:id', planController.getPlanById);
mainadminRoute.post('/createplan',  planController.createPlan);
mainadminRoute.put('/updateplan:id',  planController.updatePlan);
mainadminRoute.delete('/deleteplan:id', planController.deletePlan);
mainadminRoute.put('/approveemployer/:id',  adminfunction.approveSingleEmployer);
mainadminRoute.put('/approve-all',  adminfunction.approveAllEmployers);
mainadminRoute.put('/approveemployee/:id',  adminfunction.approveSingleEmployee);
mainadminRoute.put('/approveallemployee',  adminfunction.approveAllEmployee);
mainadminRoute.put('/approveemployeradmin/:id',  adminfunction.approveSingleEmployeradmin);
mainadminRoute.put('/approveallemployeradmin',  adminfunction.approveAllEmployeradmin);
mainadminRoute.put('/updateapprovejobs/:id',  adminfunction.updateJobStatus);
mainadminRoute.put('/updateallapprved',  adminfunction.updateapproved);
mainadminRoute.put('/updateblockstatus/:id',  adminfunction.blockunblockemployer);
mainadminRoute.put('/updateblockstatusemploye/:id',  adminfunction.blockunblockemployee);
mainadminRoute.put('/updateblockstatusemployeradmin/:id',  adminfunction.blockunblockemployeradmin);
mainadminRoute.put('/updateunlick',  adminfunction.updateallblock);
mainadminRoute.get('/getallemployers', adminfunction.getAllEmployers);

mainadminRoute.get('/getsubscribedemployers', adminfunction.getSubscribedEmployers);
mainadminRoute.post("/createeventbanner", upload.fields([{ name: 'image', maxCount: 1 }]), banercontroller.createBanner);
mainadminRoute.get('/fetchalleventbanner', banercontroller.getBanners);

mainadminRoute.post('/signup', adminlogincontroller.adminSignup);
mainadminRoute.get('/fetchallemployeradmin', adminlogincontroller.getAllEmployerAdmins);
// Login route
mainadminRoute.post('/adminlogin', adminlogincontroller.adminLogin);
mainadminRoute.post("/createemployeebanner", upload.fields([{ name: 'image', maxCount: 1 }]), employeebanner.employeecreatebanner);
mainadminRoute.get('/fetchemployeebanner', employeebanner.getemployeeBanners);

// employeradminRoute.get();
module.exports = mainadminRoute;