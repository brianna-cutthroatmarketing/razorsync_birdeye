'use strict'

const request = require('request');
const asyncHandler = require('express-async-handler');
const _ = require('underscore');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

let razorsync_headers = {
	"Token": process.env.RAZORSYNC_TOKEN,
	"Host": `${process.env.RAZORSYNC_HOST}.0.razorsync.com`,
	"ServerName": process.env.RAZORSYNC_HOST,
	"Content-Type": "application/json",
    "User-Agent": "node.js"
};

module.exports = async function (context, myTimer) {

    if(myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }

    await fullAutomation200Plus(context); 
};

const fullAutomation200Plus = asyncHandler(async(context) => {
	try {
		let work_orders = await gatherWorkOrders(context);
		let service_orders = {}, customer_orders = {};

		await Promise.all( work_orders.map( async order => {
			if (!service_orders[order.ServiceRequestId]) {
				service_orders[order.ServiceRequestId] = await gatherServiceOrdersByID(context, order.ServiceRequestId);
				if (!customer_orders[service_orders[order.ServiceRequestId].CustomerId]) { customer_orders[service_orders[order.ServiceRequestId].CustomerId] = []; }
			}

			let price = await gatherWorkOrderServiceItems(context, order);
			customer_orders[service_orders[order.ServiceRequestId].CustomerId].push(price);
		}));

		await Promise.all( _.keys(customer_orders).map( async customer_id => {
			let customer_spending = customer_orders[customer_id].reduce((a, b) => a + b, 0);
			if (customer_spending > 200) {
				let contact = await gatherSpecificCustomerData(context, customer_id);
				await publishData(context, {name: `${contact.FirstName} ${contact.LastName}`, emailId: contact.Email, phone: contact.Phone, smsEnabled: (contact.NotifyViaSms ? 1 : 0), employees: []});
			}
		}));
	} catch (error) {
		context.error(`encountered error: ${JSON.stringify(error)}`);
		sendErrorEmail(error);
	}
})

const sendErrorEmail = (error) => {
	const msg = {
		to: 'geoffrey@cutthroatmarketing.com',
		from: 'brianna@cutthroatmarketing.com',
		subject: `[ERROR] KayPlumbing script`,
		text: `Error details: ${JSON.stringify(error)}`
	};

	sgMail.send(msg);
}

const gatherWorkOrders = (context) => {
	let epochTime = (new Date).getTime();
	return new Promise(function(resolve, reject) {
		request({
			method: 'POST',
			url: `https://${process.env.RAZORSYNC_HOST}.0.razorsync.com/ApiService.svc/WorkOrder/List`,
			headers: razorsync_headers,
			body: {
				"FromModifiedDate":`/Date(${epochTime - (24 * 60 * 60 * 1000)})/`,
				"ToModifiedDate":`/Date(${epochTime})/`
			},
			json: true
		}, function(error, response) {
			if (error || (response && response.statusCode != 200)) {
				reject(error || response);
			} else {
				resolve(_.filter(response.body, function(order) { return order.ServiceRequestId && parseInt(order.EndDate.slice(6, 19)) > (epochTime - (24 * 60 * 60 * 1000)); }));
			}
		});
	});
}

const gatherServiceOrdersByID = (context, service_order_id) => {
	return new Promise(function(resolve, reject) {
		request({
			method: 'GET',
			url: `https://${process.env.RAZORSYNC_HOST}.0.razorsync.com/ApiService.svc/ServiceRequest/${service_order_id}`,
			headers: razorsync_headers,
			json: true
		}, function(error, response) {
			if (error || (response && response.statusCode != 200)) {
				reject(error || response);
			} else {
				resolve(response.body);
			}
		});
	});
}

const gatherWorkOrderServiceItems = (context, order) => {
	return new Promise(function(resolve, reject) {
		request({
			method: 'GET',
			url: `https://${process.env.RAZORSYNC_HOST}.0.razorsync.com/ApiService.svc/WorkOrderServiceItem/List/${order.Id}`,
			headers: razorsync_headers,
			json: true
		}, function(error, response) {
			if (error || (response && response.statusCode != 200)) {
				reject(error || response);
			} else {
				resolve(_.reduce(_.pluck(response.body, 'CalculatedPrice'), function(memo, num){ return memo + num; }, 0));
			}
		});
	});
}

const gatherSpecificCustomerData = (context, customer_id) => {
	return new Promise(function(resolve, reject) {
		request({
			method: 'GET',
			url: `https://${process.env.RAZORSYNC_HOST}.0.razorsync.com/ApiService.svc/Contact/List/${customer_id}`,
			headers: razorsync_headers,
			json: true
		}, function(error, response) {
			context.log(`res: ${JSON.stringify(response.body)}`);
			if (error || (response && response.statusCode != 200)) {
				reject(error || response);
			} else {
				resolve(response.body[response.body.length-1]);
			}
		});
	});
}

const publishData = (context, customer) => {

	if (process.env.NODE_ENV !== "production") {
		let random_index = Math.floor(Math.random() * 9000) + 1000;
		customer.emailId = `bri+${random_index}@pensivesecurity.io`;
		customer.phone = `703-419-${random_index}`;
	}

	context.log(`should now push customer: ${JSON.stringify(customer)}`);

	return new Promise(function(resolve, reject) {
		request({
			method: 'POST',
			url: "https://api.birdeye.com/resources/v1/customer/checkin",
			qs: {
				"bid": process.env.BIRDEYE_BID,
				"api_key": process.env.BIRDEYE_API_KEY
			},
			headers: {
				"Content-Type": "application/json",
		        "User-Agent": "node.js"
			},
			body: customer,
			json: true
		}, function(error, response) {
			if (error || (response && response.statusCode != 200)) {
				reject(error || response);
			} else {
				resolve();
			}
		});
	});

}