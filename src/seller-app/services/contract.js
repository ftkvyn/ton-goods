const os = require('os'); 
const fs = require('fs'); 
const exec = require('child_process').exec; 

let config = {};
let storedData = {};
const workchain_id = 0; // hardcoded for now, easy to change later.
const key_name = 'seller_key'; // ToDo: take from config or input

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

	getContracts: function() {
		loadData();
		return storedData.contracts || [];
	},

	getBalance: function(contract, cb) {
		getBalance(contract, cb);
	},


	addExistingContract: function(addr, name, cb) {
		getItemIds(addr, () => {
			saveContract(addr, storedData.contracts[addr].goods, name);
		});
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

		const fifts = ['edit-goods.fif', 'new-seller.fif', 'open-close-seller.fif', 'price-response.fif', 'key-update.fif', 
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

	deployContract: function(is_open, request_price, goods_list, name, cb) {
		// <workchain-id> <seller-key> <is-open> <request-price> <name> <number-of-goods> [<item-id>] [<filename-base>]
		const filename = `new-seller-${+new Date()}`;
		const command = `fift -s ${config['fift-folder']}/new-seller.fif ${workchain_id} ${key_name} ${is_open ? 1 : 0} ${request_price} '${name}' ${goods_list.length} ${goods_list.join(' ')} ${filename}`;
		console.log(command);
		execute(command, (stdout, stderr) => {
			if (stderr) {
				console.error(stderr);
				cb(null, stderr);
				return;
			}
			const lines = stdout.split(os.EOL);
			let contract_addr = null; 
			lines.forEach(line => {
				if (line.startsWith('Non-bounceable address (for init): ')) {
					contract_addr = line.replace('Non-bounceable address (for init): ', '').trim();
				} else if (line.startsWith('new seller address = ')) {
					contract_full_addr = line.replace('new seller address =', '').trim();
				}
			});
			if (!contract_addr) {
				console.log('==============');
				console.log(command);
				console.log(stdout);
				throw new Error('New contract address is not known');
			}
			console.log(contract_addr);
			saveContract(contract_addr, goods_list, name, filename, contract_full_addr);
			cb(contract_addr, goods_list);
		});
	},

	deployInitMessage: function(addr, cb) {
		loadData();
		sendFile(storedData.contracts[addr].filename, () => {
			cb();
		});
	},

	getNewClients: function(addr, cb) {
		getData(addr, `get_new_clients`, (val_str) => {
			const addrs_list = clearResponce(val_str).trim().split(' ');
			const clients = [];
			while (addrs_list.length) {
				clients.push({
					addr: addrs_list.pop(),
					wc: addrs_list.pop()
				});
			}
			cb(clients);
		});
	},

	getClientOrders: function(addr, client_addr, cb) {
		getData(addr, `get_client_orders ${client_addr}`, (val_str) => {
			if (val_str) {
				const orders = parseRequests(val_str);
			
				cb(orders);
			} else {
				cb(null, err)
			}
		});
	},

	getItemIds: function(addr, cb) {
		getData(addr, `get_known_goods`, (val_str) => {
			const itemIds = val_str.replace('(','').replace(')','').split(' ');
			saveContract(addr, itemIds)
			cb(storedData.contracts[addr].goods);
		});
	},

	getRequestPrice: function(addr, cb) {
		const command = buildLiteClientCommand(`runmethod ${addr} get_request_price`);
		liteClientGetNumber(command, cb);
	},

	getIsOpen: function(addr, cb) {
		const command = buildLiteClientCommand(`runmethod ${addr} get_is_open`);
		liteClientGetNumber(command, (val) => {
			if (val == 1) {
				return true;
			} else {
				return false;
			}
		});
	},

	saveItemName: function(addr, id, name) {
		storedData.contracts[addr].goods[id].name = name;
		saveData();
	},

	editItem: function(addr, item_id, is_add, cb) {
		// <seller-addr-file> <seller-key-name> <seqno> <item-id> <is-add> [<savefile>]
		const filename = `edit-goods`;
		const command = `fift -s ${config['fift-folder']}/edit-goods.fif ${storedData.contracts[addr].filename} ${key_name} <{seqno}> ${item_id} ${is_add ? 1 : 0} ${filename}`;
		sendCommand(addr, filename, command, cb);
	},

	openOrClose: function(addr, is_open, cb) {
		// <seller-addr-file> <seller-key-name> <seqno> <is-open> [<savefile>]
		const filename = `open-close-seller`;
		const command = `fift -s ${config['fift-folder']}/open-close-seller.fif ${storedData.contracts[addr].filename} ${key_name} <{seqno}> ${is_open ? 1 : 0} ${filename}`;
		sendCommand(addr, filename, command, cb);
	},

	sendPriceResponse: function(addr, amount, buyer_addr, query_id, prices, cb) {
		// <seller-addr-file> <seller-key-name> <seqno> <amount> <buyer-addr> <query-id> <number-of-goods> [<item-id> <item-quantity>] [<savefile>]
		const filename = `price-response`;
		const command = `fift -s ${config['fift-folder']}/price-response.fif ${storedData.contracts[addr].filename} ${key_name} <{seqno}> ${amount} ${buyer_addr} ${query_id} ${prices.length} ${prices.map(pr => `${pr.itemId} ${pr.quantity}`).join(' ')} ${filename}`;
		sendCommand(addr, filename, command, cb);
	},
}

function saveContract(addr, goods_list, createdName, filename, contract_full_addr) {
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
	if (contract_full_addr) {
		storedData.contracts[addr].contract_full_addr = contract_full_addr;
	}
	if (filename) {
		storedData.contracts[addr].filename = filename;
	}
	if (goods_list) {
		if (!storedData.contracts[addr].goods) {
			storedData.contracts[addr].goods = {};
		} 
		goods_list.forEach(gi => {
			if (!storedData.contracts[addr].goods[gi]){
				storedData.contracts[addr].goods[gi] = {}
			}
		});
	}
	saveData();
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
			(stderr.indexOf('not initialized yet (cannot run any methods)') > -1)) {
			cb(null, {isEmpty: true});
			return;
		}
        const lines = stderr.split(os.EOL);
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
        const lines = stderr.split(os.EOL);
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
		console.log(commandWithSeqno)
		execute(commandWithSeqno, (stdout, stderr) => {
			console.log(stdout);
			if (stderr) {
				console.error(stderr);
				cb(null, stderr);
				return;
			}
			sendFile(filename, () => {
				cb();
			});
		});
	});
}

function sendFile(file, cb) {
	const command = buildLiteClientCommand(`sendfile ${file}.boc`);
	execute(command, (stdout, stderr) => {
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
        const lines = stderr.split(os.EOL);
        lines.forEach(line => {
            if (line.startsWith('result:  [ ')) {
                const val_str = line.replace('result:  [', '').replace(']', '').trim();
                const val = +val_str;
                cb(val);
            }
        });
    });
}