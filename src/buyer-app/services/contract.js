const os = require('os'); 
const fs = require('fs'); 
const exec = require('child_process').exec; 

let config = {};
let storedData = {};
const workchain_id = 0; // hardcoded for now, easy to change later.
const key_name = 'buyer_key'; // ToDo: take from config or input

module.exports = {
	setConfig: function(data) {
		config = data;
	},

	getInfo: function(contract, cb) {
        getData(contract, `info`, (str, err) => {
			if (str) {
				cb(convertFromSlice(str));
			} else {
				cb(null, err)
			}
        });
	},

	getWorkchain: function(contract, cb) {
        getData(contract, `get_my_wc`, (str, err) => {
			if (str) {
				cb(+str);
			} else {
				cb(null, err)
			}
        });
	},

	getSellerPrice: function(contract, cb) { // For the seller
        getData(contract, `get_request_price`, (str, err) => {
			if (!!str) {
				cb(str);
			} else {
				cb(null, err)
			}
        });
	},

	getIsSellerOpen: function(contract, cb) { // For the seller
        getData(contract, `get_is_open`, (str, err) => {
			if (str) {
				cb(str);
			} else {
				cb(null, err)
			}
        });
	},

	getSellerItemIds: function(addr, cb) { // For the seller
		getData(addr, `get_known_goods`, (val_str) => {
			//[[[[, 32, 123], 323], 444], ]
			val_str = clearResponce(val_str);
			console.log(val_str);
			const itemIds = val_str.split(' ').filter(val => val.trim().length > 0).map(val => +val);
			console.log(itemIds);
			cb(itemIds);
		});
	},

	getContracts: function() {
		loadData();
		return storedData.contracts || [];
	},

	getBalance: function(contract, cb) {
		getBalance(contract, cb);
	},


	addExistingContract: function(addr, name, cb) {
		saveContract(addr, name);
		cb && cb();
	},

	forgetContract: function(addr) {
		delete storedData.contracts[addr];
		saveData();
	},

	validateConfig: function() {
		const result = { success: true };

		if (!config['lite-client-bin']) {
			result.success = false;
			result.noBin = true;
		} else {
			const liteClientPath = `${config['lite-client-bin']}`;
			if (!fs.existsSync(liteClientPath)) {
				result.success = false;
				result.liteClientNotFound = liteClientPath;
			}
		}

		if (!config['data-storage']) {
			result.success = false;
			result.noData = true;
		} else {
			const dataPath = `${config['data-storage']}`;
			if (!fs.existsSync(dataPath)) {
				try {
					fs.writeFileSync(dataPath, '{}');
				}
				catch (ex) {
					result.success = false;
					result.dataSaveError = ex;
				}
			} else {
				try {
					const dataContent = fs.readFileSync(config['data-storage']);
					const dataJson = JSON.parse(dataContent);
				} 
				catch(ex) {
					result.success = false;
					result.errorReadingData = ex;
				}
			}
		}

		if (!config['lite-client-config']) {
			result.success = false;
			result.noLiteClientConfig = true;
		} else {
			if (!fs.existsSync(config['lite-client-config'])) {
				result.success = false;
				result.liteClientConfigNotFound = config['lite-client-config'];
			} else {
				try {
					const configContent = fs.readFileSync(config['lite-client-config']);
					const configJson = JSON.parse(configContent);
				} 
				catch(ex) {
					result.success = false;
					result.errorReadingLiteClientConfig = ex;
				}
			}
		}

		const fifts = ['new-buyer.fif', 'pay-for-request.fif', 'price-request-create.fif', 'price-request-send.fif', 'key-update.fif',
	'cleanup-expired.fif', 'send-grams.fif'];

		if (!config['fift-folder']) {
			result.success = false;
			result.noFiftFolder = true;
		} else {
			fifts.forEach(scriptSrc => {
				if(!fs.existsSync(`${config['fift-folder']}/${scriptSrc}`)) {
					result.success = false;
					if (!result.missingScripts) {
						result.missingScripts = [];
					}
					result.missingScripts.push(scriptSrc);
				}
			});
		}

		return result;
	},

	deployContract: function(name, cb) {
		// <workchain-id> <buyer-key> <name> [<filename-base>]
		const filename = `new-buyer-${+new Date()}`;
		const command = `fift -s ${config['fift-folder']}/new-buyer.fif ${workchain_id} ${key_name} '${name}' ${filename}`;
		execute(command, (stdout, stderr) => {
			if (stderr) {
				console.error(stderr);
				cb(null, stderr);
				return;
			}
			const lines = stdout.split(os.EOL);
			let contract_addr = null; 
			let contract_full_addr = null;
			lines.forEach(line => {
				if (line.startsWith('Non-bounceable address (for init): ')) {
					contract_addr = line.replace('Non-bounceable address (for init): ', '').trim();
				} else if (line.startsWith('new buyer address = ')) {
					contract_full_addr = line.replace('new buyer address =', '').trim();
				}
			});
			if (!contract_addr) {
				console.log('==============');
				console.log(command);
				console.log(stdout);
				throw new Error('New contract address is not known');
			}
			console.log(contract_addr);
			saveContract(contract_addr, name, filename, contract_full_addr);
			cb(contract_addr);
		});
	},

	deployInitMessage: function(addr, cb) {
		loadData();
		sendFile(storedData.contracts[addr].filename, () => {
			cb();
		});
	},

	createOrder: function(addr, items, cb) {
		// <buyer-addr-file> <buyer-key-name> <seqno> <number-of-goods> [<item-id> <item-quantity>] [<savefile>]
		const filename = `price-request-create`;
		const command = `fift -s ${config['fift-folder']}/price-request-create.fif ${storedData.contracts[addr].filename} ${key_name} <{seqno}> ${items.length} ${items.map(it => `${it.itemId} ${it.quantity}`).join(' ')} ${filename}`;
		sendCommand(addr, filename, command, cb);
	},

	sendPriceRequest: function(addr, query_id, amount, seller_addr, cb) {
		// <buyer-addr-file> <buyer-key-name> <seqno> <query-id> <amount> <seller-addr> [<savefile>]
		const filename = `price-request-send`;
		const command = `fift -s ${config['fift-folder']}/price-request-send.fif ${storedData.contracts[addr].filename} ${key_name} <{seqno}> ${query_id} ${amount} 0x${seller_addr} ${filename}`;
		sendCommand(addr, filename, command, cb);
	},

	getClientOrders: function(addr, cb) {
		getData(addr, `get_requests`, (str, err) => {
			if (str) {
				const orders = parseRequests(str);
			
				cb(orders);
			} else {
				cb(null, err)
			}
        });
	},

	getOrderResponses: function(addr, query_id, cb) {
		getData(addr, `get_responses ${query_id}`, (str, err) => {
			// str = '[ () [ [ 0 100870126461620338394187119891701040242723685959666180064965254700620577097548 ] 1577556467 112 [ [ () [ 7 54 ] ] [ 9 10 ] ] ] ] '
			if (str) {
				const resps = [];
				const respss_raw = str.replace('()','').split('()');
				let resp = null;
				let nextresps = {};
				respss_raw.forEach((resps_raw, num) => {
					resps_raw = removeAll(resps_raw, '[');
					resps_raw = removeAll(resps_raw, ']');
					const nums = resps_raw.split(' ').filter(val => val.trim().length > 0);
					if (num < respss_raw.length - 1) { // Not the last
						nextresps.amount = +nums.pop();
						nextresps.expiry = +nums.pop();
						nextresps.seller_addr = nums.pop();
						nextresps.seller_wc = nums.pop();
						nextresps.seller_addr_full = `${nextresps.seller_wc}:${bnToHex(nextresps.seller_addr)}`;
					} 
					if (resp) {
						resp.goods = [];
						while(nums.length){
							resp.goods.push({
								quantity : +nums.pop(),
								itemId : +nums.pop()
							});
						}
						resp.goods.reverse();
						resps.push(resp);
					}
					resp = nextresps;
					nextresps = {};
				});
			
				cb(resps);
			} else {
				cb(null, err)
			}
		});
	}
}

function bnToHex(bn) {
	var base = 16;
	var hex = BigInt(bn).toString(base);
	if (hex.length % 2) {
	  hex = '0' + hex;
	}
	return hex;
  }

function clearResponce(val_str) {
	val_str = val_str.replace('()', '');
	val_str = removeAll(val_str, '[');
	val_str = removeAll(val_str, ']');
	return val_str;
}

function removeAll(str, char) {
	while(str.indexOf(char) > -1){
		str = str.replace(char, '');
	}
	return str;
}

function parseRequests(str) {
	const orders = [];
	const orders_raw = str.replace('()','').split('()');
	let order = null;
	let nextOrder = {};
	orders_raw.forEach((order_raw, num) => {
		order_raw = removeAll(order_raw, '[');
		order_raw = removeAll(order_raw, ']');
		const nums = order_raw.split(' ').filter(val => val.trim().length > 0).map(val => +val);
		if (num < orders_raw.length - 1) { // Not the last
			nextOrder.expiry = nums.pop();
			nextOrder.queryId = nums.pop();
		} 
		if (order) {
			order.goods = [];
			while(nums.length){
				order.goods.push({
					quantity : nums.pop(),
					itemId : nums.pop()
				});
			}
			order.goods.reverse();
			orders.push(order);
		}
		order = nextOrder;
		nextOrder = {};
	});
	orders.reverse();

	return orders;
}

function saveContract(addr, createdName, filename, contract_full_addr) {
	loadData();
	if(!addr) {
		return;
	}

	if (!storedData.contracts) {
		storedData.contracts = {};
	}
	if (!storedData.contracts[addr]) {
		storedData.contracts[addr] = {};
	}
	if (createdName) {
		storedData.contracts[addr].createdName = createdName;
	}
	if (filename) {
		storedData.contracts[addr].filename = filename;
	}
	if (contract_full_addr) {
		storedData.contracts[addr].contract_full_addr = contract_full_addr;
	}
	saveData();
}

function saveData() {
	fs.writeFileSync(config['data-storage'], JSON.stringify(storedData));
}

function loadData() {
	const dataContent = fs.readFileSync(config['data-storage']);
	storedData = JSON.parse(dataContent);
	return Object.assign({}, storedData);
}

function convertFromSlice(slice) {
	let str = slice.replace('CS{Cell{', '');
	const end = str.indexOf('}');
	str = str.substring(4, end);
	return convertFromHex(str);
}

function convertFromHex(hex) {
    var hex = hex.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function getData(contract, params, cb) {
	const command = buildLiteClientCommand(`runmethod ${contract} ${params}`)
	execute(command, (stdout, stderr) => {
		if ( (stderr.indexOf('is empty (cannot run method') > -1) ||
			(stderr.indexOf('not initialized yet (cannot run any methods)') > -1) ||
			(stdout.indexOf('is empty (cannot run method') > -1) ||
			(stdout.indexOf('not initialized yet (cannot run any methods)') > -1)) {
			cb(null, {isEmpty: true});
			return;
		}
        const lines = stdout.split(os.EOL);
        lines.forEach(line => {
            if (line.startsWith('result:  [ ')) {
                const val_str = line.replace('result:  [ ', '').replace(']', '').trim();
                cb(val_str);
            }
        });
    });
}

function getBalance(addr, cb){
    const command = buildLiteClientCommand(`getaccount ${addr}`);
    execute(command, (stdout, stderr) => {
        const lines = stdout.split(os.EOL);
        lines.forEach(line => {
            if (line.startsWith('account balance is ')) {
                const val_str = line.replace('account balance is ', '').replace('ng', '').trim();
                const val = +val_str / 1000000000;
                cb(val);
            }
        });
    });
}

function buildLiteClientCommand(command) {
    return `${config['lite-client-bin']} -C ${config['lite-client-config']} -rc '${command}'`;
}

function execute(command, callback){ 
    exec(command, function(error, stdout, stderr){ callback(stdout, stderr); }); 
};

function sendCommand(addr, filename, command, cb) {
	getSeqNo(addr, (seqno) => {
		const commandWithSeqno = command.replace('<{seqno}>', seqno);
		console.log(commandWithSeqno);
		execute(commandWithSeqno, (stdout, stderr) => {
			console.log(stdout);
			if (stderr) {
				console.error(stderr);
				cb && cb(null, stderr);
				return;
			}
			sendFile(filename, () => {
				cb && cb();
			});
		});
	});
}

function sendFile(file, cb) {
	const command = buildLiteClientCommand(`sendfile ${file}.boc`);
	execute(command, (stdout, stderr) => {
		console.log(stdout);
		console.log('==============');
		console.log(stderr);
		// execute(`rm ${file}.boc`, cb);
		cb();
    });
}

function getSeqNo(addr, cb){
	const command = buildLiteClientCommand(`runmethod ${addr} seqno`);
    liteClientGetNumber(command, cb);
}

function liteClientGetNumber(command, cb) {
    execute(command, (stdout, stderr) => {
        const lines = stdout.split(os.EOL);
        lines.forEach(line => {
            if (line.startsWith('result:  [ ')) {
                const val_str = line.replace('result:  [', '').replace(']', '').trim();
                const val = +val_str;
                cb(val);
            }
        });
    });
}