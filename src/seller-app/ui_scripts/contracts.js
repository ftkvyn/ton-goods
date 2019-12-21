$('body').on('click', '#load_stores', (e) => {
	$('#storesEl').empty();
	ipcRenderer.send('load-sellers');
	e.target.classList.add('clicked');
	setTimeout(() => {
		e.target.classList.remove('clicked');
	}, 1200);
});

ipcRenderer.send('load-sellers');

$('body').on('click', '.add-item', (e) => {
	$('<input type="number" name="itemId" placeholder="New item id" />').insertBefore($(e.target).closest('.btn'));
	e.preventDefault();
});

new_contract_form.addEventListener('submit', (e) => {
	e.preventDefault();
	const formData = new FormData(e.target);
	const goods = [];
	$(e.target).find('[name=itemId]').each( (i, inp) => { if (inp.value) goods.push(inp.value) });
	ipcRenderer.send('deploy-contract', formData.get('is_open') == 'on', +formData.get('price'), goods, formData.get('name'));
	new_contract_form.reset();
});

// add_known_course.addEventListener('submit', (e) => {
// 	const formData = new FormData(e.target);
// 	e.preventDefault();
// 	ipcRenderer.send('add-contract', formData.get('addr'));
// });

ipcRenderer.on('contract-updated', (e, addr, students) => {
	// add_known_course.reset();
	ipcRenderer.send('load-sellers');
});

let savedSellers = {};
let selectedAddr = null;

ipcRenderer.on('sellers-loaded', (e, contracts) => {
	console.log(contracts);
	let markup = '';
	let deployBtns = [];
	let forgetBtns = [];
	savedSellers = {};
	contracts.forEach(contract => {
		savedSellers[contract.addr] = contract;
		let content = `${contract.info ? `<h4 class='title'>${contract.info}</h4>` : ''}` + 
		`${contract.full_addr ? `Address: <i>${contract.full_addr}</i><br/>` : ''}` +
		`${contract.addr ? `N/B address: <i>${contract.addr}</i><br/>` : ''} ${contract.balance ? `Balance: <b>${contract.balance}</b><br/>` : ''}`;
		if (contract.isEmpty) {
			if (contract.createdName) {
				content += ` (${contract.createdName})`;
			}
			content += `<br/> <i>Contract was just created. Transfer some funds to it's address and deploy the contract after that to start working with it.</i><br/>`;
			if (contract.hasFile) {
				let btnId = `deploy-${contract.addr}`;
				deployBtns.push(btnId);
				content += `<button id='${btnId}' ${contract.balance ? '' : 'disabled=disabled'} class='btn'>Deploy</button> `;
			} else {
				content += `<p>No .boc file found for this contract.</p>`;
			}
		}
		if (contract.balance && contract.balance < 1) {
			content += `<br/><b style='color:red;'>Warning, low balance!</b>`
		}
		savedSellers[contract.addr] = contract;
		let fBtnId = `forget-${contract.addr}`;
		forgetBtns.push(fBtnId);
		content += ` <button id='${fBtnId}'} class='btn red'>Forget</button>`;
		const element = `<li class='${contract.isEmpty ? 'is-empty' : 'is-usable'}' data-addr='${contract.addr}'>${content}</li>`
		markup += element;
	});
	storesEl.innerHTML = markup;
	deployBtns.forEach(btnId => {
		document.getElementById(btnId).addEventListener('click', (e) => {
			ipcRenderer.send('deploy-boc', btnId.replace('deploy-', ''));
		});
	});

	forgetBtns.forEach(btnId => {
		document.getElementById(btnId).addEventListener('click', (e) => {
			const addr = btnId.replace('forget-', '');
			if (confirm(`Are you sure you want to remove contract ${addr} from application?`))
			ipcRenderer.send('forget-contract', addr);
			e.stopPropagation();
		});
	});

	[].forEach.call(storesEl.querySelectorAll('li.is-usable'), (liEl) => {
		liEl.addEventListener('click', (e) => {
			const addr = liEl.getAttribute('data-addr');
			console.log(addr);
			$('.store-clients').show();
			ipcRenderer.send('load-clients', addr);
			$('#clientsEl').empty();
			selectedAddr = addr;
			if (liEl.parentElement.querySelector('.active')) {
				liEl.parentElement.querySelector('.active').classList.remove('active');
			}
			liEl.classList.add('active');
		});
	});
});

$('body').on('click', '#load_clients', (e) => {
	$('#clientsEl').empty();
	$('.client-orders').hide();
	$('.response-area').hide();
	ipcRenderer.send('load-clients', selectedAddr);
	e.target.classList.add('clicked');
	setTimeout(() => {
		e.target.classList.remove('clicked');
	}, 1200);
});

let savedClients = [];
let selectedClient = null;

ipcRenderer.on('clients-loaded', (e, addr, clients) => {
	console.log(clients);
	$('#clientsEl').empty();
	if (selectedAddr == addr) {
		savedClients = {};
		clients.forEach(client => {
			savedClients[client.addr] = client;
			let content = `<p>${client.full_addr}</p>`;
			if (client.info) {
				content = `<p><b>${client.info}</b></p>` + content;
			}
			$('#clientsEl').append(`<li data-addr='${client.addr}'>${content}</li>`);
		});
	}

	[].forEach.call(clientsEl.querySelectorAll('li'), (liEl) => {
		liEl.addEventListener('click', (e) => {
			const addr = $(liEl).attr('data-addr');
			$('.client-orders').show();
			console.log(addr);
			if (liEl.parentElement.querySelector('.active')) {
				liEl.parentElement.querySelector('.active').classList.remove('active');
			}
			liEl.classList.add('active');
			selectedClient = addr;
			$('#client-name').text(savedClients[addr].info || savedClients[addr].addr)

			$('.one-buyer-area').show();
			$('.order-send-area').hide();
			$('.response-area').hide();
			$('#requestsEl').empty();
			ipcRenderer.send('load-client-orders', selectedAddr, selectedClient);
		});
	});
});

let savedOrders = {};

ipcRenderer.on('client-orders-loaded', (e, addr, clientid, orders) => {
	if (selectedAddr == addr && clientid == selectedClient) {
		console.log(orders);
		savedOrders = {};
		$('#requestsEl').empty();
		orders.forEach(order => {
			savedOrders[order.queryId] = order;
			let content = `<p>Query id: ${order.queryId}</p><p>Expires: ${new Date(+order.expiry * 1000)}</p>`;
			let tableContent = '<table><thead><tr><th>Item ID</th><th>Quantity</th></tr></thead><tbody>';
			order.goods.forEach(item => {
				tableContent += `<tr>
					<td>${item.itemId}</td>
					<td>${item.quantity}</td>
				</tr>`;
			});
			tableContent += '</tbody></table>';
			$('#requestsEl').append(`<li data-addr='${order.queryId}'>${content} ${tableContent}</li>`);
		});

		[].forEach.call(requestsEl.querySelectorAll('li'), (liEl) => {
			liEl.addEventListener('click', (e) => {
				const addr = liEl.getAttribute('data-addr');
				console.log(addr);
				$('.store-clients').show();
				selectedOrder = addr;
				if (liEl.parentElement.querySelector('.active')) {
					liEl.parentElement.querySelector('.active').classList.remove('active');
				}
				liEl.classList.add('active');

				$('.response-area').show();
				$('#order-title').text(savedOrders[addr].queryId);
				const template = $('#item-template .card');
				savedOrders[addr].goods.forEach(item => {
					const itemEl = template.clone();
					itemEl.find('label').text(item.itemId);
					itemEl.find('input').val(item.quantity);
					itemEl.find('button').click((e) => {
						e.preventDefault();
						$(e.target).closest('.request-item').remove();
					});
					$('#response_form').prepend(itemEl);
				});
			});
		});
	}
});

response_form.addEventListener('submit', (e) => {
	e.preventDefault();
	const items = [];
	$(e.target).find('.request-item').each( (i, cont) => { 
		if ($(cont).find('[name=quantity]').val()) {
			items.push({
				itemId: $(cont).find('label').text(),
				quantity: $(cont).find('[name=quantity]').val(),
			});
		} 
	});
	const amount = $(e.target).find('[name=price]').val();
	ipcRenderer.send('send-response', selectedAddr, amount, selectedClient, selectedOrder, items);
	response_form.reset();
	
	$(e.target).find('.request-item').remove();
	$('.response-area').hide();
});