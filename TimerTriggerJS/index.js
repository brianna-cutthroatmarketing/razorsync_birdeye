const request = require('request');
const asyncHandler = require('express-async-handler');
const _ = require('underscore');
//const { forEach } = require('p-iteration');

let index = 10;

module.exports = async function (context, myTimer) {
    var timeStamp = new Date().toISOString();
    
    if(myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }
    await fullAutomation200Plus(context);
    context.log('JavaScript timer trigger function ran!', timeStamp);   
};

const fullAutomation200Plus = asyncHandler(async(context) => {
	try {
		let work_orders = _.filter(await gatherWorkOrders(context), function(order) { return order.ServiceRequestId; });
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
	}
})

const gatherWorkOrders = (context) => {
	let epochTime = (new Date).getTime();
	context.log(`epochTime: ${epochTime}`);
	return new Promise(function(resolve, reject) {
		request({
			method: 'POST',
			url: "https://kayplumbingservices.0.razorsync.com/ApiService.svc/WorkOrder/List",
			headers: {
				"Token": "5a442567-97ee-4652-8f8a-0269b53b6b1e",
				"Host": "kayplumbingservices.0.razorsync.com",
				"ServerName": "kayplumbingservices",
				"Content-Type": "application/json",
		        "User-Agent": "node.js"
			},
			body: {
				"FromModifiedDate":`/Date(${epochTime - (24 * 60 * 60 * 1000)})/`,
				"ToModifiedDate":`/Date(${epochTime})/`
			},
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

const gatherServiceOrdersByID = (context, service_order_id) => {
	return new Promise(function(resolve, reject) {
		request({
			method: 'GET',
			url: `https://kayplumbingservices.0.razorsync.com/ApiService.svc/ServiceRequest/${service_order_id}`,
			headers: {
				"Token": "5a442567-97ee-4652-8f8a-0269b53b6b1e",
				"Host": "kayplumbingservices.0.razorsync.com",
				"ServerName": "kayplumbingservices",
				"Content-Type": "application/json",
		        "User-Agent": "node.js"
			},
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
			url: `https://kayplumbingservices.0.razorsync.com/ApiService.svc/WorkOrderServiceItem/List/${order.Id}`,
			headers: {
				"Token": "5a442567-97ee-4652-8f8a-0269b53b6b1e",
				"Host": "kayplumbingservices.0.razorsync.com",
				"ServerName": "kayplumbingservices",
				"Content-Type": "application/json",
		        "User-Agent": "node.js"
			},
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
			url: `https://kayplumbingservices.0.razorsync.com/ApiService.svc/Contact/List/${customer_id}`,
			headers: {
				"Token": "5a442567-97ee-4652-8f8a-0269b53b6b1e",
				"Host": "kayplumbingservices.0.razorsync.com",
				"ServerName": "kayplumbingservices",
				"Content-Type": "application/json",
		        "User-Agent": "node.js"
			},
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
	
	// TEMP overwrite phone number & email for test
	customer.emailId = `bri+${index}@pensivesecurity.io`;
	customer.phone = `703-419-05${index}`;

	index ++;

	context.log(`should now push customer: ${JSON.stringify(customer)}`);

	return new Promise(function(resolve, reject) {
		request({
			method: 'POST',
			url: "https://api.birdeye.com/resources/v1/customer/checkin",
			qs: {
				"bid": "153737826777714",
				"api_key": "YakceqCnXhjfUqSSujYnNjMMyq4gro89"
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
fullAutomation200Plus(console);