const request = require('request');
const asyncHandler = require('express-async-handler');
const _ = require('underscore');

let index = 10;

module.exports = async function (context, myTimer) {
    var timeStamp = new Date().toISOString();
    
    if(myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }
    await fullAutomation(context);
    context.log('JavaScript timer trigger function ran!', timeStamp);   
};

const fullAutomation = asyncHandler(async(context) => {
	try {
		let data = await gatherCustomerData(context);
		await parseAndPublishData(context, data);
	} catch (error) {
		context.error(`encountered error: ${JSON.stringify(error)}`);
	}
})

const gatherCustomerData = (context) => {
	let epochTime = (new Date).getTime();
	return new Promise(function(resolve, reject) {
		request({
			method: 'POST',
			url: "https://kayplumbingservices.0.razorsync.com/ApiService.svc/Customer/List",
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

const parseAndPublishData = (context, customer_data) => {
	_.each(customer_data, asyncHandler(async(customer) => {
		if (customer.Contacts.length > 1) { context.log(`\ncustomer with multiple contacts ${JSON.stringify(customer)}\n`); }
		try {
			if (customer && customer.Contacts) {
				let contact = customer.Contacts[customer.Contacts.length - 1];
				await publishData(context, {name: `${contact.FirstName} ${contact.LastName}`, emailId: contact.Email, phone: contact.Phone, smsEnabled: (contact.NotifyViaSms ? 1 : 0), employees: []});
			}
		} catch (error) {
			context.error(`encountered error publishing to BirdEye: ${JSON.stringify(error)}`);
		}
	}));
}

const publishData = (context, customer) => {
	
	// TEMP overwrite phone number & email for test
	customer.emailId = `bri+${index}@pensivesecurity.io`;
	customer.phone = `703-419-05${index}`;

	index ++;

	context.log(`should now push customer: ${JSON.stringify(customer)}`);

	return new Promise(function(resolve, reject) {
		// resolve(true);
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

//fullAutomation(console);