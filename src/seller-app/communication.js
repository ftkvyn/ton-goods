let { ipcMain } = require('electron');
const fs = require('fs');
const is_mocking = false;
const contractService = is_mocking ? require('./services/contract.mock.js') : require('./services/contract.js');
const configPath = is_mocking ?  'config.mock.json' : 'config.json';

module.exports = {
	configure: configure
}

function configure(win){

	let configJson = {};
	try{
		configJson = JSON.parse(fs.readFileSync(configPath));
	}
	catch(ex) {
		console.error(ex);
	}

	contractService.setConfig(configJson);

	ipcMain.on('load-sellers', (e) => {
		const addrs = contractService.getContracts();
		const contracts = [];
		for(var addr in addrs) {
			const contract = {
				addr: addr,
				full_addr: addrs[addr].contract_full_addr
			};
			if (addrs[addr].filename) {
				contract.hasFile = true;
			}
			contracts.push(contract);
			// ToDo: rewrite all for promices and do it right.
			contractService.getInfo(addr, (info, err) => {
				console.log(info);
				console.log(err);
				if (info) {
					contract.info = info;
				} else if (err && err.isEmpty) {
					contract.isEmpty = true;
					contract.createdName = addrs[addr].createdName;
				}
				win.send('sellers-loaded', contracts);
			});
			if (addrs[addr].goods) {
				contract.goods = addrs[addr].goods;
			} else {
				contractService.getItemIds(addr, (goods, err) => {
					contract.goods = goods;
					win.send('sellers-loaded', contracts);
				});
			}
			contractService.getBalance(addr, (balance) => {
				contract.balance = balance;
				win.send('sellers-loaded', contracts);
			});
		}
	});

	ipcMain.on('deploy-contract', (e, is_open, request_price, goods_list, name) => {
		console.log(`deploying contract ${name} ${goods_list}`);
		contractService.deployContract(is_open, request_price, goods_list, name, (addr, goods_list) => {
			win.send('contract-updated', addr, goods_list);
		});
	});

	ipcMain.on('deploy-boc', (e, addr) => {
		console.log(`deploying boc ${addr}`);
		contractService.deployInitMessage(addr, () => {
			win.send('contract-updated', addr);
		});
	});

	ipcMain.on('send-response', (e, addr, amount, buyer_addr, query_id, prices) => {
		console.log(`sendig price response ${buyer_addr} ${amount} ${query_id} ${JSON.stringify(prices)}`);
		contractService.sendPriceResponse(addr, amount, buyer_addr, query_id, prices, (addr) => {
			win.send('contract-updated', addr);
		});
	});

	ipcMain.on('add-contract', (e, addr, name) => {
		contractService.addExistingContract(addr, name);
		win.send('contract-updated', addr);
	});

	ipcMain.on('forget-contract', (e, addr) => {
		contractService.forgetContract(addr);
		win.send('contract-updated', addr);
	});

	ipcMain.on('save-item-name', (e, addr, id, name) => {
		contractService.saveItemName(addr, id, name);
	});

	function loadItems(addr) {
		contractService.getItemIds(addr, (goods) => {
			win.send('goods-loaded', addr, goods);
		});
	}
	
	ipcMain.on('load-goods', (e, addr) => {
		loadItems(addr);
	});

	ipcMain.on('add-item', (e, addr, id) => {
		contractService.editItem(addr, id, true, () => {
			setTimeout(() => {loadItems(addr);}, 5000); // some time for catch the change
		});
	});

	ipcMain.on('remove-item', (e, addr, id) => {
		contractService.editItem(addr, id, false, () => {
			setTimeout(() => {loadItems(addr);}, 5000); // some time for catch the change
		});
	});

	function loadNewClients(addr) {
		contractService.getNewClients(addr, (clients) => {
			clients.forEach(client => {
				client.full_addr = `${client.wc}:${bnToHex(client.addr)}`;
				contractService.getInfo(client.full_addr, (info, err) => {
					if (info) {
						client.info = info;
						win.send('clients-loaded', addr, clients);
					}
				});
			});
			win.send('clients-loaded', addr, clients);
		});
	}
	
	ipcMain.on('load-clients', (e, addr) => {
		loadNewClients(addr);
	});

	function loadClientOrders(addr, client_id) {
		contractService.getClientOrders(addr, client_id, (orders) => {
			win.send('client-orders-loaded', addr, client_id, orders);
		});
	}
	
	ipcMain.on('load-client-orders', (e, addr, client_id) => {
		loadClientOrders(addr, client_id);
	});
	
	ipcMain.on('validate-config', (e) => {
		const result = contractService.validateConfig();
		win.send('validate-config-result', result);
	});
}

function bnToHex(bn) {
	var base = 16;
	var hex = BigInt(bn).toString(base);
	if (hex.length % 2) {
	  hex = '0' + hex;
	}
	return hex;
  }