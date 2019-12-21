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

	ipcMain.on('load-buyers', (e) => {
		const addrs = contractService.getContracts();
		console.log(addrs);
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
				win.send('buyers-loaded', contracts);
			});
			contractService.getBalance(addr, (balance) => {
				contract.balance = balance;
				win.send('buyers-loaded', contracts);
			});
		}
	});

	ipcMain.on('deploy-contract', (e, name) => {
		console.log(`deploying contract ${name}`);
		contractService.deployContract(name, (addr) => {
			win.send('contract-updated', addr);
		});
	});

	ipcMain.on('deploy-boc', (e, addr) => {
		console.log(`deploying boc ${addr}`);
		contractService.deployInitMessage(addr, () => {
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

	ipcMain.on('create-order', (e, addr, items) => {
		contractService.createOrder(addr, items);
		win.send('contract-updated', addr);
	});

	function loadOrders(addr) {
		contractService.getClientOrders(addr, (orders) => {
			win.send('orders-loaded', addr, orders);
		});
	}
	
	ipcMain.on('load-orders', (e, addr) => {
		loadOrders(addr);
	});
	
	ipcMain.on('validate-config', (e) => {
		const result = contractService.validateConfig();
		win.send('validate-config-result', result);
	});

	ipcMain.on('load-seller-info', (e, seller_addr, buyer_addr) => {
		contractService.getWorkchain(buyer_addr, (wc, err) => {
			if (err) {
				win.send('seller-info-loaded', {error : err});
				return;
			}
			const seller_full_addr = `${wc}:${seller_addr.toString(16)}`;
			console.log(seller_full_addr);
			data = {};
			contractService.getIsSellerOpen(seller_full_addr, (isOpenFlag, err) => {
				if (err) {
					win.send('seller-info-loaded', {error : err});
					return;
				}
				if (isOpenFlag == '0') {
					win.send('seller-info-loaded', {error : {isClosed: true}});
					return;
				}
				if (isOpenFlag != '1') {
					win.send('seller-info-loaded', {error : 'Is open state is not correct'});
					return;
				}

				contractService.getInfo(seller_full_addr, (info, err) => {
					if (err) {
						win.send('seller-info-loaded', {error : err});
						return;
					}
					data.info = info;
					
					contractService.getSellerPrice(seller_full_addr, (price, err) => {
						if (err) {
							win.send('seller-info-loaded', {error : err});
							return;
						}
						data.price = +price;
						data.seller_addr = seller_full_addr;
						data.seller_addr_int = seller_addr;
						contractService.getSellerItemIds(seller_full_addr, (items, err) => {
							if (err) {
								win.send('seller-info-loaded', {error : err});
								return;
							}
							data.items = items;
							win.send('seller-info-loaded', data);
						});
					});
				});

			});
		});
	});

	ipcMain.on('send-price-request', (e, selectedAddr, query_id, amount, seller_addr) => {
		contractService.sendPriceRequest(selectedAddr, query_id, amount, seller_addr);
	});

	
	ipcMain.on('load-order-responses', (e, selectedAddr, query_id) => {
		contractService.getOrderResponses(selectedAddr, query_id, (resps, err) => {
			if (err) {
				console.log(err);
				return;
			}
			if (resps && resps.length) {
				win.send('order-responses-loaded', selectedAddr, query_id, resps);
			}
		});
	});
	
}